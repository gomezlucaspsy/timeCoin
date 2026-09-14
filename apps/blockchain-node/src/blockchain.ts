import { getParams, ProtocolParams, Network, getNetwork } from "./constants.js";
import { targetFromDifficulty, retargetDifficulty, hashMeetsTarget } from "./difficulty.js";
import { buildBlockTemplate, mineBlock, isBlockHashValid, hashHeader, Block, BlockHeader } from "./block.js";
import {
  Transaction,
  TxOutput,
  buildCoinbaseTx,
  verifyTransactionSignatures,
} from "./transaction.js";
import { merkleRoot } from "./merkle.js";

export interface UtxoKey {
  txId: string;
  outputIndex: number;
}

export interface UtxoEntry extends TxOutput {
  blockHeight: number;
  isCoinbase: boolean;
}

function utxoKey(txId: string, outputIndex: number): string {
  return `${txId}:${outputIndex}`;
}

/** Reward halves every halvingIntervalBlocks, floors at 0 — identical shape to Bitcoin's issuance curve. */
export function blockReward(height: number, params: ProtocolParams): bigint {
  const halvings = Math.floor(height / params.halvingIntervalBlocks);
  if (halvings >= 64) return 0n;
  const initial = BigInt(params.initialRewardCoins) * params.unitsPerCoin;
  return initial >> BigInt(halvings);
}

export class Blockchain {
  readonly network: Network;
  readonly params: ProtocolParams;
  chain: Block[] = [];
  utxoSet: Map<string, UtxoEntry> = new Map();
  mempool: Transaction[] = [];

  constructor(network: Network = getNetwork()) {
    this.network = network;
    this.params = getParams(network);
    this.chain = [this.createGenesisBlock()];
    this.rebuildUtxoSet();
  }

  private createGenesisBlock(): Block {
    const timestamp = 0;
    const coinbase = buildCoinbaseTx(
      "1GenesisTimeCoinBurnAddressXXXXXXXXXXXXXXXX",
      0n,
      timestamp,
      0,
    );
    const header: BlockHeader = {
      height: 0,
      previousHash: "0".repeat(64),
      merkleRoot: merkleRoot([coinbase.id]),
      timestamp,
      difficulty: this.params.initialDifficulty,
      nonce: 0,
    };
    return { header, hash: hashHeader(header), transactions: [coinbase] };
  }

  get tip(): Block {
    return this.chain[this.chain.length - 1];
  }

  get height(): number {
    return this.tip.header.height;
  }

  currentDifficulty(): number {
    return this.tip.header.difficulty;
  }

  nextDifficulty(candidateTimestamp: number = Date.now()): number {
    const h = this.height + 1;
    const interval = this.params.difficultyAdjustmentIntervalBlocks;
    const scheduled = (() => {
      if (h % interval !== 0) return this.currentDifficulty();
      const epochStart = this.chain[this.chain.length - interval];
      const actualSeconds = (this.tip.header.timestamp - epochStart.header.timestamp) / 1000;
      return retargetDifficulty(this.currentDifficulty(), actualSeconds, this.params);
    })();

    if (this.params.allowMinDifficultyOnStall) {
      const gapSeconds = (candidateTimestamp - this.tip.header.timestamp) / 1000;
      if (gapSeconds > 2 * this.params.targetBlockTimeSeconds) {
        return this.params.initialDifficulty;
      }
    }
    return scheduled;
  }

  private rebuildUtxoSet(): void {
    this.utxoSet.clear();
    for (const block of this.chain) {
      this.applyBlockToUtxoSet(block);
    }
  }

  private applyBlockToUtxoSet(block: Block): void {
    for (const tx of block.transactions) {
      for (const input of tx.inputs) {
        if (tx.isCoinbase) continue;
        this.utxoSet.delete(utxoKey(input.txId, input.outputIndex));
      }
      tx.outputs.forEach((output, index) => {
        this.utxoSet.set(utxoKey(tx.id, index), {
          ...output,
          blockHeight: block.header.height,
          isCoinbase: tx.isCoinbase,
        });
      });
    }
  }

  getBalance(address: string): bigint {
    let total = 0n;
    for (const utxo of this.utxoSet.values()) {
      if (utxo.address !== address) continue;
      if (utxo.isCoinbase && this.height - utxo.blockHeight < this.params.coinbaseMaturityBlocks) continue;
      total += utxo.amount;
    }
    return total;
  }

  getSpendableUtxos(address: string): Array<UtxoEntry & UtxoKey> {
    const result: Array<UtxoEntry & UtxoKey> = [];
    for (const [key, utxo] of this.utxoSet.entries()) {
      if (utxo.address !== address) continue;
      if (utxo.isCoinbase && this.height - utxo.blockHeight < this.params.coinbaseMaturityBlocks) continue;
      const [txId, outputIndex] = key.split(":");
      result.push({ ...utxo, txId, outputIndex: Number(outputIndex) });
    }
    return result;
  }

  submitTransaction(tx: Transaction): { accepted: boolean; reason?: string } {
    const alreadySpent = new Set(
      this.mempool.flatMap((t) => t.inputs.map((i) => utxoKey(i.txId, i.outputIndex))),
    );
    for (const input of tx.inputs) {
      if (alreadySpent.has(utxoKey(input.txId, input.outputIndex))) {
        return { accepted: false, reason: "UTXO already spent by a pending mempool transaction" };
      }
    }

    const check = this.validateTransaction(tx, this.utxoSet);
    if (!check.valid) return { accepted: false, reason: check.reason };
    this.mempool.push(tx);
    return { accepted: true };
  }

  private validateTransaction(
    tx: Transaction,
    utxoSet: Map<string, UtxoEntry>,
  ): { valid: boolean; reason?: string; fee?: bigint } {
    if (tx.isCoinbase) return { valid: true, fee: 0n };

    let inputTotal = 0n;
    for (const input of tx.inputs) {
      const key = utxoKey(input.txId, input.outputIndex);
      const utxo = utxoSet.get(key);
      if (!utxo) return { valid: false, reason: `Unknown or spent UTXO ${key}` };
      if (utxo.isCoinbase && this.height - utxo.blockHeight < this.params.coinbaseMaturityBlocks) {
        return { valid: false, reason: "Coinbase output not yet mature" };
      }
      inputTotal += utxo.amount;
    }

    const outputTotal = tx.outputs.reduce((sum, o) => sum + o.amount, 0n);
    if (outputTotal > inputTotal) return { valid: false, reason: "Outputs exceed inputs" };
    if (tx.outputs.some((o) => o.amount <= 0n)) return { valid: false, reason: "Non-positive output amount" };

    const sigCheck = verifyTransactionSignatures(tx, (txId, idx) => utxoSet.get(utxoKey(txId, idx))?.address);
    if (!sigCheck.valid) return { valid: false, reason: sigCheck.reason };

    return { valid: true, fee: inputTotal - outputTotal };
  }

  /** Assemble a mineable block template from the current mempool for the given miner address. */
  prepareBlockTemplate(minerAddress: string): { template: Omit<BlockHeader, "nonce">; transactions: Transaction[]; target: bigint } {
    const height = this.height + 1;
    const timestamp = Date.now();
    const difficulty = this.nextDifficulty(timestamp);
    const target = targetFromDifficulty(difficulty, this.params);

    let fees = 0n;
    const included: Transaction[] = [];
    const simulatedUtxo = new Map(this.utxoSet);
    for (const tx of this.mempool) {
      const check = this.validateTransaction(tx, simulatedUtxo);
      if (check.valid) {
        included.push(tx);
        fees += check.fee ?? 0n;
        for (const input of tx.inputs) simulatedUtxo.delete(utxoKey(input.txId, input.outputIndex));
        tx.outputs.forEach((o, i) =>
          simulatedUtxo.set(utxoKey(tx.id, i), { ...o, blockHeight: this.height + 1, isCoinbase: false }),
        );
      }
    }

    const reward = blockReward(height, this.params) + fees;
    const coinbase = buildCoinbaseTx(minerAddress, reward, timestamp, height);
    const transactions = [coinbase, ...included];
    const template = buildBlockTemplate(height, this.tip.hash, transactions, difficulty, timestamp);
    return { template, transactions, target };
  }

  mineNextBlock(minerAddress: string, maxAttempts?: number): Block | null {
    const { template, transactions, target } = this.prepareBlockTemplate(minerAddress);
    const result = mineBlock(template, transactions, target, { maxAttempts });
    if (!result) return null;
    this.acceptBlock(result.block);
    return result.block;
  }

  /** Validates and appends a block that was mined here or received from elsewhere. */
  acceptBlock(block: Block): { accepted: boolean; reason?: string } {
    const check = this.validateBlock(block, this.tip);
    if (!check.valid) return { accepted: false, reason: check.reason };

    this.chain.push(block);
    this.applyBlockToUtxoSet(block);
    const includedIds = new Set(block.transactions.map((t) => t.id));
    this.mempool = this.mempool.filter((t) => !includedIds.has(t.id));
    return { accepted: true };
  }

  private validateBlock(block: Block, previous: Block): { valid: boolean; reason?: string } {
    if (block.header.height !== previous.header.height + 1) {
      return { valid: false, reason: "Height does not follow tip" };
    }
    if (block.header.previousHash !== previous.hash) {
      return { valid: false, reason: "previousHash does not match tip" };
    }
    if (!isBlockHashValid(block)) {
      return { valid: false, reason: "Stored hash does not match recomputed header hash" };
    }
    const expectedDifficulty =
      block.header.height === this.height + 1 ? this.nextDifficulty(block.header.timestamp) : block.header.difficulty;
    if (Math.abs(block.header.difficulty - expectedDifficulty) > 1e-6) {
      return { valid: false, reason: "Unexpected difficulty for this height" };
    }
    const target = targetFromDifficulty(block.header.difficulty, this.params);
    if (!hashMeetsTarget(block.hash, target)) {
      return { valid: false, reason: "Hash does not meet difficulty target" };
    }
    if (merkleRoot(block.transactions.map((t) => t.id)) !== block.header.merkleRoot) {
      return { valid: false, reason: "Merkle root mismatch" };
    }

    const coinbaseTxs = block.transactions.filter((t) => t.isCoinbase);
    if (coinbaseTxs.length !== 1) return { valid: false, reason: "Block must have exactly one coinbase tx" };

    let simulatedUtxo = new Map(this.utxoSet);
    let fees = 0n;
    for (const tx of block.transactions) {
      if (tx.isCoinbase) continue;
      const result = this.validateTransaction(tx, simulatedUtxo);
      if (!result.valid) return { valid: false, reason: `tx ${tx.id}: ${result.reason}` };
      fees += result.fee ?? 0n;
      for (const input of tx.inputs) simulatedUtxo.delete(utxoKey(input.txId, input.outputIndex));
      tx.outputs.forEach((o, i) => simulatedUtxo.set(utxoKey(tx.id, i), { ...o, blockHeight: block.header.height, isCoinbase: false }));
    }

    const expectedReward = blockReward(block.header.height, this.params) + fees;
    const coinbaseOut = coinbaseTxs[0].outputs.reduce((s, o) => s + o.amount, 0n);
    if (coinbaseOut > expectedReward) {
      return { valid: false, reason: "Coinbase pays out more than reward + fees" };
    }

    return { valid: true };
  }

  /** Full re-validation of an entire candidate chain from genesis, for fork/replace logic. */
  static isValidChain(blocks: Block[], network: Network = getNetwork()): boolean {
    if (blocks.length === 0) return false;
    const candidate = new Blockchain(network);
    candidate.chain = [blocks[0]];
    candidate.rebuildUtxoSet();
    for (let i = 1; i < blocks.length; i++) {
      const result = candidate.acceptBlock(blocks[i]);
      if (!result.accepted) return false;
    }
    return true;
  }

  /** Longest valid chain wins, same fork-choice rule as Bitcoin. */
  replaceChainIfBetter(candidate: Block[]): { replaced: boolean; reason?: string } {
    if (candidate.length <= this.chain.length) {
      return { replaced: false, reason: "Candidate chain is not longer" };
    }
    if (!Blockchain.isValidChain(candidate, this.network)) {
      return { replaced: false, reason: "Candidate chain failed validation" };
    }
    this.chain = candidate;
    this.rebuildUtxoSet();
    this.mempool = [];
    return { replaced: true };
  }

  /** Restore from a trusted local snapshot (already-validated chain) without re-running PoW checks. */
  loadTrustedChain(blocks: Block[]): void {
    if (blocks.length === 0) return;
    this.chain = blocks;
    this.rebuildUtxoSet();
    this.mempool = [];
  }

  circulatingSupply(): bigint {
    let total = 0n;
    for (const block of this.chain) {
      const coinbase = block.transactions.find((t) => t.isCoinbase);
      if (coinbase) total += coinbase.outputs.reduce((s, o) => s + o.amount, 0n);
    }
    return total;
  }
}
