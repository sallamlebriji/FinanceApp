import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * API base URL. Set EXPO_PUBLIC_API_URL for staging/production builds (HTTPS only).
 * In development it points at the machine running Metro, so a phone on the same Wi-Fi,
 * the iOS simulator, the Android emulator and the web preview all reach the local API.
 */
function devApiUrl(): string {
  if (Platform.OS === 'web') return 'http://localhost:4100/api';
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (host) return `http://${host}:4100/api`;
  return Platform.OS === 'android' ? 'http://10.0.2.2:4100/api' : 'http://localhost:4100/api';
}

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? devApiUrl();
