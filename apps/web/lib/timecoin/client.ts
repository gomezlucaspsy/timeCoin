import type { Transaction } from "./transaction";

const NODE_URL = process.env.NEXT_PUBLIC_TIMECOIN_NODE_URL ?? "http://localhost:3001";

export interface NodeStatus {
  network: string;
  height: number;
  tipHash: string;
  difficulty: number;
  nextBlockReward: string;
  circulatingSupply: string;
  maxSupply: string;
  unitsPerCoin: string;
  halvingIntervalBlocks: number;
  targetBlockTimeSeconds: number;
  mempoolSize: number;
}

export interface Utxo {
  txId: string;
  outputIndex: number;
  address: string;
  amount: bigint;
  blockHeight: number;
  isCoinbase: boolean;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${NODE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `Node request failed (${res.status})`);
  return body as T;
}

export async function getStatus(): Promise<NodeStatus> {
  return request<NodeStatus>("/status");
}

export async function getBalance(address: string): Promise<bigint> {
  const body = await request<{ balance: string }>(`/balance/${address}`);
  return BigInt(body.balance);
}

export interface BalanceInfo {
  spendable: bigint;
  /** Mined rewards still locked behind coinbase maturity — not yet spendable. */
  pending: bigint;
  pendingMaturesInBlocks: number | null;
}

export async function getBalanceInfo(address: string): Promise<BalanceInfo> {
  const body = await request<{ balance: string; pending?: string; pendingMaturesInBlocks?: number | null }>(
    `/balance/${address}`,
  );
  // pending/pendingMaturesInBlocks are absent if the node hasn't been redeployed yet.
  return {
    spendable: BigInt(body.balance),
    pending: body.pending ? BigInt(body.pending) : 0n,
    pendingMaturesInBlocks: body.pendingMaturesInBlocks ?? null,
  };
}

export async function getUtxos(address: string): Promise<Utxo[]> {
  const body = await request<{ utxos: Array<Omit<Utxo, "amount"> & { amount: string }> }>(`/utxos/${address}`);
  return body.utxos.map((u) => ({ ...u, amount: BigInt(u.amount) }));
}

export async function submitTransaction(tx: Transaction): Promise<{ accepted: true; txId: string }> {
  return request("/tx", {
    method: "POST",
    body: JSON.stringify({ ...tx, outputs: tx.outputs.map((o) => ({ address: o.address, amount: o.amount.toString() })) }),
  });
}

export interface MineResultBlock {
  header: { height: number; timestamp: number; difficulty: number; nonce: number };
  hash: string;
}

export async function mineBlock(minerAddress: string, maxAttempts?: number): Promise<MineResultBlock> {
  const body = await request<{ block: MineResultBlock }>("/mine", {
    method: "POST",
    body: JSON.stringify({ minerAddress, maxAttempts }),
  });
  return body.block;
}
