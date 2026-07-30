'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { User, UserRole } from '@/types';
import { api, setAccessToken } from '@/lib/axios';
import { getPortalPrefix, setCookie, getCookie, eraseCookie } from '@/lib/auth-helper';

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  role: UserRole | null;
  setAuth: (user: User, accessToken: string, refreshToken: string, portal?: 'sa' | 'tenant') => void;
  clearAuth: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const pathname = usePathname();
  const prefix = getPortalPrefix(pathname);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      setIsLoading(true);
      const stored = localStorage.getItem(`${prefix}_user`);
      const rt = localStorage.getItem(`${prefix}_refreshToken`);
      if (!stored || !rt) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      let restoredUser: User;
      try {
        restoredUser = JSON.parse(stored);
      } catch {
        localStorage.removeItem(`${prefix}_user`);
        setUser(null);
        setIsLoading(false);
        return;
      }

      // Restore access token from sessionStorage/cookie so API calls work after a hard reload.
      const at = sessionStorage.getItem(`${prefix}_accessToken`) || getCookie(`${prefix}_accessToken`);
      if (at) {
        setAccessToken(at);
        setUser(restoredUser);
        setIsLoading(false);
        return;
      }

      // Access token missing but the refresh token is still here — this is a recoverable state
      // (closed tab, expired 1-day access cookie, etc.), NOT a logout. Previously this branch did
      // setUser(null) unconditionally, which discarded an otherwise-valid tenant session and
      // bounced the user out to the shared /login page — the trigger for the tenant-admin →
      // super-admin redirect bug. Try a silent refresh first, exactly like the axios 401
      // interceptor already does for expired-mid-request tokens.
      try {
        const { data } = await api.post('/auth/refresh', { refreshToken: rt });
        const { accessToken: newAt, refreshToken: newRt } = data.data.tokens;
        if (cancelled) return;
        setAccessToken(newAt);
        sessionStorage.setItem(`${prefix}_accessToken`, newAt);
        localStorage.setItem(`${prefix}_refreshToken`, newRt);
        setCookie(`${prefix}_accessToken`, newAt, 1);
        setCookie(`${prefix}_refreshToken`, newRt, 7);
        setUser(restoredUser);
      } catch {
        if (cancelled) return;
        setAccessToken(null);
        localStorage.removeItem(`${prefix}_refreshToken`);
        localStorage.removeItem(`${prefix}_user`);
        setUser(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    hydrate();
    return () => { cancelled = true; };
  }, [prefix]);

  // `portal` lets a caller state explicitly which bucket this session belongs to, instead of
  // guessing from the current URL — needed because the shared /login page authenticates BOTH
  // Super Admin and tenant users from the same ambiguous "/login" pathname, where a guess can't
  // tell the two apart. Callers on an unambiguous route (e.g. the per-tenant login page under
  // /admin/:tenantCode/login) can omit it and fall back to the path-based prefix.
  const setAuth = useCallback((u: User, at: string, rt: string, portal?: 'sa' | 'tenant') => {
    const currentPrefix = portal ?? getPortalPrefix();
    setUser(u);
    setAccessToken(at);

    sessionStorage.setItem(`${currentPrefix}_accessToken`, at);
    localStorage.setItem(`${currentPrefix}_refreshToken`, rt);
    localStorage.setItem(`${currentPrefix}_user`, JSON.stringify(u));

    setCookie(`${currentPrefix}_accessToken`, at, 1);
    setCookie(`${currentPrefix}_refreshToken`, rt, 7);
  }, []);

  const clearAuth = useCallback(() => {
    const currentPrefix = getPortalPrefix();
    setUser(null);
    setAccessToken(null);
    
    sessionStorage.removeItem(`${currentPrefix}_accessToken`);
    localStorage.removeItem(`${currentPrefix}_refreshToken`);
    localStorage.removeItem(`${currentPrefix}_user`);
    
    eraseCookie(`${currentPrefix}_accessToken`);
    eraseCookie(`${currentPrefix}_refreshToken`);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, role: user?.role ?? null, setAuth, clearAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
