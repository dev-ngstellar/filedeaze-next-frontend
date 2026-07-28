'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import Link from 'next/link';
import { RefreshCw, ExternalLink } from 'lucide-react';
import dayjs from 'dayjs';
import api from '@/lib/axios';
import { AmcSubscription } from '@/types';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { getMinimumSelectableDate, isPastSchedule, getErrorMessage } from '@/lib/utils';

type RenewForm = { startDate: string };

export default function AmcExpiringPage() {
  const pathname = usePathname();
  const prefix = pathname.startsWith('/admin/') ? 'admin' : 'manager';
  const qc = useQueryClient();
  const [renewing, setRenewing] = useState<AmcSubscription | null>(null);
  const { register, handleSubmit, reset, formState: { isSubmitting, errors } } = useForm<RenewForm>();

  const { data: activeSubs = [], isLoading, isError, error, refetch } = useQuery<AmcSubscription[]>({
    queryKey: ['amc-active-subscriptions'],
    queryFn: async () => (await api.get('/web/manager/amc/subscriptions', { params: { status: 'ACTIVE' } })).data.data,
  });

  const cutoff = dayjs().add(30, 'day');
  const expiring = activeSubs
    .filter(s => dayjs(s.endDate).isBefore(cutoff))
    .sort((a, b) => dayjs(a.endDate).valueOf() - dayjs(b.endDate).valueOf());

  const renewMutation = useMutation({
    mutationFn: (d: RenewForm) => api.post(`/web/manager/amc/subscriptions/${renewing!.id}/renew`, { startDate: d.startDate || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['amc-active-subscriptions'] });
      toast.success('AMC renewed');
      setRenewing(null); reset();
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to renew AMC')),
  });

  const columns: ColumnDef<AmcSubscription, unknown>[] = [
    { id: 'asset', header: 'Asset', cell: ({ row }) => row.original.customerAsset?.name ?? '—' },
    { id: 'customer', header: 'Customer', cell: ({ row }) => row.original.customer?.name ?? '—' },
    { id: 'plan', header: 'Plan', cell: ({ row }) => row.original.plan?.name ?? '—' },
    { accessorKey: 'endDate', header: 'End Date', cell: ({ row }) => dayjs(row.original.endDate).format('DD MMM YYYY') },
    {
      id: 'daysLeft', header: 'Days Left',
      cell: ({ row }) => {
        const days = dayjs(row.original.endDate).diff(dayjs(), 'day');
        return <Badge variant={days <= 7 ? 'danger' : 'warning'}>{days <= 0 ? 'Expired' : `${days} days`}</Badge>;
      },
    },
    {
      id: 'actions', header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Link href={`/${prefix}/amc/subscriptions/${row.original.id}`}><Button variant="ghost" size="sm"><ExternalLink size={14} /></Button></Link>
          <Button size="sm" variant="secondary" onClick={() => setRenewing(row.original)}><RefreshCw size={13} /> Renew</Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <DataTable data={expiring} columns={columns} isLoading={isLoading} isError={isError} error={error} onRetry={refetch} />

      <Modal open={!!renewing} onClose={() => { setRenewing(null); reset(); }} title="Renew AMC Subscription" size="sm">
        <form onSubmit={handleSubmit(d => renewMutation.mutate(d))} className="space-y-4">
          <p className="text-sm text-[var(--color-text-muted)]">Renews &quot;{renewing?.plan?.name}&quot; onto the same plan starting the day after the current contract ends, unless overridden below.</p>
          <Input
            label="Start Date" type="date" hint="Leave blank to auto-continue from the current end date"
            min={getMinimumSelectableDate()}
            error={errors.startDate?.message}
            {...register('startDate', { validate: (v) => !isPastSchedule(v) || 'This date has already passed — please pick today or a future date' })}
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" type="button" onClick={() => { setRenewing(null); reset(); }}>Cancel</Button>
            <Button type="submit" loading={isSubmitting || renewMutation.isPending}>Renew</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
