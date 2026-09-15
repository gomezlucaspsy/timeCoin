import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import { Blockchain, blockReward } from "./blockchain.js";
import { saveSnapshot, loadSnapshot } from "./persistence.js";
import { getNetwork, getParams } from "./constants.js";
import { isValidAddress } from "./crypto.js";
import { P2PNetwork } from "./p2p/network.js";
import type { Transaction } from "./transaction.js";

const PORT = Number(process.env.PORT ?? 3001);
const P2P_PORT = Number(process.env.TIMECOIN_P2P_PORT ?? 3002);
const SEED_PEERS = (process.env.TIMECOIN_PEERS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const SNAPSHOT_PATH =
  process.env.TIMECOIN_DATA_PATH ?? fileURLToPath(new URL("../data/chain.json", import.meta.url));
const AUTOMINE_INTERVAL_MS = Number(process.env.TIMECOIN_AUTOMINE_MS ?? 0); // 0 = disabled

const network = getNetwork();
const params = getParams(network);
const chain = new Blockchain(network);

const existing = loadSnapshot(SNAPSHOT_PATH);
if (existing && existing.network === network && existing.chain.length > 1) {
  chain.loadTrustedChain(existing.chain);
  console.log(`Loaded snapshot: height ${chain.height}, network ${network}`);
} else {
  console.log(`Starting fresh ${network} chain (genesis only)`);
}

function persist(): void {
  saveSnapshot(SNAPSHOT_PATH, { network, chain: chain.chain });
}

const p2p = new P2PNetwork(chain, {
  port: P2P_PORT,
  seedPeers: SEED_PEERS,
  onChainChanged: persist,
  log: (message) => console.log(`[p2p] ${message}`),
});
p2p.start();

function send(res: ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(json);
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
}

function parseBigInt(value: unknown, field: string): bigint {
  if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value);
  if (typeof value === "number" && Number.isInteger(value)) return BigInt(value);
  throw new Error(`Invalid amount for ${field}`);
}

function statusPayload() {
  return {
    network,
    height: chain.height,
    tipHash: chain.tip.hash,
    difficulty: chain.currentDifficulty(),
    nextBlockReward: blockReward(chain.height + 1, params).toString(),
    circulatingSupply: chain.circulatingSupply().toString(),
    maxSupply: (BigInt(params.maxSupplyCoins) * params.unitsPerCoin).toString(),
    unitsPerCoin: params.unitsPerCoin.toString(),
    halvingIntervalBlocks: params.halvingIntervalBlocks,
    targetBlockTimeSeconds: params.targetBlockTimeSeconds,
    mempoolSize: chain.mempool.length,
    peerCount: p2p.peerCount,
  };
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") {
      send(res, 204, {});
      return;
    }

    const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
    const parts = url.pathname.split("/").filter(Boolean);

    if (req.method === "GET" && parts.length === 1 && parts[0] === "status") {
      send(res, 200, statusPayload());
      return;
    }

    if (req.method === "GET" && parts[0] === "balance" && parts.length === 2) {
      const address = parts[1];
      if (!isValidAddress(address)) return send(res, 400, { error: "Invalid address" });
      const pending = chain.getPendingBalance(address);
      send(res, 200, {
        address,
        balance: chain.getBalance(address).toString(),
        pending: pending.amount.toString(),
        pendingMaturesInBlocks: pending.maturesInBlocks,
      });
      return;
    }

    if (req.method === "GET" && parts[0] === "utxos" && parts.length === 2) {
      const address = parts[1];
      if (!isValidAddress(address)) return send(res, 400, { error: "Invalid address" });
      send(res, 200, { address, utxos: chain.getSpendableUtxos(address) });
      return;
    }

    if (req.method === "GET" && parts[0] === "chain") {
      const limit = Math.min(Number(url.searchParams.get("limit") ?? 20), 200);
      const recent = chain.chain.slice(-limit).reverse();
      send(res, 200, { height: chain.height, blocks: recent });
      return;
    }

    if (req.method === "GET" && parts[0] === "mempool") {
      send(res, 200, { transactions: chain.mempool });
      return;
    }

    if (req.method === "GET" && parts[0] === "peers") {
      send(res, 200, { peers: p2p.peerSummaries() });
      return;
    }

    if (req.method === "POST" && parts[0] === "tx") {
      const body = (await readBody(req)) as Partial<Transaction>;
      if (!body.inputs || !body.outputs || !body.id) {
        return send(res, 400, { error: "Malformed transaction" });
      }
      const tx: Transaction = {
        id: body.id,
        inputs: body.inputs.map((i) => ({ ...i })),
        outputs: body.outputs.map((o) => ({ address: o.address, amount: parseBigInt(o.amount, "amount") })),
        isCoinbase: false,
        timestamp: body.timestamp ?? Date.now(),
      };
      const result = chain.submitTransaction(tx);
      if (!result.accepted) return send(res, 400, { error: result.reason });
      persist();
      p2p.broadcastTx(tx);
      send(res, 202, { accepted: true, txId: tx.id });
      return;
    }

    if (req.method === "POST" && parts[0] === "mine") {
      const body = (await readBody(req)) as { minerAddress?: string; maxAttempts?: number };
      if (!body.minerAddress || !isValidAddress(body.minerAddress)) {
        return send(res, 400, { error: "Valid minerAddress required" });
      }
      const maxAttempts = Math.min(body.maxAttempts ?? 5_000_000, 20_000_000);
      const block = chain.mineNextBlock(body.minerAddress, maxAttempts);
      if (!block) {
        return send(res, 408, { error: "No block found within maxAttempts, try again" });
      }
      persist();
      p2p.broadcastBlock(block);
      send(res, 200, { block });
      return;
    }

    send(res, 404, { error: "Not found" });
  } catch (err) {
    send(res, 500, { error: err instanceof Error ? err.message : "Internal error" });
  }
});

server.listen(PORT, () => {
  console.log(`TimeCoin node (${network}) listening on http://localhost:${PORT}`);
  console.log(`Height ${chain.height}, difficulty ${chain.currentDifficulty()}`);
});

if (AUTOMINE_INTERVAL_MS > 0) {
  const automineAddress = process.env.TIMECOIN_AUTOMINE_ADDRESS;
  if (!automineAddress || !isValidAddress(automineAddress)) {
    console.warn("TIMECOIN_AUTOMINE_MS set but TIMECOIN_AUTOMINE_ADDRESS missing/invalid — automine disabled");
  } else {
    setInterval(() => {
      const block = chain.mineNextBlock(automineAddress, 2_000_000);
      if (block) {
        persist();
        p2p.broadcastBlock(block);
        console.log(`Automined block ${block.header.height} (${chain.mempool.length} pending tx)`);
      }
    }, AUTOMINE_INTERVAL_MS);
  }
}
