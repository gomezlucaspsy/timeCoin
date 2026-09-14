import { generateKeyPair, publicKeyFromPrivate, addressFromPublicKey, toHex, fromHex } from "./crypto";
import { signTransaction, Transaction, TxOutput } from "./transaction";
import type { Utxo } from "./client";

export interface WalletKeys {
  privateKeyHex: string;
  publicKeyHex: string;
  address: string;
}

const STORAGE_KEY = "timecoin:wallet:v1";

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

/** localStorage-backed wallet: private key never leaves this browser. */
export function loadOrCreateWallet(): WalletKeys {
  if (typeof window === "undefined") {
    // Server-render pass — caller must not act on this until the client effect re-runs.
    return { privateKeyHex: "", publicKeyHex: "", address: "" };
  }
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      return walletFromPrivateKey(JSON.parse(saved).privateKeyHex);
    } catch {
      // fall through to creating a new one if storage is corrupted
    }
  }
  const wallet = createWallet();
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ privateKeyHex: wallet.privateKeyHex }));
  return wallet;
}

export function importWallet(privateKeyHex: string): WalletKeys {
  const wallet = walletFromPrivateKey(privateKeyHex);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ privateKeyHex: wallet.privateKeyHex }));
  return wallet;
}

export function buildTransfer(
  wallet: WalletKeys,
  spendableUtxos: Utxo[],
  toAddress: string,
  amount: bigint,
): Transaction {
  if (amount <= 0n) throw new Error("El monto debe ser positivo");

  const sorted = [...spendableUtxos].sort((a, b) => a.blockHeight - b.blockHeight);
  const chosen: Utxo[] = [];
  let total = 0n;

  for (const utxo of sorted) {
    chosen.push(utxo);
    total += utxo.amount;
    if (total >= amount) break;
  }

  if (total < amount) {
    throw new Error(`Saldo insuficiente: tenés ${total}, necesitás ${amount}`);
  }

  const outputs: TxOutput[] = [{ address: toAddress, amount }];
  const change = total - amount;
  if (change > 0n) outputs.push({ address: wallet.address, amount: change });

  const inputs = chosen.map((u) => ({ txId: u.txId, outputIndex: u.outputIndex }));
  const timestamp = Date.now();

  return signTransaction(inputs, outputs, timestamp, fromHex(wallet.privateKeyHex), fromHex(wallet.publicKeyHex));
}
