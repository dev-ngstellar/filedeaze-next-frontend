'use client';

import { useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import Link from 'next/link';
import { ExternalLink, RefreshCw, Ban } from 'lucide-react';
import dayjs from 'dayjs';
import api from '@/lib/axios';
import { AmcSubscription, AmcSubscriptionStatus } from '@/types';
import { DataTable } from '@/components/ui/DataTable';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { AmcSubscriptionStatusBadge } from '@/components/ui/Badge';
import { PaginationMeta } from '@/components/ui/Pagination';
import { getMinimumSelectableDate, isPastSchedule, getErrorMessage } from '@/lib/utils';

const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'RENEWED', label: 'Renewed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

type RenewForm = { startDate: string };
type CancelForm = { reason: string };

export default function AmcHistoryPage() {
  const pathname = usePathname();
  const prefix = pathname.startsWith('/admin/') ? 'admin' : 'manager';
  const searchParams = useSearchParams();
  const qc = useQueryClient();

  const [status, setStatus] = useState<AmcSubscriptionStatus | ''>((searchParams.get('status') as AmcSubscriptionStatus) ?? '');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [renewing, setRenewing] = useState<AmcSubscription | null>(null);
  const [cancelling, setCancelling] = useState<AmcSubscription | null>(null);

  const { register: rn, handleSubmit: hn, reset: resetN, formState: { isSubmitting: sn, errors: errorsN } } = useForm<RenewForm>();
  const { register: rc, handleSubmit: hc, reset: resetC, formState: { isSubmitting: sc } } = useForm<CancelForm>();

  const { data, isLoading, isError, error, refetch } = useQuery<{ items: AmcSubscription[]; meta: PaginationMeta }>({
    queryKey: ['amc-history', status, page, limit],
    queryFn: async () => (await api.get('/web/manager/amc/subscriptions', { params: { status: status || undefined, page, limit } })).data.data,
    placeholderData: keepPreviousData,
  });
  const subs = data?.items ?? [];

  const renewMutation = useMutation({
    mutationFn: (d: RenewForm) => api.post(`/web/manager/amc/subscriptions/${renewing!.id}/renew`, { startDate: d.startDate || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['amc-history'] }); toast.success('AMC renewed'); setRenewing(null); resetN(); },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to renew AMC')),
  });

  const cancelMutation = useMutation({
    mutationFn: (d: CancelForm) => api.post(`/web/manager/amc/subscriptions/${cancelling!.id}/cancel`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['amc-history'] }); toast.success('AMC subscription cancelled'); setCancelling(null); resetC(); },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to cancel AMC')),
  });

  const columns: ColumnDef<AmcSubscription, unknown>[] = [
    { id: 'asset', header: 'Asset', cell: ({ row }) => row.original.customerAsset?.name ?? '—' },
    { id: 'customer', header: 'Customer', cell: ({ row }) => row.original.customer?.name ?? '—' },
    { id: 'plan', header: 'Plan', cell: ({ row }) => row.original.plan?.name ?? '—' },
    { accessorKey: 'startDate', header: 'Start', cell: ({ row }) => dayjs(row.original.startDate).format('DD MMM YYYY') },
    { accessorKey: 'endDate', header: 'End', cell: ({ row }) => dayjs(row.original.endDate).format('DD MMM YYYY') },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <AmcSubscriptionStatusBadge status={row.original.status} /> },
    {
      id: 'actions', header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Link href={`/${prefix}/amc/subscriptions/${row.original.id}`}><Button variant="ghost" size="sm"><ExternalLink size={14} /></Button></Link>
          {(row.original.status === 'ACTIVE' || row.original.status === 'EXPIRED') && (
            <Button variant="ghost" size="sm" onClick={() => setRenewing(row.original)}><RefreshCw size={14} /></Button>
          )}
          {row.original.status === 'ACTIVE' && (
            <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600" onClick={() => setCancelling(row.original)}><Ban size={14} /></Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-end mb-6">
        <Select
          options={STATUS_OPTIONS}
          value={status}
          onChange={e => { setStatus(e.target.value as AmcSubscriptionStatus | ''); setPage(1); }}
          className="w-48 h-10"
        />
      </div>

      <DataTable
        data={subs}
        columns={columns}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={refetch}
        pagination={data?.meta ? { meta: data.meta, onPageChange: setPage, onLimitChange: (l) => { setPage(1); setLimit(l); } } : undefined}
      />

      <Modal open={!!renewing} onClose={() => { setRenewing(null); resetN(); }} title="Renew AMC Subscription" size="sm">
        <form onSubmit={hn(d => renewMutation.mutate(d))} className="space-y-4">
          <Input
            label="Start Date" type="date" hint="Leave blank to auto-continue from the current end date"
            min={getMinimumSelectableDate()}
            error={errorsN.startDate?.message}
            {...rn('startDate', { validate: (v) => !isPastSchedule(v) || 'This date has already passed — please pick today or a future date' })}
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" type="button" onClick={() => { setRenewing(null); resetN(); }}>Cancel</Button>
            <Button type="submit" loading={sn}>Renew</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!cancelling} onClose={() => { setCancelling(null); resetC(); }} title="Cancel AMC Subscription" size="sm">
        <form onSubmit={hc(d => cancelMutation.mutate(d))} className="space-y-4">
          <Textarea label="Reason" {...rc('reason')} />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" type="button" onClick={() => { setCancelling(null); resetC(); }}>Cancel</Button>
            <Button variant="danger" type="submit" loading={sc}>Cancel Subscription</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
