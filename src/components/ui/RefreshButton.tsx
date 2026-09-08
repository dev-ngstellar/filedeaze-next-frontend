'use client';

import { useQueryClient, useIsFetching } from '@tanstack/react-query';
import { RotateCw } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useState } from 'react';

export function RefreshButton() {
  const queryClient = useQueryClient();
  const isFetching = useIsFetching();
  const [isRotatingManual, setIsRotatingManual] = useState(false);

  const handleRefresh = async () => {
    try {
      setIsRotatingManual(true);
      // Invalidates all active queries in the cache to trigger refetch
      await queryClient.invalidateQueries();
      toast.success('Data refreshed');
    } catch (error) {
      toast.error('Failed to refresh data');
    } finally {
      // Ensure the spin animation plays for at least 600ms for visual feedback
      setTimeout(() => {
        setIsRotatingManual(false);
      }, 600);
    }
  };

  const isSpinning = isFetching > 0 || isRotatingManual;

  return (
    <button
      onClick={handleRefresh} 
      
      disabled={isSpinning}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-elevated)] hover:text-[var(--color-text-secondary)] transition-all active:scale-90 duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-85"
      title="Refresh data"
      aria-label="Refresh data"
    >
      <RotateCw
        size={16}
        className={cn(
          "transition-transform duration-500 ease-in-out",
          isSpinning && "animate-spin"
        )}
      />
    </button>
  );
}
