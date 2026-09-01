'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import api from '@/lib/axios';
import { RevenueReport } from '@/types';
import { DataTable } from '@/components/ui/DataTable';
import { ColumnDef } from '@tanstack/react-table';
import { DollarSign, CreditCard, Banknote, Receipt, Activity, Clock } from 'lucide-react';
import dayjs from 'dayjs';
import { formatDate, formatCurrency } from '@/lib/utils';

import { ReportLayout, KpiGrid } from '@/components/ui/ReportLayout';
import { StatsCard } from '@/components/ui/StatsCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';

type Payment = RevenueReport['payments'][number];

const METHOD_COLORS: Record<string, string> = {
  CASH: '#10b981',   // emerald-500
  CREDIT: '#8b5cf6', // violet-500
};

function exportCsv(payments: Payment[]) {
  const headers = ['Ticket', 'Customer', 'Amount', 'Method', 'Date'];
  const rows = payments.map(p => [p.ticketNumber, p.customer, p.amount, p.method, formatDate(p.date)]);
  const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `revenue-report-${dayjs().format('YYYY-MM-DD')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function RevenueReportPage() {
  const today = dayjs().format('YYYY-MM-DD');
  const monthStart = dayjs().startOf('month').format('YYYY-MM-DD');
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [params, setParams] = useState({ from: monthStart, to: today });
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<RevenueReport>({
    queryKey: ['revenue-report', params],
    queryFn: async () => {
      const res = await api.get('/web/admin/reports/revenue', { params });
      const d = res.data.data;
      return {
        payments: Array.isArray(d?.payments) ? d.payments : [],
        total: d?.total ?? 0,
        byMethod: d?.byMethod ?? {},
        outstandingAmount: d?.outstandingAmount ?? 0,
        pendingInvoicesCount: d?.pendingInvoicesCount ?? 0,
        highestRevenueService: d?.highestRevenueService ?? 'None recorded',
      };
    },
    staleTime: 30_000,
    retry: 1,
  });

  const payments = data?.payments ?? [];
  const total = data?.total ?? 0;
  
  // Calculate KPIs
  const transactions = payments.length;
  const avgValue = transactions > 0 ? Math.round(total / transactions) : 0;
  const cashTotal = payments.filter(p => p.method === 'CASH').reduce((sum, p) => sum + p.amount, 0);
  const creditTotal = payments.filter(p => p.method === 'CREDIT').reduce((sum, p) => sum + p.amount, 0);

  // Process Primary Chart (Revenue Trend)
  const trendData = useMemo(() => {
    const grouped = payments.reduce((acc, p) => {
      const date = dayjs(p.date).format('MMM DD');
      acc[date] = (acc[date] || 0) + p.amount;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(grouped)
      .sort((a, b) => dayjs(a[0], 'MMM DD').valueOf() - dayjs(b[0], 'MMM DD').valueOf())
      .map(([date, amount]) => ({ date, amount }));
  }, [payments]);

  // Process Secondary Chart 1 (Payment Methods)
  const methodData = Object.entries(data?.byMethod ?? {}).map(([method, amount]) => ({ 
    method, 
    amount: amount ?? 0 
  }));

  // Generate Insights
  const insights = useMemo(() => {
    if (payments.length === 0) return ['No revenue data recorded for this period.'];
    const i = [];
    i.push(`Total revenue for the selected period reached ${formatCurrency(total)}.`);

    if (transactions > 0) {
      i.push(`Average ticket value is strong at ${formatCurrency(avgValue)} across ${transactions} transactions.`);
    }
    
    const topMethod = methodData.sort((a,b) => b.amount - a.amount)[0];
    if (topMethod) {
      const perc = Math.round((topMethod.amount / total) * 100);
      i.push(`${topMethod.method} is the most popular method, contributing ${perc}%.`);
    }
    return i;
  }, [total, avgValue, transactions, methodData, payments.length]);

  const columns: ColumnDef<Payment, unknown>[] = [
    { accessorKey: 'ticketNumber', header: 'Ticket' },
    { accessorKey: 'customer', header: 'Customer' },
    {
      accessorKey: 'amount',
      header: 'Amount',
      cell: ({ row }) => <span className="tabular-nums font-medium">₹{row.original.amount.toLocaleString()}</span>,
    },
    { 
      accessorKey: 'method', 
      header: 'Method',
      cell: ({ row }) => (
        <span className="px-2 py-0.5 rounded text-[10px] font-semibold" style={{ backgroundColor: `${METHOD_COLORS[row.original.method] || '#666'}20`, color: METHOD_COLORS[row.original.method] || '#666' }}>
          {row.original.method}
        </span>
      )
    },
    { accessorKey: 'date', header: 'Date', cell: ({ row }) => formatDate(row.original.date) },
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] shadow-lg rounded-xl p-3 text-sm">
          <p className="text-[var(--color-text-secondary)] font-medium mb-1">{label}</p>
          <p className="text-[var(--color-text-primary)] font-bold text-lg tabular-nums">
            ₹{payload[0].value.toLocaleString()}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <ReportLayout
      title="Revenue Intelligence"
      description="Analyze income streams, payment distributions, and revenue trends over time."
      from={from}
      to={to}
      onFromChange={setFrom}
      onToChange={setTo}
      onApply={() => setParams({ from, to })}
      onReset={() => {
        setFrom(monthStart);
        setTo(today);
        setParams({ from: monthStart, to: today });
      }}
      isLoading={isLoading}
      onExportCsv={() => exportCsv(payments)}
    >
      {/* 5 KPI Cards */}
      <KpiGrid>
        <StatsCard
          title="Total Revenue"
          value={formatCurrency(total)}
          icon={DollarSign}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-100 dark:bg-emerald-500/20"
          accentColor="bg-emerald-500"
        />
        <StatsCard
          title="Transactions"
          value={transactions}
          icon={Receipt}
          iconColor="text-blue-600"
          iconBg="bg-blue-100 dark:bg-blue-500/20"
          accentColor="bg-blue-500"
        />
        <StatsCard
          title="Average Ticket"
          value={formatCurrency(avgValue)}
          icon={Activity}
          iconColor="text-violet-600"
          iconBg="bg-violet-100 dark:bg-violet-500/20"
          accentColor="bg-violet-500"
        />
        <StatsCard
          title="Cash Collection"
          value={formatCurrency(cashTotal)}
          icon={Banknote}
          iconColor="text-teal-600"
          iconBg="bg-teal-100 dark:bg-teal-500/20"
          accentColor="bg-teal-500"
        />
        <StatsCard
          title="Credit Payments"
          value={formatCurrency(creditTotal)}
          icon={CreditCard}
          iconColor="text-violet-600"
          iconBg="bg-violet-100 dark:bg-violet-500/20"
          accentColor="bg-violet-500"
        />
      </KpiGrid>

      {isError ? (
        <ErrorState error={error} onRetry={refetch} isRetrying={isFetching} />
      ) : payments.length === 0 && !isLoading ? (
        <EmptyState message="No Revenue Data" description="Try adjusting your date filters to see data." />
      ) : (
        <>
          {/* ── Analytics & Action Section ── */}
          {mounted && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

              {/* ── LEFT: Revenue Trend Chart (8 cols) ── */}
              {trendData.length > 0 && (
                <div className="lg:col-span-8 min-w-0 bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-4 shadow-sm flex flex-col">
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Revenue Trend</h3>
                  <div className="flex-1 min-w-0 min-h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" opacity={0.5} />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} dy={8} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
                        <RechartsTooltip content={<CustomTooltip />} />
                        <Area type="monotone" dataKey="amount" stroke="#3b82f6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRevenue)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* ── RIGHT: Revenue Insights (4 cols) ── */}
              <div className="lg:col-span-4 bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-5 shadow-sm flex flex-col h-full">
                <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-5">Revenue Insights</h3>
                
                <div className="flex flex-col gap-3 mb-6">
                  <div className="flex items-start gap-3 bg-emerald-50 dark:bg-emerald-500/10 p-3.5 rounded-xl border border-emerald-100 dark:border-emerald-500/20">
                    <Activity className="w-5 h-5 text-emerald-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-400">Highest Revenue Service</p>
                      <p className="text-xs text-emerald-700 dark:text-emerald-500/80 mt-0.5">{data?.highestRevenueService || 'None recorded'}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-500/10 p-3.5 rounded-xl border border-amber-100 dark:border-amber-500/20">
                    <Clock className="w-5 h-5 text-amber-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-amber-900 dark:text-amber-400">Outstanding Payments</p>
                      <p className="text-xs text-amber-700 dark:text-amber-500/80 mt-0.5">
                        {formatCurrency(data?.outstandingAmount ?? 0)} pending from {data?.pendingInvoicesCount ?? 0} invoice{(data?.pendingInvoicesCount ?? 0) === 1 ? '' : 's'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 bg-blue-50 dark:bg-blue-500/10 p-3.5 rounded-xl border border-blue-100 dark:border-blue-500/20">
                    <CreditCard className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-blue-900 dark:text-blue-400">Payment Methods</p>
                      <p className="text-xs text-blue-700 dark:text-blue-500/80 mt-0.5">Cash &amp; Credit accepted at point of service</p>
                    </div>
                  </div>
                </div>

                <div className="mt-auto pt-5 border-t border-[var(--color-border)]">
                  <h4 className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">AI Insights</h4>
                  <ul className="space-y-2.5">
                    {insights.slice(0, 3).map((insight, idx) => (
                      <li key={idx} className="text-sm text-[var(--color-text-secondary)] flex items-start gap-2.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-violet-500 mt-1.5 shrink-0" />
                        <span className="leading-tight">{insight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* ── Table: Recent Transactions ── */}
          <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Recent Transactions</h3>
              <span className="text-[11px] font-medium text-[var(--color-text-muted)]">Showing {Math.min(payments.length, 5)} most recent records</span>
            </div>
            <DataTable data={payments.slice(0, 5)} columns={columns} isLoading={false} />
          </div>
        </>
      )}
    </ReportLayout>
  );
}
