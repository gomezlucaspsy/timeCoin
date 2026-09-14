import { sha256d, toHex, fromHex } from "./crypto.js";

/** Bitcoin-style merkle root: pairwise hash256, duplicating the last node on odd levels. */
export function merkleRoot(txIds: string[]): string {
  if (txIds.length === 0) return toHex(sha256d(new Uint8Array()));

  let level = txIds.map(fromHex);
  while (level.length > 1) {
    if (level.length % 2 === 1) level.push(level[level.length - 1]);
    const next: Uint8Array[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const combined = new Uint8Array([...level[i], ...level[i + 1]]);
      next.push(sha256d(combined));
    }
    level = next;
  }

  return toHex(level[0]);
}
