import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { Block } from "./block.js";
import { bigintReplacer as replacer, bigintReviver as reviver } from "./serialization.js";

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
