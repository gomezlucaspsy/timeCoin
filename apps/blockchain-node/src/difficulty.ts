import { ProtocolParams } from "./constants.js";

/** difficulty 1 == params.maxTarget; higher difficulty == smaller (harder) target, same as Bitcoin. */
export function targetFromDifficulty(difficulty: number, params: ProtocolParams): bigint {
  if (difficulty <= 0) throw new Error("difficulty must be positive");
  const denom = BigInt(Math.round(difficulty * 1_000_000));
  if (denom <= 0n) throw new Error("difficulty too small");
  const target = (params.maxTarget * 1_000_000n) / denom;
  return target > 0n ? target : 1n;
}

export function difficultyFromTarget(target: bigint, params: ProtocolParams): number {
  if (target <= 0n) throw new Error("target must be positive");
  return Number((params.maxTarget * 1_000_000n) / target) / 1_000_000;
}

export function hashMeetsTarget(hashHex: string, target: bigint): boolean {
  return BigInt("0x" + hashHex) <= target;
}

/**
 * Bitcoin-style retarget: compare actual time taken for the last epoch against the
 * expected time, scale difficulty by the ratio, clamp to [1/factor, factor] per adjustment.
 */
export function retargetDifficulty(
  previousDifficulty: number,
  actualEpochSeconds: number,
  params: ProtocolParams,
): number {
  const expected = params.targetBlockTimeSeconds * params.difficultyAdjustmentIntervalBlocks;
  const actual = Math.max(actualEpochSeconds, 1);
  let ratio = expected / actual;
  ratio = Math.min(params.maxDifficultyAdjustmentFactor, Math.max(1 / params.maxDifficultyAdjustmentFactor, ratio));
  const next = previousDifficulty * ratio;
  return Math.max(next, 1e-9);
}
