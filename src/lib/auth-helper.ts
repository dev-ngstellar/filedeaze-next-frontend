import type { UserRole } from '@/types';

// Deliberately PATH-ONLY — no hostname guessing. Hostname-based heuristics (bare `localhost`,
// `admin.*`, etc.) cannot distinguish "a tenant admin testing on localhost" from "a super admin on
// localhost", and using that guess to decide which portal's stored session to trust let a stale
// Super Admin session (left over in this browser from unrelated testing) get silently restored
// for a Tenant Admin whenever they landed on the shared /login page — this is exactly the bug that
// let a refreshed Tenant Admin session resolve into the Super Admin portal. /admin/* and
// /manager/* both use the shared 'tenant' storage bucket (role itself, not the bucket, tells them
// apart); only /super-admin/* is unambiguous by path. Any other (ambiguous) path — "/", "/login" —
// safely defaults to the lower-privilege 'tenant' bucket and never guesses 'sa'.
export function getPortalPrefix(pathname?: string): 'sa' | 'tenant' {
  const path = pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '');
  if (path.startsWith('/super-admin')) {
    return 'sa';
  }
  return 'tenant';
}

/** Single source of truth for "which portal does this role land in" — reused by the root page
 * and the shared login page instead of each keeping its own copy. An unrecognized/unknown role
 * (including null/undefined, e.g. auth still hydrating) intentionally resolves to null, never to
 * the Super Admin portal — callers must treat null as "go to /login", not silently pick a default. */
export function getHomeRouteForRole(role: UserRole | null | undefined): string | null {
  switch (role) {
    case 'SUPER_ADMIN': return '/super-admin/dashboard';
    case 'ADMIN': return '/admin/dashboard';
    case 'MANAGER': return '/manager/dashboard';
    default: return null;
  }
}

export function setCookie(name: string, value: string, days?: number) {
  if (typeof document === 'undefined') return;
  let expires = '';
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    expires = '; expires=' + date.toUTCString();
  }
  document.cookie = name + '=' + (value || '') + expires + '; path=/; SameSite=Lax';
}

export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const nameEQ = name + '=';
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
}

export function eraseCookie(name: string) {
  if (typeof document === 'undefined') return;
  document.cookie = name + '=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=Lax';
}
