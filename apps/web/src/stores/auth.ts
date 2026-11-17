import type { AuthResponse, SettingsDTO, UserDTO } from '@mizan/shared';
import { create } from 'zustand';

type Status = 'loading' | 'authenticated' | 'anonymous';

interface AuthState {
  status: Status;
  /** Kept in memory only — never persisted to storage. */
  accessToken: string | null;
  user: UserDTO | null;
  settings: SettingsDTO | null;
  setSession(r: Pick<AuthResponse, 'accessToken' | 'user' | 'settings'>): void;
  setUser(u: UserDTO): void;
  setSettings(s: SettingsDTO): void;
  clear(): void;
}

export const useAuth = create<AuthState>((set) => ({
  status: 'loading',
  accessToken: null,
  user: null,
  settings: null,
  setSession: (r) => set({ status: 'authenticated', accessToken: r.accessToken, user: r.user, settings: r.settings }),
  setUser: (user) => set({ user }),
  setSettings: (settings) => set({ settings }),
  clear: () => set({ status: 'anonymous', accessToken: null, user: null, settings: null }),
}));
