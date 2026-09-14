import { sha256d, toHex } from "./crypto.js";
import { merkleRoot } from "./merkle.js";
import { hashMeetsTarget } from "./difficulty.js";
import type { Transaction } from "./transaction.js";

export interface BlockHeader {
  height: number;
  previousHash: string;
  merkleRoot: string;
  timestamp: number;
  difficulty: number;
  nonce: number;
}

export interface Block {
  header: BlockHeader;
  hash: string;
  transactions: Transaction[];
}

function serializeHeader(header: BlockHeader): Uint8Array {
  const payload = JSON.stringify({
    height: header.height,
    previousHash: header.previousHash,
    merkleRoot: header.merkleRoot,
    timestamp: header.timestamp,
    difficulty: header.difficulty,
    nonce: header.nonce,
  });
  return new TextEncoder().encode(payload);
}

export function hashHeader(header: BlockHeader): string {
  return toHex(sha256d(serializeHeader(header)));
}

export function buildBlockTemplate(
  height: number,
  previousHash: string,
  transactions: Transaction[],
  difficulty: number,
  timestamp: number = Date.now(),
): Omit<BlockHeader, "nonce"> {
  return {
    height,
    previousHash,
    merkleRoot: merkleRoot(transactions.map((t) => t.id)),
    timestamp,
    difficulty,
  };
}

export interface MineResult {
  block: Block;
  attempts: number;
  elapsedMs: number;
}

/**
 * Brute-force nonce search: the actual "mining" — hash the header repeatedly until
 * the hash is numerically <= the difficulty target. Same loop Bitcoin miners run.
 */
export function mineBlock(
  template: Omit<BlockHeader, "nonce">,
  transactions: Transaction[],
  target: bigint,
  options: { maxAttempts?: number; startNonce?: number } = {},
): MineResult | null {
  const start = Date.now();
  const maxAttempts = options.maxAttempts ?? Number.MAX_SAFE_INTEGER;
  let nonce = options.startNonce ?? 0;
  let attempts = 0;

  while (attempts < maxAttempts) {
    const header: BlockHeader = { ...template, nonce };
    const hash = hashHeader(header);
    attempts++;
    if (hashMeetsTarget(hash, target)) {
      return {
        block: { header, hash, transactions },
        attempts,
        elapsedMs: Date.now() - start,
      };
    }
    nonce++;
  }

  return null;
}

export function isBlockHashValid(block: Block): boolean {
  return hashHeader(block.header) === block.hash;
}
