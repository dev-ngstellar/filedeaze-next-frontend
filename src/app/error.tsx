'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Unhandled application error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center bg-[var(--color-bg)]">
      <div className="h-16 w-16 rounded-2xl bg-red-50 dark:bg-red-950/30 flex items-center justify-center mb-4">
        <AlertTriangle size={28} className="text-red-500" />
      </div>
      <p className="text-base font-semibold text-[var(--color-text-primary)] mb-1">Something went wrong</p>
      <p className="text-sm text-[var(--color-text-muted)] max-w-sm mb-6">
        We hit an unexpected problem loading this page. Please try again, or head back to the dashboard.
      </p>
      <div className="flex items-center gap-3">
        <Button variant="secondary" onClick={() => reset()}>
          <RotateCw size={14} /> Try again
        </Button>
        <Button onClick={() => { window.location.href = '/'; }}>
          <Home size={14} /> Go home
        </Button>
      </div>
    </div>
  );
}
