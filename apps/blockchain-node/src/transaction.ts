import { sha256d, toHex, fromHex, sign, verify, addressFromPublicKey } from "./crypto.js";

/** A reference to a specific output of a previous transaction — Bitcoin's UTXO pointer. */
export interface TxInput {
  txId: string;
  outputIndex: number;
  /** Compressed pubkey of the spender, included so verifiers can check it hashes to the output's address. */
  publicKey: string; // hex
  /** Signature over the spending transaction's signing hash. Empty until signed. */
  signature: string; // hex
}

export interface TxOutput {
  address: string;
  amount: bigint; // in the smallest unit (timeoshi)
}

export interface Transaction {
  id: string; // txid = sha256d(serialized inputs+outputs), set after construction
  inputs: TxInput[];
  outputs: TxOutput[];
  /** true for the single reward transaction a miner includes in each block. */
  isCoinbase: boolean;
  timestamp: number;
}

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

/** The hash each input's signature actually signs: the txid before signatures exist. */
export function signingHash(inputs: TxInput[], outputs: TxOutput[], timestamp: number): Uint8Array {
  return sha256d(serializeForHash(inputs, outputs, timestamp));
}

export function buildCoinbaseTx(
  toAddress: string,
  rewardPlusFees: bigint,
  timestamp: number,
  blockHeight: number,
): Transaction {
  const inputs: TxInput[] = [
    {
      // Coinbase inputs don't reference a real UTXO — Bitcoin uses the block height here
      // (BIP34) so two coinbase txs at different heights never collide.
      txId: "0".repeat(64),
      outputIndex: blockHeight,
      publicKey: "",
      signature: "",
    },
  ];
  const outputs: TxOutput[] = [{ address: toAddress, amount: rewardPlusFees }];
  const id = computeTxId(inputs, outputs, timestamp);
  return { id, inputs, outputs, isCoinbase: true, timestamp };
}

export interface UnsignedTransfer {
  inputs: Omit<TxInput, "signature" | "publicKey">[];
  outputs: TxOutput[];
  timestamp: number;
}

/**
 * Sign a transfer client-side: every input is signed with the same private key
 * (single-sender transactions only, like a simple Bitcoin wallet spend).
 */
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

/** Verifies every input's signature and that its pubkey hashes to the UTXO's owning address. */
export function verifyTransactionSignatures(
  tx: Transaction,
  resolveOutputAddress: (txId: string, outputIndex: number) => string | undefined,
): { valid: boolean; reason?: string } {
  if (tx.isCoinbase) return { valid: true };

  const hash = signingHash(
    tx.inputs.map((i) => ({ ...i, publicKey: "", signature: "" })),
    tx.outputs,
    tx.timestamp,
  );

  for (const input of tx.inputs) {
    const owningAddress = resolveOutputAddress(input.txId, input.outputIndex);
    if (!owningAddress) return { valid: false, reason: `Unknown or spent UTXO ${input.txId}:${input.outputIndex}` };

    const pubKeyBytes = fromHex(input.publicKey);
    if (addressFromPublicKey(pubKeyBytes) !== owningAddress) {
      return { valid: false, reason: "Public key does not match UTXO owner address" };
    }
    if (!verify(fromHex(input.signature), hash, pubKeyBytes)) {
      return { valid: false, reason: "Invalid signature" };
    }
  }

  return { valid: true };
}
