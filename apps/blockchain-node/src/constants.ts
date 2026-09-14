// TimeCoin protocol constants — same fundamentals as Bitcoin, different label.
// Two network profiles, same idea as Bitcoin mainnet vs regtest: mainnet uses
// Bitcoin's real numbers, devnet compresses time so the chain is testable locally.

export type Network = "mainnet" | "devnet";

export interface ProtocolParams {
  /** Smallest unit name, like Bitcoin's "satoshi". 1 TIME = 10^8 timeoshi. */
  readonly unitsPerCoin: bigint;
  /** Total coins that will ever exist (21,000,000 TIME, same cap as Bitcoin). */
  readonly maxSupplyCoins: number;
  /** Block reward for the first halving epoch, in whole coins. */
  readonly initialRewardCoins: number;
  /** Blocks between reward halvings (Bitcoin: 210,000). */
  readonly halvingIntervalBlocks: number;
  /** Target seconds between blocks (Bitcoin: 600 = 10 minutes). */
  readonly targetBlockTimeSeconds: number;
  /** Blocks between difficulty retargets (Bitcoin: 2016, ~2 weeks at 10 min/block). */
  readonly difficultyAdjustmentIntervalBlocks: number;
  /** Starting difficulty (1 = easiest target, matches genesis). */
  readonly initialDifficulty: number;
  /** Max fraction a single retarget may move the difficulty, in either direction (Bitcoin: 4x). */
  readonly maxDifficultyAdjustmentFactor: number;
  /** Number of confirmations before a coinbase output is spendable (Bitcoin: 100). */
  readonly coinbaseMaturityBlocks: number;
  /** The target for difficulty 1 on this network — see MAX_TARGET doc for why devnet differs from mainnet. */
  readonly maxTarget: bigint;
  /**
   * Bitcoin testnet's anti-stall rule: if no block lands within 2x the target
   * spacing, the next block may be mined at minimum difficulty regardless of
   * the scheduled retarget. Keeps a low-hashrate test network from freezing.
   * Real Bitcoin mainnet has no such exception.
   */
  readonly allowMinDifficultyOnStall: boolean;
}

/**
 * Bitcoin's real genesis target: top 32 bits zero, i.e. 2^224 - 1 (224 one-bits).
 * Difficulty 1 against this target still costs ~2^32 hashes on average — realistic for
 * mainnet fidelity, but far too slow for a laptop devnet, so devnet gets an easier one below.
 * Built with a bit-shift rather than a hand-typed hex literal so the bit count can't drift.
 */
const MAINNET_MAX_TARGET = (1n << 224n) - 1n;

/** Top 16 bits zero — ~2^16 expected hashes at difficulty 1, mines in well under a second. */
const DEVNET_MAX_TARGET = (1n << 240n) - 1n;

const MAINNET: ProtocolParams = {
  unitsPerCoin: 100_000_000n,
  maxSupplyCoins: 21_000_000,
  initialRewardCoins: 50,
  halvingIntervalBlocks: 210_000,
  targetBlockTimeSeconds: 600,
  difficultyAdjustmentIntervalBlocks: 2016,
  initialDifficulty: 1,
  maxDifficultyAdjustmentFactor: 4,
  coinbaseMaturityBlocks: 100,
  maxTarget: MAINNET_MAX_TARGET,
  allowMinDifficultyOnStall: false,
};

// Devnet: identical curve shape (halving, retarget, 21M cap), compressed ~1000x
// so a laptop CPU can mine through several halvings in a demo session.
const DEVNET: ProtocolParams = {
  unitsPerCoin: 100_000_000n,
  maxSupplyCoins: 21_000_000,
  initialRewardCoins: 50,
  halvingIntervalBlocks: 64,
  targetBlockTimeSeconds: 5,
  difficultyAdjustmentIntervalBlocks: 16,
  initialDifficulty: 1,
  maxDifficultyAdjustmentFactor: 4,
  coinbaseMaturityBlocks: 5,
  maxTarget: DEVNET_MAX_TARGET,
  allowMinDifficultyOnStall: true,
};

export const NETWORKS: Record<Network, ProtocolParams> = {
  mainnet: MAINNET,
  devnet: DEVNET,
};

export function getNetwork(): Network {
  const env = (process.env.TIMECOIN_NETWORK ?? "devnet").toLowerCase();
  if (env === "mainnet" || env === "devnet") return env;
  throw new Error(`Unknown TIMECOIN_NETWORK "${env}", expected "mainnet" or "devnet"`);
}

export function getParams(network: Network = getNetwork()): ProtocolParams {
  return NETWORKS[network];
}

export const COINBASE_PREFIX = "TIMECOIN-COINBASE";
