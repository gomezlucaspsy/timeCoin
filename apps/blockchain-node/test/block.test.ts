import { describe, it, expect } from "vitest";
import { buildBlockTemplate, mineBlock, isBlockHashValid, hashHeader } from "../src/block.js";
import { targetFromDifficulty, hashMeetsTarget } from "../src/difficulty.js";
import { buildCoinbaseTx } from "../src/transaction.js";
import { getParams } from "../src/constants.js";

describe("proof of work", () => {
  it("mines a block whose hash meets an easy target", () => {
    const coinbase = buildCoinbaseTx("1TestAddress", 5000n, 0, 1);
    const template = buildBlockTemplate(1, "0".repeat(64), [coinbase], 0.001, 0);
    const target = targetFromDifficulty(0.001, getParams("devnet"));
    const result = mineBlock(template, [coinbase], target, { maxAttempts: 1_000_000 });
    expect(result).not.toBeNull();
    expect(hashMeetsTarget(result!.block.hash, target)).toBe(true);
    expect(isBlockHashValid(result!.block)).toBe(true);
  });

  it("fails to find a block within too few attempts at a hard target", () => {
    const coinbase = buildCoinbaseTx("1TestAddress", 5000n, 0, 1);
    const template = buildBlockTemplate(1, "0".repeat(64), [coinbase], 5_000_000, 0);
    const target = targetFromDifficulty(5_000_000, getParams("devnet"));
    const result = mineBlock(template, [coinbase], target, { maxAttempts: 50 });
    expect(result).toBeNull();
  });

  it("hashHeader is deterministic for identical headers", () => {
    const header = { height: 1, previousHash: "0".repeat(64), merkleRoot: "ab", timestamp: 123, difficulty: 1, nonce: 7 };
    expect(hashHeader(header)).toBe(hashHeader({ ...header }));
  });

  it("changing the nonce changes the hash (avalanche, not verified bit-for-bit)", () => {
    const header = { height: 1, previousHash: "0".repeat(64), merkleRoot: "ab", timestamp: 123, difficulty: 1, nonce: 7 };
    expect(hashHeader(header)).not.toBe(hashHeader({ ...header, nonce: 8 }));
  });
});
