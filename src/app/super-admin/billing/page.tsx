'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { toast } from 'sonner';
import Link from 'next/link';
import { QRCodeCanvas } from 'qrcode.react';
import api from '@/lib/axios';
import { Billing, BillingReport, Tenant, PlatformUpi } from '@/types';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { CheckCircle, QrCode, TrendingUp, Clock, Pencil } from 'lucide-react';
import { FilterCard } from '@/components/ui/FilterCard';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { getErrorMessage } from '@/lib/utils';
import dayjs from 'dayjs';

export default function BillingPage() {
  const qc = useQueryClient();
  const [tenantId, setTenantId] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [params, setParams] = useState({ tenantId: '', status: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [markPaidTarget, setMarkPaidTarget] = useState<Billing | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery<BillingReport>({
    queryKey: ['billing', params, page, limit],
    queryFn: async () => (await api.get('/web/super-admin/billing', {
      params: { ...Object.fromEntries(Object.entries(params).filter(([, v]) => v)), page, limit },
    })).data.data,
    placeholderData: keepPreviousData,
  });

  const { data: tenants = [] } = useQuery<Tenant[]>({
    queryKey: ['tenants-list'],
    queryFn: async () => (await api.get('/web/super-admin/tenants')).data.data,
    staleTime: 60_000,
  });

  const { data: upiData } = useQuery<PlatformUpi>({
    queryKey: ['platform-upi'],
    queryFn: async () => (await api.get('/web/super-admin/platform-upi')).data.data,
  });

  const markPaidMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/web/super-admin/billing/${id}/mark-paid`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['billing'] }); toast.success('Marked as paid'); setMarkPaidTarget(null); },
    onError: (err) => toast.error(getErrorMessage(err, 'Failed to mark as paid')),
  });

  const tenantOptions = [
    { value: '', label: 'All Tenants' },
    ...tenants.map(t => ({ value: t.id, label: `${t.companyName} (${t.tenantCode})` })),
  ];

  const columns: ColumnDef<Billing, unknown>[] = [
    {
      id: 'ref',
      header: 'Ref',
      cell: ({ row }) => (
        <code className="text-[11px] bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] px-2 py-0.5 rounded font-mono">
          {row.original.id.slice(0, 8).toUpperCase()}
        </code>
      ),
    },
    {
      accessorKey: 'tenant.companyName',
      header: 'Tenant',
      cell: ({ row }) => (
        <span className="font-medium text-[var(--color-text-primary)]">{row.original.tenant?.companyName ?? '—'}</span>
      ),
    },
    {
      id: 'plan',
      header: 'Plan',
      cell: ({ row }) => row.original.subscription?.plan?.name ?? '—',
    },
    {
      accessorKey: 'amount',
      header: 'Amount',
      cell: ({ row }) => (
        <span className="font-semibold text-[var(--color-text-primary)] tabular-nums">
          ₹{Number(row.original.amount).toLocaleString()}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={row.original.status === 'PAID' ? 'success' : 'warning'}>
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: 'paidAt',
      header: 'Paid At',
      cell: ({ row }) => row.original.paidAt
        ? <span className="text-[var(--color-text-secondary)] text-xs">{dayjs(row.original.paidAt).format('DD MMM YYYY')}</span>
        : <span className="text-slate-300">—</span>,
    },
    {
      accessorKey: 'createdAt',
      header: 'Billed On',
      cell: ({ row }) => (
        <span className="text-[var(--color-text-muted)] text-xs">{dayjs(row.original.createdAt).format('DD MMM YYYY')}</span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => row.original.status === 'PENDING' ? (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setMarkPaidTarget(row.original)}
        >
          <CheckCircle size={12} /> Mark Paid
        </Button>
      ) : null,
    },
  ];

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div>
        <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Billing Dashboard</h2>
        <p className="text-sm text-[var(--color-text-muted)] mt-0.5">Track invoices, payments, and billing status</p>
      </div>

      {/* Summary Cards */}
      {data?.summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
          <div className="relative overflow-hidden rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-5 shadow-[var(--shadow-sm)] card-hover">
            <div className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full bg-[var(--color-success)]" />
            <div className="flex items-start justify-between">
              <div className="pl-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-success)] mb-1 opacity-80">Total Paid</p>
                <p className="text-2xl font-bold text-[var(--color-text-primary)] tabular-nums">
                  ₹{data.summary.totalPaid.toLocaleString()}
                </p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-[var(--color-surface-elevated)] flex items-center justify-center">
                <TrendingUp size={18} className="text-[var(--color-success)]" />
              </div>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] p-5 shadow-[var(--shadow-sm)] card-hover">
            <div className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full bg-[var(--color-warning)]" />
            <div className="flex items-start justify-between">
              <div className="pl-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-warning)] mb-1 opacity-80">Total Pending</p>
                <p className="text-2xl font-bold text-[var(--color-text-primary)] tabular-nums">
                  ₹{data.summary.totalPending.toLocaleString()}
                </p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-[var(--color-surface-elevated)] flex items-center justify-center">
                <Clock size={18} className="text-[var(--color-warning)]" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Platform Payment Information — read-only. Edited only from Platform Settings. */}
      <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <div className="px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface-elevated)]/50 flex items-center gap-2">
          <QrCode size={15} className="text-blue-500" />
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Platform Payment Information</h3>
          <Link href="/super-admin/platform-settings" className="ml-auto">
            <Button size="sm" variant="secondary">
              <Pencil size={12} /> Edit Payment Settings
            </Button>
          </Link>
        </div>
        <div className="p-6">
          {upiData?.upiId ? (
            <div className="flex items-start gap-6 flex-col sm:flex-row">
              <div className="flex flex-col items-center gap-2 shrink-0">
                <div className="p-3 bg-[var(--color-surface-elevated)] rounded-xl border border-[var(--color-border)]">
                  {upiData.upiQrImageUrl ? (
                    <img src={upiData.upiQrImageUrl} alt="UPI QR" className="h-24 w-24 object-contain" />
                  ) : (
                    <QRCodeCanvas
                      value={`upi://pay?pa=${upiData.upiId}&pn=${encodeURIComponent(upiData.upiAccountName || 'FieldEaze')}&cu=INR`}
                      size={96}
                      level="M"
                      marginSize={2}
                    />
                  )}
                </div>
                <p className="text-[10px] text-[var(--color-text-muted)]">Read-only</p>
              </div>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-1">UPI ID</p>
                  <p className="font-mono font-semibold text-[var(--color-text-primary)]">{upiData.upiId}</p>
                </div>
                {upiData.upiAccountName && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-1">Account Name</p>
                    <p className="font-semibold text-[var(--color-text-primary)]">{upiData.upiAccountName}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--color-text-muted)]">
              No platform UPI configured yet. <Link href="/super-admin/platform-settings" className="text-blue-600 hover:underline">Set it up in Platform Settings</Link>.
            </p>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <FilterCard
        title="Filter Billing"
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
        onApply={() => { setPage(1); setParams({ tenantId, status, from, to }); }}
        onReset={() => {
          setTenantId('');
          setStatus('');
          setFrom('');
          setTo('');
          setPage(1);
          setParams({ tenantId: '', status: '', from: '', to: '' });
        }}
      >
        <Select
          label="Tenant"
          options={tenantOptions}
          value={tenantId}
          onChange={e => setTenantId(e.target.value)}
          className="w-52"
        />
        <Select
          label="Status"
          options={[
            { value: '', label: 'All Status' },
            { value: 'PAID', label: 'Paid' },
            { value: 'PENDING', label: 'Pending' },
          ]}
          value={status}
          onChange={e => setStatus(e.target.value)}
          className="w-36"
        />
      </FilterCard>

      <DataTable
        data={data?.billings ?? []}
        columns={columns}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={refetch}
        pagination={data?.meta ? {
          meta: data.meta,
          onPageChange: setPage,
          onLimitChange: (l) => { setPage(1); setLimit(l); },
        } : undefined}
      />

      <ConfirmDialog
        open={!!markPaidTarget}
        onClose={() => setMarkPaidTarget(null)}
        onConfirm={() => markPaidTarget && markPaidMutation.mutate(markPaidTarget.id)}
        tone="neutral"
        title={`Mark ${markPaidTarget?.tenant?.companyName ?? 'this'} invoice as paid?`}
        message={`This confirms ₹${markPaidTarget ? Number(markPaidTarget.amount).toLocaleString() : ''} has been received from ${markPaidTarget?.tenant?.companyName ?? 'the tenant'} outside the platform. This cannot be undone.`}
        confirmLabel="Mark Paid"
        loading={markPaidMutation.isPending}
      />
    </div>
  );
}
