import { generateKeyPair, publicKeyFromPrivate, addressFromPublicKey, toHex, fromHex } from "./crypto";
import { generateSeedPhrase, isValidSeedPhrase, privateKeyFromSeedPhrase } from "./mnemonic";
import { signTransaction, Transaction, TxOutput } from "./transaction";
import type { Utxo } from "./client";

export interface WalletKeys {
  privateKeyHex: string;
  publicKeyHex: string;
  address: string;
  /** Present only for seed-phrase wallets — the recommended backup, not the raw key. */
  seedPhrase?: string;
}

const STORAGE_KEY = "timecoin:wallet:v1";

function keysFromPrivateKey(privateKey: Uint8Array, seedPhrase?: string): WalletKeys {
  const publicKey = publicKeyFromPrivate(privateKey);
  return {
    privateKeyHex: toHex(privateKey),
    publicKeyHex: toHex(publicKey),
    address: addressFromPublicKey(publicKey),
    seedPhrase,
  };
}

/** Legacy path: a bare secp256k1 keypair with no recoverable backup. Kept for imports only. */
export function createWallet(): WalletKeys {
  const { privateKey } = generateKeyPair();
  return keysFromPrivateKey(privateKey);
}

export function walletFromPrivateKey(privateKeyHex: string): WalletKeys {
  return keysFromPrivateKey(fromHex(privateKeyHex));
}

export function walletFromSeedPhrase(seedPhrase: string): WalletKeys {
  return keysFromPrivateKey(privateKeyFromSeedPhrase(seedPhrase), seedPhrase.trim());
}

function persist(wallet: WalletKeys): void {
  const record = wallet.seedPhrase
    ? { seedPhrase: wallet.seedPhrase }
    : { privateKeyHex: wallet.privateKeyHex };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
}

/** localStorage-backed wallet: keys never leave this browser. */
export function loadOrCreateWallet(): WalletKeys {
  if (typeof window === "undefined") {
    // Server-render pass — caller must not act on this until the client effect re-runs.
    return { privateKeyHex: "", publicKeyHex: "", address: "" };
  }
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const record = JSON.parse(saved) as { seedPhrase?: string; privateKeyHex?: string };
      if (record.seedPhrase) return walletFromSeedPhrase(record.seedPhrase);
      if (record.privateKeyHex) return walletFromPrivateKey(record.privateKeyHex);
    } catch {
      // fall through to creating a new one if storage is corrupted
    }
  }
  const wallet = walletFromSeedPhrase(generateSeedPhrase());
  persist(wallet);
  return wallet;
}

/** Accepts either a 12-word seed phrase or (for wallets created before this existed) a raw hex key. */
export function importWallet(input: string): WalletKeys {
  const trimmed = input.trim();
  const wallet = isValidSeedPhrase(trimmed) ? walletFromSeedPhrase(trimmed) : walletFromPrivateKey(trimmed);
  persist(wallet);
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
