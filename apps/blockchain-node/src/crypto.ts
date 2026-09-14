import { sha256 } from "@noble/hashes/sha256";
import { ripemd160 } from "@noble/hashes/ripemd160";
import { hmac } from "@noble/hashes/hmac";
import * as secp from "@noble/secp256k1";

// @noble/secp256k1 v2 needs a sync HMAC wired in explicitly to enable sync sign().
secp.etc.hmacSha256Sync = (key: Uint8Array, ...msgs: Uint8Array[]) =>
  hmac(sha256, key, secp.etc.concatBytes(...msgs));

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function toHex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}

export function fromHex(hex: string): Uint8Array {
  return new Uint8Array(Buffer.from(hex, "hex"));
}

/** Bitcoin's hash256: SHA-256 applied twice. Used for block/tx ids and checksums. */
export function sha256d(data: Uint8Array): Uint8Array {
  return sha256(sha256(data));
}

/** Bitcoin's hash160: RIPEMD-160(SHA-256(x)). Used to compress a pubkey into an address. */
export function hash160(data: Uint8Array): Uint8Array {
  return ripemd160(sha256(data));
}

export function base58Encode(bytes: Uint8Array): string {
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

export function base58Decode(str: string): Uint8Array {
  let num = 0n;
  for (const ch of str) {
    const idx = BASE58_ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error(`Invalid base58 character: ${ch}`);
    num = num * 58n + BigInt(idx);
  }

  let leadingZeros = 0;
  for (const ch of str) {
    if (ch === "1") leadingZeros++;
    else break;
  }

  const bytes: number[] = [];
  while (num > 0n) {
    bytes.unshift(Number(num & 0xffn));
    num >>= 8n;
  }

  return new Uint8Array([...new Array(leadingZeros).fill(0), ...bytes]);
}

export function base58CheckEncode(payload: Uint8Array): string {
  const checksum = sha256d(payload).slice(0, 4);
  return base58Encode(new Uint8Array([...payload, ...checksum]));
}

export function base58CheckDecode(str: string): Uint8Array {
  const full = base58Decode(str);
  const payload = full.slice(0, -4);
  const checksum = full.slice(-4);
  const expected = sha256d(payload).slice(0, 4);
  if (toHex(checksum) !== toHex(expected)) {
    throw new Error("Invalid base58check checksum");
  }
  return payload;
}

const ADDRESS_VERSION_BYTE = 0x1e; // arbitrary, distinct from Bitcoin's 0x00 so addresses look different

export interface KeyPair {
  privateKey: Uint8Array;
  publicKey: Uint8Array; // 33-byte compressed
}

export function generateKeyPair(): KeyPair {
  const privateKey = secp.utils.randomPrivateKey();
  const publicKey = secp.getPublicKey(privateKey, true);
  return { privateKey, publicKey };
}

export function publicKeyFromPrivate(privateKey: Uint8Array): Uint8Array {
  return secp.getPublicKey(privateKey, true);
}

/** Derive a TimeCoin address (Base58Check of hash160(pubkey)), same recipe as a Bitcoin P2PKH address. */
export function addressFromPublicKey(publicKey: Uint8Array): string {
  const h = hash160(publicKey);
  return base58CheckEncode(new Uint8Array([ADDRESS_VERSION_BYTE, ...h]));
}

export function isValidAddress(address: string): boolean {
  try {
    const payload = base58CheckDecode(address);
    return payload.length === 21 && payload[0] === ADDRESS_VERSION_BYTE;
  } catch {
    return false;
  }
}

export function sign(messageHash: Uint8Array, privateKey: Uint8Array): Uint8Array {
  const sig = secp.sign(messageHash, privateKey);
  return sig.toCompactRawBytes();
}

export function verify(
  signature: Uint8Array,
  messageHash: Uint8Array,
  publicKey: Uint8Array,
): boolean {
  try {
    return secp.verify(signature, messageHash, publicKey);
  } catch {
    return false;
  }
}
