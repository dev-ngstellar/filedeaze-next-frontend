'use client';

import { JSX, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import api from '@/lib/axios';
import { Billing, BillingReport, PaymentStats, Tenant, Plan } from '@/types';
import { DataTable } from '@/components/ui/DataTable';
import { Badge, PlanBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { ErrorState } from '@/components/ui/ErrorState';
import { Download, Search, FileText, Eye } from 'lucide-react';
import { FilterCard } from '@/components/ui/FilterCard';
import dayjs from 'dayjs';

// ── Helpers ────────────────────────────────────────────────────────────────────

function deriveDuration(b: Billing): string {
  if (!b.subscription?.startDate || !b.subscription?.endDate) return '—';
  const days = dayjs(b.subscription.endDate).diff(dayjs(b.subscription.startDate), 'day');
  return `${days} days`;
}

function buildExportRows(billings: Billing[]) {
  return billings.map(b => ({
    ref: b.id.slice(0, 8).toUpperCase(),
    tenant: b.tenant?.companyName ?? '—',
    code: b.tenant?.tenantCode ?? '—',
    plan: b.subscription?.plan?.name ?? '—',
    duration: deriveDuration(b),
    amount: Number(b.amount),
    status: b.status,
    created: dayjs(b.createdAt).format('DD MMM YYYY'),
    paidAt: b.paidAt ? dayjs(b.paidAt).format('DD MMM YYYY') : '—',
    subEnd: b.subscription?.endDate ? dayjs(b.subscription.endDate).format('DD MMM YYYY') : '—',
  }));
}

function triggerDownload(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function exportCsv(billings: Billing[]) {
  const headers = ['Ref', 'Tenant', 'Code', 'Plan', 'Duration', 'Amount (INR)', 'Status', 'Created', 'Paid At', 'Sub End'];
  const rows = buildExportRows(billings).map(r =>
    [r.ref, r.tenant, r.code, r.plan, r.duration, r.amount, r.status, r.created, r.paidAt, r.subEnd]
  );
  const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  triggerDownload(URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })),
    `payment-history-${dayjs().format('YYYY-MM-DD')}.csv`);
}

function exportExcel(billings: Billing[]) {
  const headers = ['Ref', 'Tenant', 'Code', 'Plan', 'Duration', 'Amount (INR)', 'Status', 'Created', 'Paid At', 'Sub End'];
  const rows = buildExportRows(billings);
  const trH = `<tr>${headers.map(h => `<th style="background:#eef2ff;font-weight:bold;border:1px solid #ccc;padding:6px">${h}</th>`).join('')}</tr>`;
  const trB = rows.map(r =>
    `<tr>${[r.ref, r.tenant, r.code, r.plan, r.duration, r.amount, r.status, r.created, r.paidAt, r.subEnd]
      .map(c => `<td style="border:1px solid #ddd;padding:5px">${c}</td>`).join('')}</tr>`
  ).join('');
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta charset="UTF-8"></head><body><table>${trH}${trB}</table></body></html>`;
  triggerDownload(URL.createObjectURL(new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' })),
    `payment-history-${dayjs().format('YYYY-MM-DD')}.xls`);
}

function exportPdf(billings: Billing[]) {
  const rows = buildExportRows(billings);
  const headers = ['Ref', 'Tenant', 'Plan', 'Duration', 'Amount', 'Status', 'Paid At'];
  const body = rows.map(r =>
    `<tr>${[r.ref, r.tenant, r.plan, r.duration, `₹${r.amount.toLocaleString()}`, r.status, r.paidAt]
      .map(c => `<td>${c}</td>`).join('')}</tr>`
  ).join('');
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>body{font-family:sans-serif;font-size:11px}h2{font-size:15px;margin-bottom:2px}
p.sub{color:#666;margin-bottom:10px;font-size:10px}
table{width:100%;border-collapse:collapse}
th{background:#eef2ff;font-weight:600;padding:6px 8px;border-bottom:2px solid #6366f1;font-size:10px;text-transform:uppercase;text-align:left}
td{padding:5px 8px;border-bottom:1px solid #eee}tr:nth-child(even)td{background:#f9f9fb}
@media print{body{margin:0}}</style>
</head><body><h2>Payment History</h2>
<p class="sub">Generated ${dayjs().format('DD MMM YYYY, HH:mm')} &nbsp;|&nbsp; ${billings.length} records</p>
<table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table>
</body></html>`;
  const pw = window.open('', '_blank');
  if (!pw) return;
  pw.document.write(html); pw.document.close(); pw.focus(); pw.print();
}

// ── Stat Card ──────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, dotClass }: { label: string; value: string | number; sub?: string; dotClass: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${dotClass}`} />
          <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
        </div>
        {sub && <p className="text-[10px] text-[var(--color-text-muted)]">{sub}</p>}
      </div>
      <p className="text-lg font-bold text-[var(--color-text-primary)] tabular-nums">{value}</p>
    </div>
  );
}

// ── Detail Modal ───────────────────────────────────────────────────────────────

function BillingDetailModal({ billing, onClose }: { billing: Billing; onClose: () => void }) {
  const duration = deriveDuration(billing);
  const row = (label: string, value: JSX.Element | string | null | false) => (
    <div key={label}>
      <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
      <p className="font-medium text-[var(--color-text-secondary)]">{value}</p>
    </div>
  );

  return (
    <Modal open onClose={onClose} title="Billing Detail" size="sm">
      <div className="space-y-4 text-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
          {row('Reference', <span className="font-mono">{billing.id.slice(0, 8).toUpperCase()}</span>)}
          {row('Status', (
            <Badge variant={billing.status === 'PAID' ? 'success' : billing.status === 'FAILED' ? 'danger' : 'warning'}>
              {billing.status}
            </Badge>
          ))}
          {row('Tenant', (
            <span>{billing.tenant?.companyName ?? '—'} <span className="text-xs text-[var(--color-text-muted)]">({billing.tenant?.tenantCode})</span></span>
          ))}
          {row('Plan', billing.subscription?.plan?.name ?? '—')}
          {row('Amount', <span className="text-base font-bold">₹{Number(billing.amount).toLocaleString()} INR</span>)}
          {row('Duration', duration)}
          {row('Subscription', billing.subscription?.status ?? '—')}
          {row('Created', dayjs(billing.createdAt).format('DD MMM YYYY, HH:mm'))}
          {row('Paid At', billing.paidAt ? dayjs(billing.paidAt).format('DD MMM YYYY, HH:mm') : '—')}
          {row('Sub. Start', billing.subscription?.startDate ? dayjs(billing.subscription.startDate).format('DD MMM YYYY') : '—')}
          {row('Sub. End', billing.subscription?.endDate ? dayjs(billing.subscription.endDate).format('DD MMM YYYY') : '—')}
          {billing.tenant?.email && row('Tenant Email', billing.tenant.email)}
        </div>
        {billing.invoiceUrl && (
          <a href={billing.invoiceUrl} target="_blank" rel="noopener noreferrer"
            className="text-[var(--color-primary)] hover:underline text-xs block">
            View Invoice Document
          </a>
        )}
        <div className="flex justify-end pt-1">
          <Button variant="secondary" size="sm" onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function PaymentHistoryPage() {
  const today = dayjs().format('YYYY-MM-DD');

  const [tenantId, setTenantId] = useState('');
  const [status, setStatus] = useState('');
  const [plan, setPlan] = useState('');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState(today);
  const [params, setParams] = useState<{ tenantId: string; status: string; plan: string; search: string; from: string; to: string; page: number }>({
    tenantId: '', status: '', plan: '', search: '', from: '', to: today, page: 1,
  });
  const [selected, setSelected] = useState<Billing | null>(null);
  const [limit, setLimit] = useState(20);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<BillingReport>({
    queryKey: ['payment-history', params, limit],
    queryFn: async () => (await api.get('/web/super-admin/billing', {
      params: Object.fromEntries(Object.entries({ ...params, limit }).filter(([, v]) => v !== '' && v !== 0)),
    })).data.data,
    placeholderData: keepPreviousData,
  });

  const { data: stats, isLoading: statsLoading } = useQuery<PaymentStats>({
    queryKey: ['payment-stats'],
    queryFn: async () => (await api.get('/web/super-admin/payment-stats')).data.data,
    staleTime: 30_000,
  });

  const { data: tenants = [] } = useQuery<Tenant[]>({
    queryKey: ['tenants-list'],
    queryFn: async () => (await api.get('/web/super-admin/tenants')).data.data,
    staleTime: 60_000,
  });

  const { data: plans = [] } = useQuery<Plan[]>({
    queryKey: ['plans-list'],
    queryFn: async () => (await api.get('/web/super-admin/plans')).data.data,
    staleTime: 60_000,
  });

  const tenantOptions = [
    { value: '', label: 'All Tenants' },
    ...tenants.map(t => ({ value: t.id, label: `${t.companyName} (${t.tenantCode})` })),
  ];

  const planOptions = [
    { value: '', label: 'All Plans' },
    ...plans.map(p => ({ value: p.name, label: p.name })),
  ];

  const billings = data?.billings ?? [];
  const totalPages = data?.totalPages ?? 1;
  const totalCount = data?.total ?? 0;

  function applyFilters(newPage = 1) {
    setParams({ tenantId, status, plan, search, from, to, page: newPage });
  }

  const columns: ColumnDef<Billing, unknown>[] = [
    {
      id: 'ref',
      header: 'Ref #',
      cell: ({ row }) => <span className="font-mono text-xs text-[var(--color-text-muted)]">{row.original.id.slice(0, 8).toUpperCase()}</span>,
    },
    {
      id: 'tenant',
      header: 'Tenant',
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-sm leading-tight">{row.original.tenant?.companyName ?? '—'}</p>
          <p className="text-xs text-[var(--color-text-muted)]">{row.original.tenant?.tenantCode}</p>
        </div>
      ),
    },
    {
      id: 'plan',
      header: 'Plan',
      cell: ({ row }) => {
        const name = row.original.subscription?.plan?.name;
        return name
          ? <PlanBadge planName={name} />
          : <span className="text-[var(--color-text-muted)]">—</span>;
      },
    },
    {
      id: 'duration',
      header: 'Duration',
      cell: ({ row }) => <span className="text-xs text-[var(--color-text-secondary)]">{deriveDuration(row.original)}</span>,
    },
    {
      accessorKey: 'amount',
      header: 'Amount',
      cell: ({ row }) => <span className="tabular-nums font-semibold">₹{Number(row.original.amount).toLocaleString()}</span>,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={row.original.status === 'PAID' ? 'success' : row.original.status === 'FAILED' ? 'danger' : 'warning'}>
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: 'paidAt',
      header: 'Paid At',
      cell: ({ row }) => row.original.paidAt
        ? <span className="text-xs">{dayjs(row.original.paidAt).format('DD MMM YYYY')}</span>
        : <span className="text-xs text-[var(--color-text-muted)]">—</span>,
    },
    {
      id: 'subEnd',
      header: 'Sub. Ends',
      cell: ({ row }) => row.original.subscription?.endDate
        ? <span className="text-xs">{dayjs(row.original.subscription.endDate).format('DD MMM YYYY')}</span>
        : <span className="text-xs text-[var(--color-text-muted)]">—</span>,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <button
          className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-elevated)] hover:text-[var(--color-text-secondary)] transition-colors"
          onClick={() => setSelected(row.original)}
        >
          <Eye size={14} />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">Payment History</h2>
          <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">Subscription payment records across all tenants</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => exportCsv(billings)} disabled={!billings.length}>
            <Download size={13} /> CSV
          </Button>
          <Button variant="secondary" size="sm" onClick={() => exportExcel(billings)} disabled={!billings.length}>
            <FileText size={13} /> Excel
          </Button>
          <Button variant="secondary" size="sm" onClick={() => exportPdf(billings)} disabled={!billings.length}>
            <FileText size={13} /> PDF
          </Button>
        </div>
      </div>

      {/* Stats */}
      {statsLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-[var(--color-border)] p-4 animate-pulse bg-[var(--color-surface-elevated)] h-20" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard
            label="Total Revenue"
            value={`₹${stats.totalRevenue.toLocaleString()}`}
            sub={`${stats.paidCount} paid`}
            dotClass="bg-emerald-500"
          />
          <StatCard
            label="Pending"
            value={`₹${stats.totalPending.toLocaleString()}`}
            sub={`${stats.pendingCount} invoices`}
            dotClass="bg-amber-500"
          />
          <StatCard
            label="Failed"
            value={`₹${stats.totalFailed.toLocaleString()}`}
            sub={`${stats.failedCount} records`}
            dotClass="bg-red-500"
          />
          <StatCard
            label="Active Subscriptions"
            value={stats.activeSubscriptions}
            sub={`${stats.expiredSubscriptions} expired`}
            dotClass="bg-indigo-500"
          />
          <StatCard
            label="Renewals This Month"
            value={stats.renewalsThisMonth}
            dotClass="bg-gray-400"
          />
        </div>
      ) : null}

      {/* Filters */}
      <FilterCard
        title="Search & Filter"
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
        onApply={() => applyFilters(1)}
        onReset={() => {
          setSearch('');
          setTenantId('');
          setPlan('');
          setStatus('');
          setFrom('');
          setTo(today);
          setParams({ tenantId: '', status: '', plan: '', search: '', from: '', to: today, page: 1 });
        }}
      >
        <div className="flex-1 min-w-[160px] max-w-xs flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Search</span>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              placeholder="Search tenant name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && applyFilters(1)}
              className="w-full rounded-[10px] border border-[var(--color-border-input)] bg-[var(--color-input-bg)] pl-8 pr-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-ring)] transition-all h-10"
            />
          </div>
        </div>
        <Select label="Tenant" options={tenantOptions} value={tenantId} onChange={e => setTenantId(e.target.value)} className="w-52" />
        <Select label="Plan" options={planOptions} value={plan} onChange={e => setPlan(e.target.value)} className="w-36" />
        <Select
          label="Status"
          options={[
            { value: '', label: 'All Status' },
            { value: 'PAID', label: 'Paid' },
            { value: 'PENDING', label: 'Pending' },
            { value: 'FAILED', label: 'Failed' },
          ]}
          value={status}
          onChange={e => setStatus(e.target.value)}
          className="w-32"
        />
      </FilterCard>

      {/* Table */}
      {isError ? (
        <ErrorState error={error} onRetry={refetch} isRetrying={isFetching} />
      ) : (
        <>
          {!isLoading && totalCount > 0 && (
            <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
              <span>{totalCount} record{totalCount !== 1 ? 's' : ''}</span>
              {totalPages > 1 && <span>Page {params.page} of {totalPages}</span>}
            </div>
          )}
          <DataTable data={billings} columns={columns} isLoading={isLoading} />
          {!isLoading && totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button variant="secondary" size="sm" disabled={params.page <= 1} onClick={() => applyFilters(params.page - 1)}>
                Previous
              </Button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const p = params.page <= 3 ? i + 1 : params.page - 2 + i;
                if (p < 1 || p > totalPages) return null;
                return (
                  <button
                    key={p}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${p === params.page ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-elevated)]'}`}
                    onClick={() => applyFilters(p)}
                  >
                    {p}
                  </button>
                );
              })}
              <Button variant="secondary" size="sm" disabled={params.page >= totalPages} onClick={() => applyFilters(params.page + 1)}>
                Next
              </Button>
            </div>
          )}
        </>
      )}

      {/* Detail Modal */}
      {selected && <BillingDetailModal billing={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
