// BIP-39 seed phrase (Spanish wordlist) + BIP-32 derivation, so backing up a
// wallet means writing down 12 words instead of a raw hex private key. This
// is the same recipe every major crypto wallet uses to cut down on lost-key
// friction — no server, no third party, still fully self-custodial.
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/spanish.js";
import { HDKey } from "@scure/bip32";

// 44'/1776'/0'/0/0 — standard BIP-44 shape; 1776 is an arbitrary, unregistered
// coin type (TimeCoin isn't in SLIP-44) used only to namespace this derivation.
const DERIVATION_PATH = "m/44'/1776'/0'/0/0";

export function generateSeedPhrase(): string {
  return generateMnemonic(wordlist, 128); // 128 bits of entropy -> 12 words
}

export function isValidSeedPhrase(phrase: string): boolean {
  return validateMnemonic(normalize(phrase), wordlist);
}

export function privateKeyFromSeedPhrase(phrase: string): Uint8Array {
  const seed = mnemonicToSeedSync(normalize(phrase));
  const child = HDKey.fromMasterSeed(seed).derive(DERIVATION_PATH);
  if (!child.privateKey) throw new Error("No se pudo derivar la clave privada de la frase semilla");
  return child.privateKey;
}

function normalize(phrase: string): string {
  return phrase.trim().toLowerCase().replace(/\s+/g, " ");
}
