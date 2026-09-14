import { sha256d, toHex, sign } from "./crypto";

export interface TxInput {
  txId: string;
  outputIndex: number;
  publicKey: string;
  signature: string;
}

export interface TxOutput {
  address: string;
  amount: bigint;
}

export interface Transaction {
  id: string;
  inputs: TxInput[];
  outputs: TxOutput[];
  isCoinbase: boolean;
  timestamp: number;
}

// Must match apps/blockchain-node/src/transaction.ts's serialization exactly, or
// signatures produced here won't verify against the node's recomputed hash.
function serializeForHash(inputs: TxInput[], outputs: TxOutput[], timestamp: number): Uint8Array {
  const payload = JSON.stringify({
    inputs: inputs.map((i) => ({ txId: i.txId, outputIndex: i.outputIndex })),
    outputs: outputs.map((o) => ({ address: o.address, amount: o.amount.toString() })),
    timestamp,
  });
  return new TextEncoder().encode(payload);
}

export function computeTxId(inputs: TxInput[], outputs: TxOutput[], timestamp: number): string {
  return toHex(sha256d(serializeForHash(inputs, outputs, timestamp)));
}

function signingHash(inputs: TxInput[], outputs: TxOutput[], timestamp: number): Uint8Array {
  return sha256d(serializeForHash(inputs, outputs, timestamp));
}

export function signTransaction(
  inputs: Omit<TxInput, "signature" | "publicKey">[],
  outputs: TxOutput[],
  timestamp: number,
  privateKey: Uint8Array,
  publicKey: Uint8Array,
): Transaction {
  const hash = signingHash(
    inputs.map((i) => ({ ...i, publicKey: "", signature: "" })),
    outputs,
    timestamp,
  );
  const sig = toHex(sign(hash, privateKey));
  const pubHex = toHex(publicKey);
  const signedInputs: TxInput[] = inputs.map((i) => ({ ...i, publicKey: pubHex, signature: sig }));
  const id = computeTxId(signedInputs, outputs, timestamp);
  return { id, inputs: signedInputs, outputs, isCoinbase: false, timestamp };
}
