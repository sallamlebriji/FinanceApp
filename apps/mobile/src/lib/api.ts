import type { ApiErrorBody, AuthResponse } from '@mizan/shared';
import { useAuth } from '@/stores/auth';
import { API_URL } from './config';
import { readRefreshToken, writeRefreshToken } from './secure-session';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

/** Native clients receive the refresh token in the body (no cookies) and keep it in SecureStore. */
const NATIVE = { 'X-Client-Platform': 'native' } as const;

let refreshing: Promise<boolean> | null = null;

async function storeSession(body: AuthResponse) {
  if (body.refreshToken) await writeRefreshToken(body.refreshToken);
  useAuth.getState().setSession(body);
}

/**
 * Rotates the refresh token for a new access token. Concurrent callers share one request so a
 * token is never presented twice (the API treats a replayed token as theft and revokes the
 * whole session).
 */
export function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const refreshToken = await readRefreshToken();
      if (!refreshToken) {
        useAuth.getState().clear();
        return false;
      }
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { ...NATIVE, 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        // Expired or revoked: forget it. A server error keeps it so the next launch can retry.
        if (res.status === 401 || res.status === 403) await writeRefreshToken(null);
        useAuth.getState().clear();
        return false;
      }
      await storeSession((await res.json()) as AuthResponse);
      return true;
    } catch {
      useAuth.getState().clear();
      return false;
    } finally {
      setTimeout(() => (refreshing = null), 0);
    }
  })();
  return refreshing;
}

async function parseError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as ApiErrorBody;
    return new ApiError(res.status, body.error.code, body.error.message, body.error.details);
  } catch {
    return new ApiError(res.status, 'NETWORK', res.status >= 500 ? 'The server is unavailable. Try again shortly.' : 'Request failed');
  }
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}, retry = true): Promise<T> {
  const { json, headers, ...rest } = init;
  const token = useAuth.getState().accessToken;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...rest,
      headers: {
        ...NATIVE,
        ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(headers as Record<string, string> | undefined),
      },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new ApiError(0, 'OFFLINE', "Can't reach Mizan. Check your connection.");
  }
  if (res.status === 401 && retry && !path.startsWith('/auth/login') && !path.startsWith('/auth/register')) {
    if (await refreshSession()) return api<T>(path, init, false);
  }
  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function signIn(email: string, password: string) {
  await storeSession(await api<AuthResponse>('/auth/login', { method: 'POST', json: { email, password } }));
}

export async function register(name: string, email: string, password: string) {
  await storeSession(await api<AuthResponse>('/auth/register', { method: 'POST', json: { name, email, password } }));
}

export async function signOut() {
  const refreshToken = await readRefreshToken();
  try {
    await api<void>('/auth/logout', { method: 'POST', json: { refreshToken } }, false);
  } catch {
    /* sign out locally even if the server can't be reached */
  }
  await forgetSession();
}

/** After a server-side action that ends every session (sign out everywhere, delete account). */
export async function forgetSession() {
  await writeRefreshToken(null);
  useAuth.getState().clear();
}

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');
