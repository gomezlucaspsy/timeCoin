// Shared JSON codec for anything that crosses a process boundary (disk snapshot, P2P wire
// messages): bigint amounts are serialized as `${n}n` strings so JSON round-trips exactly.
export function bigintReplacer(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? `${value.toString()}n` : value;
}

export function bigintReviver(_key: string, value: unknown): unknown {
  if (typeof value === "string" && /^-?\d+n$/.test(value)) {
    return BigInt(value.slice(0, -1));
  }
  return value;
}
