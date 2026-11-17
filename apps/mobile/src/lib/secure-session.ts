import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * The refresh token is the only long-lived secret on the device. On iOS/Android it lives in
 * the Keychain / Keystore via SecureStore, readable only while the device is unlocked. The
 * web preview has no secure storage, so it keeps the token in memory (sign in again after a
 * reload) rather than writing it to localStorage.
 */
const KEY = 'mizan.refreshToken';
let memory: string | null = null;
const native = Platform.OS === 'ios' || Platform.OS === 'android';

export async function readRefreshToken(): Promise<string | null> {
  if (!native) return memory;
  try {
    return await SecureStore.getItemAsync(KEY);
  } catch {
    return null;
  }
}

export async function writeRefreshToken(token: string | null): Promise<void> {
  if (!native) {
    memory = token;
    return;
  }
  if (token) await SecureStore.setItemAsync(KEY, token, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  else await SecureStore.deleteItemAsync(KEY);
}
