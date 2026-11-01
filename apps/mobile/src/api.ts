import { createApiClient } from '@kleps/api-client';
import type { AuthResponse } from '@kleps/shared';
import * as SecureStoreNative from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * SecureStore has no web implementation. On web (development preview only) tokens are kept in memory
 * and never written to localStorage; native builds use the iOS Keychain / Android Keystore.
 */
const memory = new Map<string, string>();
const SecureStore =
  Platform.OS === 'web'
    ? {
        getItemAsync: async (k: string) => memory.get(k) ?? null,
        setItemAsync: async (k: string, v: string) => void memory.set(k, v),
        deleteItemAsync: async (k: string) => void memory.delete(k),
      }
    : SecureStoreNative;

/** Must be reachable from the device (Android emulator: http://10.0.2.2:4000, device: LAN IP). */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');

const ACCESS_KEY = 'kleps.accessToken';
const REFRESH_KEY = 'kleps.refreshToken';

let accessToken: string | null = null;
let refreshInFlight: Promise<boolean> | null = null;
let onSignedOut: (() => void) | null = null;

export function setSignedOutHandler(fn: () => void): void {
  onSignedOut = fn;
}

export async function loadStoredTokens(): Promise<boolean> {
  accessToken = await SecureStore.getItemAsync(ACCESS_KEY);
  return accessToken !== null || (await SecureStore.getItemAsync(REFRESH_KEY)) !== null;
}

/** Tokens live in the OS keychain/keystore via SecureStore, never in AsyncStorage. */
export async function storeTokens(auth: AuthResponse): Promise<void> {
  accessToken = auth.accessToken;
  await SecureStore.setItemAsync(ACCESS_KEY, auth.accessToken);
  await SecureStore.setItemAsync(REFRESH_KEY, auth.refreshToken);
}

export async function clearTokens(): Promise<void> {
  accessToken = null;
  await SecureStore.deleteItemAsync(ACCESS_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_KEY);
}

/** Single in-flight refresh shared by concurrent requests (refresh tokens are single-use). */
async function refresh(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const token = await SecureStore.getItemAsync(REFRESH_KEY);
      if (!token) return false;
      try {
        const auth = await anonymous.auth.refresh(token);
        await storeTokens(auth);
        return true;
      } catch {
        await clearTokens();
        onSignedOut?.();
        return false;
      }
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

const anonymous = createApiClient({ baseUrl: API_URL });

export const api = createApiClient({
  baseUrl: API_URL,
  getAccessToken: () => accessToken,
  onUnauthorized: refresh,
});
