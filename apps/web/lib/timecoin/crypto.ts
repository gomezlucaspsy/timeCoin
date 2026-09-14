// Browser-side mirror of apps/blockchain-node/src/crypto.ts — same recipes (secp256k1,
// hash160, Base58Check) so client-generated addresses/signatures are valid on the node.
// Kept Buffer-free since this runs in the browser, not Node.

import { sha256 } from "@noble/hashes/sha256";
import { ripemd160 } from "@noble/hashes/ripemd160";
import { hmac } from "@noble/hashes/hmac";
import * as secp from "@noble/secp256k1";

secp.etc.hmacSha256Sync = (key: Uint8Array, ...msgs: Uint8Array[]) =>
  hmac(sha256, key, secp.etc.concatBytes(...msgs));

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const ADDRESS_VERSION_BYTE = 0x1e;

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function fromHex(hex: string): Uint8Array {
  const clean = hex.trim();
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}

export function sha256d(data: Uint8Array): Uint8Array {
  return sha256(sha256(data));
}

export function hash160(data: Uint8Array): Uint8Array {
  return ripemd160(sha256(data));
}

function base58Encode(bytes: Uint8Array): string {
  let leadingZeros = 0;
  for (const b of bytes) {
    if (b === 0) leadingZeros++;
    else break;
  }

  let num = 0n;
  for (const b of bytes) num = (num << 8n) | BigInt(b);

  let out = "";
  while (num > 0n) {
    const rem = num % 58n;
    num /= 58n;
    out = BASE58_ALPHABET[Number(rem)] + out;
  }

  return "1".repeat(leadingZeros) + out;
}

function base58CheckEncode(payload: Uint8Array): string {
  const checksum = sha256d(payload).slice(0, 4);
  return base58Encode(new Uint8Array([...payload, ...checksum]));
}

export interface KeyPair {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
}

export function generateKeyPair(): KeyPair {
  const privateKey = secp.utils.randomPrivateKey();
  const publicKey = secp.getPublicKey(privateKey, true);
  return { privateKey, publicKey };
}

export function publicKeyFromPrivate(privateKey: Uint8Array): Uint8Array {
  return secp.getPublicKey(privateKey, true);
}

export function addressFromPublicKey(publicKey: Uint8Array): string {
  const h = hash160(publicKey);
  return base58CheckEncode(new Uint8Array([ADDRESS_VERSION_BYTE, ...h]));
}

export function sign(messageHash: Uint8Array, privateKey: Uint8Array): Uint8Array {
  return secp.sign(messageHash, privateKey).toCompactRawBytes();
}
