// UI REDESIGN — logic unchanged
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getHomeRouteForRole } from '@/lib/auth-helper';

export default function RootPage() {
  const { role, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Never decide anything from a role/auth state that's still hydrating — deciding early is
    // exactly what let an unhydrated/unknown state fall through to a wrong default elsewhere.
    if (isLoading) return;
    if (!isAuthenticated) { router.replace('/login'); return; }
    router.replace(getHomeRouteForRole(role) ?? '/login');
  }, [isLoading, isAuthenticated, role, router]);

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-6 bg-[var(--color-surface-elevated)]">

      {/* Brand mark */}
      <div className="flex flex-col items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
          {/* Replace with your actual <Logo /> component or <Image> */}
          <span className="text-xl font-semibold tracking-tight text-[var(--color-text-primary)]">F</span>
        </div>
        <p className="text-[15px] font-medium tracking-tight text-[var(--color-text-primary)]">FieldEaze</p>
      </div>

      {/* Spinner */}
      <div
        className="h-[30px] w-[30px] animate-spin rounded-full border-[2px] border-[var(--color-border)] border-t-gray-900"
        aria-label="Loading"
      />

      {/* Label */}
      <p className="text-[13px] text-[var(--color-text-muted)] tracking-wide animate-in fade-in duration-500 delay-150">
        Loading your workspace…
      </p>

    </div>
  );
}