// UI REDESIGN — logic unchanged
'use client';

import { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { Payment } from '@/types';
import { DataTable } from '@/components/ui/DataTable';
import { PaginationMeta } from '@/components/ui/Pagination';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { PaymentStatusBadge } from '@/components/ui/Badge';
import { FilterCard } from '@/components/ui/FilterCard';
import { ErrorState } from '@/components/ui/ErrorState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { CheckCircle, DollarSign, X } from 'lucide-react';
import { getErrorMessage } from '@/lib/utils';
import dayjs from 'dayjs';

export default function PaymentsPage() {
  const qc = useQueryClient();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const today = dayjs().format('YYYY-MM-DD');
  const monthStart = dayjs().startOf('month').format('YYYY-MM-DD');
  // Arriving from the Admin Dashboard's "Pending Payments" card/Needs-Attention item: the
  // dashboard's COLLECTED count has no date restriction, so the destination list must not apply
  // the page's usual "this month" default either, or the two numbers would disagree.
  const arrivedFromDashboard = searchParams.get('status') === 'COLLECTED';
  const [status, setStatus] = useState(arrivedFromDashboard ? 'COLLECTED' : '');
  const [from, setFrom] = useState(arrivedFromDashboard ? '' : monthStart);
  const [to, setTo] = useState(arrivedFromDashboard ? '' : today);
  const [params, setParams] = useState(
    arrivedFromDashboard ? { status: 'COLLECTED', from: '', to: '' } : { status: '', from: monthStart, to: today },
  );
  const [dashboardFilterActive, setDashboardFilterActive] = useState(arrivedFromDashboard);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [verifyTarget, setVerifyTarget] = useState<Payment | null>(null);

  const clearDashboardFilter = () => {
    setDashboardFilterActive(false);
    setStatus('');
    setFrom(monthStart);
    setTo(today);
    setParams({ status: '', from: monthStart, to: today });
    setPage(1);
    router.replace(pathname);
  };

  const { data: response, isLoading, isError, error, refetch, isFetching } = useQuery<{ items: Payment[]; meta: PaginationMeta; totalVerified: number }>({
    queryKey: ['payments', params, page, limit],
    queryFn: async () => (await api.get('/web/manager/payments', {
      params: { ...Object.fromEntries(Object.entries(params).filter(([, v]) => v)), page, limit },
    })).data.data,
    placeholderData: keepPreviousData,
  });

  const data = response?.items ?? [];

  const verifyMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/web/manager/payments/${id}/verify`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payments'] }); toast.success('Payment verified'); setVerifyTarget(null); },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to verify payment')),
  });

  const totalVerified = response?.totalVerified ?? 0;

  const columns: ColumnDef<Payment, unknown>[] = [
    {
      accessorKey: 'ticket.ticketNumber',
      header: 'Ticket',
      cell: ({ row }) => (
        <span className="font-medium text-[var(--color-text-primary)]">
          {row.original.ticket?.ticketNumber ?? row.original.ticketId}
        </span>
      ),
    },
    {
      accessorKey: 'amount',
      header: 'Subtotal',
      cell: ({ row }) => (
        <span className="tabular-nums font-semibold text-[var(--color-text-primary)]">
          ₹{Number(row.original.amount).toLocaleString()}
        </span>
      ),
    },
    {
      accessorKey: 'invoice.gstAmount',
      header: 'GST',
      cell: ({ row }) => (
        <span className="tabular-nums text-[var(--color-text-secondary)]">
          {row.original.invoice?.gstAmount ? `₹${Number(row.original.invoice.gstAmount).toLocaleString()}` : '—'}
        </span>
      ),
    },
    {
      accessorKey: 'invoice.total',
      header: 'Grand Total',
      cell: ({ row }) => (
        <span className="tabular-nums font-semibold text-[var(--color-text-primary)]">
          {row.original.invoice ? `₹${Number(row.original.invoice.total).toLocaleString()}` : `₹${Number(row.original.amount).toLocaleString()}`}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <PaymentStatusBadge status={row.original.status} />,
    },
    {
      accessorKey: 'method',
      header: 'Method',
      cell: ({ row }) => (
        <span className="text-[var(--color-text-secondary)]">{row.original.method ?? '—'}</span>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Date',
      cell: ({ row }) => (
        <span className="text-xs text-[var(--color-text-muted)] tabular-nums">
          {dayjs(row.original.createdAt).format('DD MMM YYYY')}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) =>
        row.original.status === 'COLLECTED' ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setVerifyTarget(row.original)}
          >
            <CheckCircle size={13} />
            Verify
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">Payments</h2>
          <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">Track and verify collected payments</p>
        </div>

        {/* Stat card */}
        <div className="flex items-center gap-4 rounded-xl border border-green-100 bg-[var(--color-surface)] shadow-sm overflow-hidden">
          <div className="self-stretch w-1.5 bg-green-500 shrink-0" />
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-surface-elevated)] shrink-0">
              <DollarSign size={18} className="text-green-600" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-green-600">
                Total Verified
              </p>
              <p className="text-xl font-bold tabular-nums text-[var(--color-text-primary)]">
                ₹{totalVerified.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {dashboardFilterActive && (
        <div className="mb-4 flex items-center gap-2 text-sm">
          <span className="text-[var(--color-text-muted)]">Active filter:</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-primary-light)] border border-[var(--color-primary-ring)] pl-3 pr-1.5 py-1 text-xs font-medium text-[var(--color-primary)]">
            Awaiting Verification
            <button
              type="button"
              onClick={clearDashboardFilter}
              aria-label="Clear Awaiting Verification filter"
              className="flex items-center justify-center rounded-full h-4 w-4 hover:bg-[var(--color-primary)]/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] transition-colors"
            >
              <X size={11} />
            </button>
          </span>
        </div>
      )}

      {/* Filter bar */}
      <FilterCard
        title="Payments Filter"
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
        onApply={() => { setDashboardFilterActive(false); setPage(1); setParams({ status, from, to }); }}
        onReset={clearDashboardFilter}
        isLoading={isLoading}
      >
        <div className="space-y-1">
          <label className="text-xs font-medium text-[var(--color-text-secondary)]">Status</label>
          <Select
            options={[
              { value: '', label: 'All Status' },
              { value: 'PENDING', label: 'Pending' },
              { value: 'COLLECTED', label: 'Collected' },
              { value: 'VERIFIED', label: 'Verified' },
            ]}
            value={status}
            onChange={e => setStatus(e.target.value)}
            className="w-48 h-10"
          />
        </div>
      </FilterCard>

      {/* Table */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-gray-50">
            {/* Skeleton header */}
            <div className="flex gap-4 bg-[var(--color-surface-elevated)] px-4 py-3">
              {[120, 80, 90, 80, 90, 60].map((w, i) => (
                <div key={i} className="h-3 rounded bg-[var(--color-border)] animate-pulse" style={{ width: w }} />
              ))}
            </div>
            {/* Skeleton rows */}
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-4 px-4 py-3.5">
                {[120, 80, 90, 80, 90, 60].map((w, j) => (
                  <div
                    key={j}
                    className="h-3 rounded animate-pulse"
                    style={{
                      width: w,
                      backgroundColor: `rgb(${229 - i * 3}, ${231 - i * 3}, ${235 - i * 3})`,
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        ) : isError ? (
          <ErrorState error={error} onRetry={refetch} isRetrying={isFetching} />
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-surface-elevated)] mb-4">
              <DollarSign size={24} className="text-[var(--color-text-muted)]" />
            </div>
            <p className="text-sm font-medium text-[var(--color-text-secondary)]">No payments found</p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">Try adjusting your filters</p>
          </div>
        ) : (
          <DataTable
            data={data}
            columns={columns}
            isLoading={false}
            pagination={response?.meta ? {
              meta: response.meta,
              onPageChange: setPage,
              onLimitChange: (l) => { setPage(1); setLimit(l); },
            } : undefined}
          />
        )}
      </div>

      <ConfirmDialog
        open={!!verifyTarget}
        onClose={() => setVerifyTarget(null)}
        onConfirm={() => verifyTarget && verifyMutation.mutate(verifyTarget.id)}
        tone="neutral"
        title={`Verify payment for ${verifyTarget?.ticket?.ticketNumber ?? 'this ticket'}?`}
        message={`This confirms the ₹${verifyTarget ? Number(verifyTarget.invoice?.total ?? verifyTarget.amount).toLocaleString() : ''} payment has been received and reconciled. This cannot be undone.`}
        confirmLabel="Verify"
        loading={verifyMutation.isPending}
      />
    </div>
  );
}
