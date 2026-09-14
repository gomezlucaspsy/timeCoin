import { Capacitor } from "@capacitor/core";
import { NativeBiometric } from "capacitor-native-biometric";

const CREDENTIAL_SERVER = "timecoin.wallet";
const CREDENTIAL_USERNAME = "timecoin";

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

export async function biometricsAvailable(): Promise<boolean> {
  if (!isNativePlatform()) return false;
  try {
    const result = await NativeBiometric.isAvailable();
    return result.isAvailable;
  } catch {
    return false;
  }
}

/** Stores the wallet secret (seed phrase or hex key) in the OS Keychain/Keystore. */
export async function saveWalletSecret(secret: string): Promise<void> {
  await NativeBiometric.setCredentials({
    username: CREDENTIAL_USERNAME,
    password: secret,
    server: CREDENTIAL_SERVER,
  });
}

/** Prompts Face ID / Touch ID / huella, then returns the stored secret. Null if cancelled, unavailable, or nothing stored. */
export async function loadWalletSecret(reason: string): Promise<string | null> {
  try {
    await NativeBiometric.verifyIdentity({
      reason,
      title: "Desbloquear wallet TimeCoin",
    });
  } catch {
    return null;
  }
  try {
    const creds = await NativeBiometric.getCredentials({ server: CREDENTIAL_SERVER });
    return creds.password;
  } catch {
    return null;
  }
}

export async function deleteWalletSecret(): Promise<void> {
  try {
    await NativeBiometric.deleteCredentials({ server: CREDENTIAL_SERVER });
  } catch {
    // nothing was stored
  }
}
