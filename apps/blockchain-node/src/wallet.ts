import { generateKeyPair, publicKeyFromPrivate, addressFromPublicKey, toHex, fromHex } from "./crypto.js";
import { signTransaction, Transaction, TxOutput } from "./transaction.js";
import type { UtxoEntry, UtxoKey } from "./blockchain.js";

export interface WalletKeys {
  privateKeyHex: string;
  publicKeyHex: string;
  address: string;
}

export function createWallet(): WalletKeys {
  const { privateKey, publicKey } = generateKeyPair();
  return {
    privateKeyHex: toHex(privateKey),
    publicKeyHex: toHex(publicKey),
    address: addressFromPublicKey(publicKey),
  };
}

export function walletFromPrivateKey(privateKeyHex: string): WalletKeys {
  const privateKey = fromHex(privateKeyHex);
  const publicKey = publicKeyFromPrivate(privateKey);
  return { privateKeyHex, publicKeyHex: toHex(publicKey), address: addressFromPublicKey(publicKey) };
}

export interface BuildTransferResult {
  transaction: Transaction;
}

/** Simple coin selection: take UTXOs oldest-first until the amount is covered, send change back to self. */
export function buildTransfer(
  wallet: WalletKeys,
  spendableUtxos: Array<UtxoEntry & UtxoKey>,
  toAddress: string,
  amount: bigint,
  feePerByteEstimate = 0n, // devnet keeps fees at zero; kept as a param for a future fee market
): BuildTransferResult {
  if (amount <= 0n) throw new Error("Amount must be positive");

  const sorted = [...spendableUtxos].sort((a, b) => a.blockHeight - b.blockHeight);
  const chosen: Array<UtxoEntry & UtxoKey> = [];
  let total = 0n;
  const fee = feePerByteEstimate;

  for (const utxo of sorted) {
    chosen.push(utxo);
    total += utxo.amount;
    if (total >= amount + fee) break;
  }

  if (total < amount + fee) {
    throw new Error(`Insufficient balance: have ${total}, need ${amount + fee}`);
  }

  const outputs: TxOutput[] = [{ address: toAddress, amount }];
  const change = total - amount - fee;
  if (change > 0n) outputs.push({ address: wallet.address, amount: change });

  const inputs = chosen.map((u) => ({ txId: u.txId, outputIndex: u.outputIndex }));
  const timestamp = Date.now();

  const transaction = signTransaction(
    inputs,
    outputs,
    timestamp,
    fromHex(wallet.privateKeyHex),
    fromHex(wallet.publicKeyHex),
  );

  return { transaction };
}
