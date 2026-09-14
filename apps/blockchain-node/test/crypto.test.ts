import { describe, it, expect } from "vitest";
import { generateKeyPair, addressFromPublicKey, isValidAddress, sign, verify, sha256d } from "../src/crypto.js";

describe("crypto", () => {
  it("derives a valid address from a fresh keypair", () => {
    const { publicKey } = generateKeyPair();
    const address = addressFromPublicKey(publicKey);
    expect(isValidAddress(address)).toBe(true);
  });

  it("rejects a tampered address checksum", () => {
    const { publicKey } = generateKeyPair();
    const address = addressFromPublicKey(publicKey);
    const tampered = address.slice(0, -1) + (address.at(-1) === "1" ? "2" : "1");
    expect(isValidAddress(tampered)).toBe(false);
  });

  it("signs and verifies a message hash", () => {
    const { privateKey, publicKey } = generateKeyPair();
    const hash = sha256d(new TextEncoder().encode("hello timecoin"));
    const sig = sign(hash, privateKey);
    expect(verify(sig, hash, publicKey)).toBe(true);
  });

  it("rejects a signature from the wrong key", () => {
    const a = generateKeyPair();
    const b = generateKeyPair();
    const hash = sha256d(new TextEncoder().encode("hello timecoin"));
    const sig = sign(hash, a.privateKey);
    expect(verify(sig, hash, b.publicKey)).toBe(false);
  });
});
