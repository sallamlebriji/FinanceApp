import type { AuthResponse, SettingsDTO, UserDTO } from '@mizan/shared';
import { create } from 'zustand';

type Status = 'restoring' | 'signedIn' | 'signedOut';

interface AuthState {
  status: Status;
  user: UserDTO | null;
  settings: SettingsDTO | null;
  /** Short-lived access token — kept in memory only. */
  accessToken: string | null;
  setSession: (r: AuthResponse) => void;
  setUser: (u: UserDTO) => void;
  setSettings: (s: SettingsDTO) => void;
  clear: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  status: 'restoring',
  user: null,
  settings: null,
  accessToken: null,
  setSession: (r) => set({ status: 'signedIn', user: r.user, settings: r.settings, accessToken: r.accessToken }),
  setUser: (user) => set({ user }),
  setSettings: (settings) => set({ settings }),
  clear: () => set({ status: 'signedOut', user: null, settings: null, accessToken: null }),
}));
