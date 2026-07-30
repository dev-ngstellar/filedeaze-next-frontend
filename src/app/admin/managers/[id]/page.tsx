'use client';

import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useEffect } from 'react';
import api from '@/lib/axios';
import { Manager } from '@/types';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PageSpinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import Link from 'next/link';
import { ChevronLeft, Star } from 'lucide-react';
import dayjs from 'dayjs';
import { formatDate, getErrorMessage } from '@/lib/utils';

type ManagerDetailResponse = {
  manager: Manager & { email: string; profileImageUrl?: string };
  assignedTechnicians: Array<{ id: string; name: string; phone: string; isActive: boolean; rating: number; totalJobs: number }>;
  assignedTickets: Array<{ id: string; ticketNumber: string; status: string; createdAt: string; customer: { name: string } }>;
};

export default function ManagerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<ManagerDetailResponse>({
    queryKey: ['manager', id],
    queryFn: async () => (await api.get(`/web/admin/managers/${id}`)).data.data,
  });

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<Pick<Manager, 'name' | 'phone' | 'isActive'>>();
  useEffect(() => {
    if (data) reset({ name: data.manager.name, phone: data.manager.phone, isActive: data.manager.isActive });
  }, [data, reset]);

  const updateMutation = useMutation({
    mutationFn: (d: Pick<Manager, 'name' | 'phone' | 'isActive'>) => api.patch(`/web/admin/managers/${id}`, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['manager', id] });
      qc.invalidateQueries({ queryKey: ['managers'] });
      toast.success('Updated');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to update manager')),
  });

  if (isLoading) return <PageSpinner />;
  if (isError) return <ErrorState error={error} onRetry={refetch} isRetrying={isFetching} />;
  if (!data) return <ErrorState title="Manager not found" message="This manager may have been removed or the link is incorrect." onRetry={refetch} />;

  const { manager, assignedTechnicians, assignedTickets } = data;

  return (
    <div className="max-w-xl space-y-5">
      {/* Back link */}
      <Link
        href="/admin/managers"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
      >
        <ChevronLeft size={14} />
        Back to Managers
      </Link>

      <div className="flex items-center gap-3">
        <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">{manager.name}</h2>
        <Badge variant={manager.isActive ? 'success' : 'danger'}>{manager.isActive ? 'Active' : 'Inactive'}</Badge>
      </div>

      <div className="bg-[var(--color-surface)] rounded-xl p-6 border border-[var(--color-border)] shadow-sm">
        <form onSubmit={handleSubmit(d => updateMutation.mutate(d))} className="space-y-4">
          <Input label="Name" {...register('name')} />
          <Input label="Phone" {...register('phone')} />
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[var(--color-text-muted)]">Email</label>
            <p className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-2 text-sm text-[var(--color-text-muted)] select-all">{manager.email ?? '—'}</p>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="isActive" {...register('isActive')} className="h-4 w-4" />
            <label htmlFor="isActive" className="text-sm text-[var(--color-text-secondary)]">Active</label>
          </div>
          <div className="flex justify-end"><Button type="submit" loading={isSubmitting}>Save</Button></div>
        </form>
      </div>

      {/* Assigned Technicians */}
      {assignedTechnicians && assignedTechnicians.length > 0 && (
        <div className="bg-[var(--color-surface)] rounded-xl p-6 border border-[var(--color-border)] shadow-sm">
          <h3 className="font-medium text-[var(--color-text-secondary)] mb-4">Assigned Technicians</h3>
          <div className="space-y-2">
            {assignedTechnicians.map(tech => (
              <div key={tech.id} className="flex items-center justify-between rounded-lg bg-[var(--color-surface-elevated)] px-3 py-2 text-sm">
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-[var(--color-text-primary)]">{tech.name}</span>
                  <span className="text-xs text-[var(--color-text-muted)]">{tech.phone}</span>
                </div>
                <div className="flex items-center gap-2">
                  {tech.rating > 0 && (
                    <div className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                      <Star size={12} className="fill-yellow-400 text-yellow-400" />
                      {tech.rating.toFixed(1)}
                    </div>
                  )}
                  <Badge variant={tech.isActive ? 'success' : 'danger'}>{tech.isActive ? 'Active' : 'Inactive'}</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Assigned Tickets */}
      {assignedTickets && assignedTickets.length > 0 && (
        <div className="bg-[var(--color-surface)] rounded-xl p-6 border border-[var(--color-border)] shadow-sm">
          <h3 className="font-medium text-[var(--color-text-secondary)] mb-4">Assigned Tickets</h3>
          <div className="space-y-2">
            {assignedTickets.map(ticket => (
              <div key={ticket.id} className="flex items-center justify-between rounded-lg bg-[var(--color-surface-elevated)] px-3 py-2 text-sm">
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-[var(--color-text-primary)]">{ticket.ticketNumber}</span>
                  <span className="text-xs text-[var(--color-text-muted)]">{ticket.customer?.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--color-text-muted)]">{formatDate(ticket.createdAt)}</span>
                  <Badge variant="info">{ticket.status.replace(/_/g, ' ')}</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
