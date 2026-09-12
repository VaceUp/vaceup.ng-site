'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from 'react';
import { api, ApiError, AuthResponse, RegisterResponse, User } from '@/lib/api';

interface AuthContextType {
  // Modal state (used by marketing CTAs)
  isOpen: boolean;
  mode: 'signin' | 'signup';
  openAuth: (mode: 'signin' | 'signup') => void;
  closeAuth: () => void;

  // Session state
  user: User | null;
  isLoading: boolean;
  isLoggedIn: boolean;
  sessionError: string;
  retrySession: () => void;

  // Auth actions — call the real backend via the shared API client
  login: (credentials: { email: string; password: string }) => Promise<AuthResponse>;
  register: (data: {
    email: string;
    password: string;
    full_name: string;
    phone_number?: string;
  }) => Promise<RegisterResponse>;
  setAdminGuideDismissed: (dismissed: boolean) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionError, setSessionError] = useState('');
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const retrySession = useCallback(() => setRestoreAttempt(value => value + 1), []);

  const openAuth = useCallback((nextMode: 'signin' | 'signup') => {
    setMode(nextMode);
    setIsOpen(true);
  }, []);

  const closeAuth = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Restore session on mount if a token exists
  useEffect(() => {
    let cancelled = false;
    const restore = async () => {
      setIsLoading(true);
      setSessionError('');
      if (!api.getToken()) {
        setIsLoading(false);
        return;
      }
      try {
        const me = await api.getMe();
        if (!cancelled) setUser(me);
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 401) api.setToken(null);
        else setSessionError('Your account could not be loaded. The service may be unavailable; your saved session has not been removed.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    restore();
    return () => {
      cancelled = true;
    };
  }, [restoreAttempt]);

  const handleAuthResponse = useCallback((response: AuthResponse) => {
    // api.login stores the access token; persist the refresh token for
    // future session restoration and mirror the user in state.
    if (typeof window !== 'undefined' && response.refresh) {
      localStorage.setItem('refresh_token', response.refresh);
    }
    setUser(response.user);
    setSessionError('');
    return response;
  }, []);

  const login = useCallback(
    async (credentials: { email: string; password: string }) => {
      const response = await api.login(credentials);
      try { sessionStorage.removeItem(`vaceup:admin-guide:seen:${response.user.id}`); } catch { /* Session storage may be unavailable. */ }
      return handleAuthResponse(response);
    },
    [handleAuthResponse]
  );

  const register = useCallback(
    async (data: {
      email: string;
      password: string;
      full_name: string;
      phone_number?: string;
    }) => {
      return api.register(data);
    },
    []
  );

  const setAdminGuideDismissed = useCallback(async (dismissed: boolean) => {
    const updated = await api.setAdminGuideDismissed(dismissed);
    setUser(updated);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      if (typeof window !== 'undefined') localStorage.removeItem('refresh_token');
      setUser(null);
      setSessionError('');
    }
  }, []);

  const value = useMemo(
    () => ({
      isOpen,
      mode,
      openAuth,
      closeAuth,
      user,
      isLoading,
      isLoggedIn: !!user,
      sessionError,
      retrySession,
      login,
      register,
      setAdminGuideDismissed,
      logout,
    }),
    [isOpen, mode, openAuth, closeAuth, user, isLoading, login, register, logout, setAdminGuideDismissed, sessionError, retrySession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
