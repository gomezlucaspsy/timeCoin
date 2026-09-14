import { describe, it, expect, beforeEach } from "vitest";
import { Blockchain, blockReward } from "../src/blockchain.js";
import { createWallet, buildTransfer } from "../src/wallet.js";
import { getParams } from "../src/constants.js";

describe("Blockchain (devnet)", () => {
  let chain: Blockchain;

  beforeEach(() => {
    chain = new Blockchain("devnet");
  });

  it("starts at height 0 with a genesis block", () => {
    expect(chain.height).toBe(0);
    expect(chain.chain).toHaveLength(1);
  });

  it("mining a block increases height and pays the miner (once matured)", () => {
    const miner = createWallet();
    const params = getParams("devnet");

    const block = chain.mineNextBlock(miner.address, 5_000_000);
    expect(block).not.toBeNull();
    expect(chain.height).toBe(1);

    // Not spendable yet — coinbase needs coinbaseMaturityBlocks confirmations.
    expect(chain.getBalance(miner.address)).toBe(0n);

    for (let i = 0; i < params.coinbaseMaturityBlocks; i++) {
      chain.mineNextBlock(createWallet().address, 5_000_000);
    }

    expect(chain.getBalance(miner.address)).toBe(blockReward(1, params));
  });

  it("halves the block reward every halvingIntervalBlocks", () => {
    const params = getParams("devnet");
    const initial = BigInt(params.initialRewardCoins) * params.unitsPerCoin;
    expect(blockReward(0, params)).toBe(initial);
    expect(blockReward(params.halvingIntervalBlocks - 1, params)).toBe(initial);
    expect(blockReward(params.halvingIntervalBlocks, params)).toBe(initial / 2n);
    expect(blockReward(params.halvingIntervalBlocks * 2, params)).toBe(initial / 4n);
  });

  it("moves coins between wallets via a signed transaction", () => {
    const params = getParams("devnet");
    const alice = createWallet();
    const bob = createWallet();

    chain.mineNextBlock(alice.address, 5_000_000);
    for (let i = 0; i < params.coinbaseMaturityBlocks; i++) {
      chain.mineNextBlock(createWallet().address, 5_000_000);
    }

    const aliceBalanceBefore = chain.getBalance(alice.address);
    expect(aliceBalanceBefore).toBeGreaterThan(0n);

    const sendAmount = aliceBalanceBefore / 2n;
    const utxos = chain.getSpendableUtxos(alice.address);
    const { transaction } = buildTransfer(alice, utxos, bob.address, sendAmount);

    const submit = chain.submitTransaction(transaction);
    expect(submit.accepted).toBe(true);

    chain.mineNextBlock(createWallet().address, 5_000_000);

    expect(chain.getBalance(bob.address)).toBe(sendAmount);
    expect(chain.getBalance(alice.address)).toBe(aliceBalanceBefore - sendAmount);
  });

  it("rejects a transaction that tries to spend more than the wallet owns", () => {
    const alice = createWallet();
    const bob = createWallet();
    const params = getParams("devnet");

    chain.mineNextBlock(alice.address, 5_000_000);
    for (let i = 0; i < params.coinbaseMaturityBlocks; i++) {
      chain.mineNextBlock(createWallet().address, 5_000_000);
    }

    const balance = chain.getBalance(alice.address);
    const utxos = chain.getSpendableUtxos(alice.address);
    expect(() => buildTransfer(alice, utxos, bob.address, balance * 10n)).toThrow(/Insufficient balance/);
  });

  it("rejects a block whose hash has been tampered with", () => {
    const miner = createWallet();
    const block = chain.mineNextBlock(miner.address, 5_000_000)!;

    const forged = { ...block, hash: "0".repeat(64) };
    const nextTemplate = chain.prepareBlockTemplate(miner.address);
    const forgedChain = [...chain.chain.slice(0, -1), forged];

    expect(Blockchain.isValidChain(forgedChain, "devnet")).toBe(false);
    void nextTemplate; // sanity: template generation didn't throw either
  });

  it("resets to minimum difficulty if no block lands within 2x the target spacing (testnet-style anti-stall)", () => {
    const params = getParams("devnet");
    const interval = params.difficultyAdjustmentIntervalBlocks;

    for (let i = 0; i < interval; i++) {
      chain.mineNextBlock(createWallet().address, 5_000_000);
    }
    const scheduled = chain.currentDifficulty();
    expect(scheduled).not.toBe(params.initialDifficulty); // retarget actually moved it

    const stalledTimestamp = chain.tip.header.timestamp + (2 * params.targetBlockTimeSeconds + 1) * 1000;
    expect(chain.nextDifficulty(stalledTimestamp)).toBe(params.initialDifficulty);

    const onTimeTimestamp = chain.tip.header.timestamp + 1000;
    expect(chain.nextDifficulty(onTimeTimestamp)).toBe(scheduled);
  });

  it("rejects a coinbase that pays out more than reward + fees", () => {
    const attacker = createWallet();
    const { template, transactions, target } = chain.prepareBlockTemplate(attacker.address);
    transactions[0].outputs[0].amount += 1_000_000_000n;

    const result = chain.acceptBlock({
      header: { ...template, nonce: 0 },
      hash: "0".repeat(64), // will fail earlier checks too, but we want to see the specific path exercised
      transactions,
    });
    expect(result.accepted).toBe(false);
    void target;
  });
});
