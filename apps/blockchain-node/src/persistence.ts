import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { Block } from "./block.js";

// bigint amounts are serialized as `${n}n` strings so JSON round-trips exactly.
function replacer(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? `${value.toString()}n` : value;
}

function reviver(_key: string, value: unknown): unknown {
  if (typeof value === "string" && /^-?\d+n$/.test(value)) {
    return BigInt(value.slice(0, -1));
  }
  return value;
}

export interface ChainSnapshot {
  network: string;
  chain: Block[];
}

export function saveSnapshot(path: string, snapshot: ChainSnapshot): void {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify(snapshot, replacer, 2), "utf-8");
}

export function loadSnapshot(path: string): ChainSnapshot | null {
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, "utf-8");
  return JSON.parse(raw, reviver) as ChainSnapshot;
}
