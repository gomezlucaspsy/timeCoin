import type { Block } from "../block.js";
import type { Transaction } from "../transaction.js";
import { bigintReplacer, bigintReviver } from "../serialization.js";

/** Wire messages exchanged between TimeCoin nodes over a plain TCP socket. */
export type P2PMessage =
  | { type: "version"; network: string; height: number; tipHash: string }
  | { type: "verack" }
  | { type: "getchain" }
  | { type: "chain"; blocks: Block[] }
  | { type: "block"; block: Block }
  | { type: "tx"; tx: Transaction }
  | { type: "ping" }
  | { type: "pong" };

/** Newline-delimited JSON framing: one message per line, bigint-safe. */
export function encodeMessage(message: P2PMessage): string {
  return JSON.stringify(message, bigintReplacer) + "\n";
}

export function decodeMessage(line: string): P2PMessage {
  return JSON.parse(line, bigintReviver) as P2PMessage;
}
