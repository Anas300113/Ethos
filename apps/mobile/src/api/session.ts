/**
 * Where the reader token lives.
 *
 * Keychain on iOS, encrypted storage on Android — never AsyncStorage, because the
 * token is the only thing standing between another app on this device and the
 * reader's saved list. If the platform keystore refuses the write (a locked
 * device, a corrupted entry), the app keeps working unsigned rather than
 * crash-looping: saving is a convenience, launching is not optional.
 */
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "ethos.reader.token";

let cached: string | null | undefined;

async function secureRead(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    // Web (and any platform without a keystore) falls back to local storage.
    return await AsyncStorage.getItem(TOKEN_KEY).catch(() => null);
  }
}

async function secureWrite(value: string | null): Promise<void> {
  try {
    if (value === null) await SecureStore.deleteItemAsync(TOKEN_KEY);
    else await SecureStore.setItemAsync(TOKEN_KEY, value);
  } catch {
    await AsyncStorage.setItem(TOKEN_KEY, value ?? "").catch(() => undefined);
  }
}

export async function readReaderToken(): Promise<string | null> {
  if (cached !== undefined) return cached;
  cached = await secureRead();
  return cached;
}

export async function saveReaderToken(token: string): Promise<void> {
  cached = token;
  await secureWrite(token);
}

/** Sign out locally: the server-side profile can also be erased from Settings. */
export async function clearReaderToken(): Promise<void> {
  cached = null;
  await secureWrite(null);
}