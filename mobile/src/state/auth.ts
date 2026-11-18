/** Auth session store: the single source of "who is signed in" for guards
 * and screens. Loading covers the secure-store restore on cold start. */
import { create } from 'zustand';

import { api } from '../lib/api';
import type { User } from '../lib/types';

interface AuthState {
  status: 'restoring' | 'signed-out' | 'signed-in';
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (fullName: string, email: string, phoneNumber: string, password: string) => Promise<string>;
  restore: () => Promise<void>;
  refreshUser: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  status: 'restoring',
  user: null,

  restore: async () => {
    const hadSession = await api.restoreSession();
    if (!hadSession) {
      set({ status: 'signed-out', user: null });
      return;
    }
    try {
      const user = await api.me();
      set({ status: 'signed-in', user });
    } catch {
      // A 401 after refresh failure clears the session inside the client.
      set(api.isAuthenticated ? { status: 'signed-in', user: null } : { status: 'signed-out', user: null });
    }
  },

  refreshUser: async () => {
    const user = await api.me();
    set({ user });
  },

  signIn: async (email, password) => {
    const response = await api.login(email, password);
    const user = response.user ?? await api.me();
    set({ status: 'signed-in', user });
  },

  signUp: async (fullName, email, phoneNumber, password) => {
    const response = await api.register(fullName, email, phoneNumber, password);
    // Registration returns a verification notice, not tokens: the learner
    // verifies by email link, then signs in.
    return response.detail ?? 'Account created. Verify your email, then sign in.';
  },

  signOut: async () => {
    await api.logout();
    set({ status: 'signed-out', user: null });
  },
}));
