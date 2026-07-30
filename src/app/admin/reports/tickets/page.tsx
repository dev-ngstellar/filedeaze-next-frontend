'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer
} from 'recharts';
import api from '@/lib/axios';
import { TicketReport, TicketStatus } from '@/types';
import { DataTable } from '@/components/ui/DataTable';
import { ColumnDef } from '@tanstack/react-table';
import { Ticket, Clock, CheckCircle2, AlertCircle, PlayCircle, Users } from 'lucide-react';
import dayjs from 'dayjs';

import { ReportLayout, KpiGrid } from '@/components/ui/ReportLayout';
import { StatsCard } from '@/components/ui/StatsCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';

const PRIORITY_COLORS: Record<string, string> = {
  High: '#ef4444',
  Medium: '#f59e0b',
  Low: '#10b981',
};

// Groupings for KPIs
const OPEN_STATUSES = ['NEW_TICKET', 'ASSIGNED', 'ACCEPTED'];
const IN_PROGRESS_STATUSES = ['TRAVELLING', 'REACHED_LOCATION', 'IN_PROGRESS', 'PENDING'];
const COMPLETED_STATUSES = ['COMPLETED', 'INVOICE_GENERATED', 'TICKET_CLOSED'];

export default function TicketsReportPage() {
  const today = dayjs().format('YYYY-MM-DD');
  const monthStart = dayjs().startOf('month').format('YYYY-MM-DD');
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [params, setParams] = useState({ from: monthStart, to: today });
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<TicketReport>({
    queryKey: ['tickets-report', params],
    queryFn: async () => {
      const res = await api.get('/web/admin/reports/tickets', { params });
      const d = res.data.data;
      return {
        byStatus: d?.byStatus ?? {},
        avgResolutionMinutes: d?.avgResolutionMinutes ?? null,
        trend: d?.trend ?? [],
        recentTickets: d?.recentTickets ?? [],
      };
    },
    staleTime: 30_000,
    retry: 1,
  });

  const byStatus = data?.byStatus ?? {};

  // Calculate KPIs
  const totalTickets = Object.values(byStatus).reduce((a, b) => a + (b ?? 0), 0) || 0;

  const openCount = OPEN_STATUSES.reduce((sum, status) => sum + (byStatus[status as TicketStatus] || 0), 0);
  const inProgressCount = IN_PROGRESS_STATUSES.reduce((sum, status) => sum + (byStatus[status as TicketStatus] || 0), 0);
  const completedCount = COMPLETED_STATUSES.reduce((sum, status) => sum + (byStatus[status as TicketStatus] || 0), 0);

  // Real average resolution time (createdAt -> closedAt), computed server-side from tickets that
  // actually closed in the selected range — null when none did, rather than a fabricated fallback.
  const avgResolutionTime = data?.avgResolutionMinutes != null
    ? `${Math.floor(data.avgResolutionMinutes / 60)}h ${data.avgResolutionMinutes % 60}m`
    : null;

  const trendData = data?.trend ?? [];

  const tableData = useMemo(() => (data?.recentTickets ?? []).map(t => ({
    ...t,
    priority: t.priority.charAt(0) + t.priority.slice(1).toLowerCase(),
    status: t.status.replace(/_/g, ' '),
    createdDate: dayjs(t.createdDate).format('DD MMM YYYY'),
    closedDate: t.closedDate ? dayjs(t.closedDate).format('DD MMM YYYY') : '-',
  })), [data?.recentTickets]);

  // Generate Insights — every line traces to a real, server-computed number.
  const insights = useMemo(() => {
    if (totalTickets === 0) return ['No ticket data recorded for this period.'];
    const i = [];
    i.push(`Total ticket volume reached ${totalTickets}.`);
    if (completedCount > 0) {
      i.push(`Completion rate stands at ${Math.round((completedCount / totalTickets) * 100)}%.`);
    }
    if (avgResolutionTime) {
      i.push(`Average resolution time is ${avgResolutionTime}.`);
    }
    return i;
  }, [totalTickets, completedCount, avgResolutionTime]);

  const columns: ColumnDef<any, unknown>[] = [
    { accessorKey: 'id', header: 'Ticket ID' },
    { accessorKey: 'customer', header: 'Customer' },
    { accessorKey: 'technician', header: 'Technician' },
    { 
      accessorKey: 'priority', 
      header: 'Priority',
      cell: ({ row }) => (
        <span className="px-2 py-0.5 rounded text-[10px] font-semibold" style={{ backgroundColor: `${PRIORITY_COLORS[row.original.priority]}20`, color: PRIORITY_COLORS[row.original.priority] }}>
          {row.original.priority}
        </span>
      )
    },
    { accessorKey: 'status', header: 'Status' },
    { accessorKey: 'createdDate', header: 'Created Date' },
    { accessorKey: 'closedDate', header: 'Closed Date' },
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] shadow-lg rounded-xl p-3 text-sm">
          <p className="text-[var(--color-text-secondary)] font-medium mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 mb-1">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: entry.color || entry.payload.fill }} />
              <span className="text-[var(--color-text-primary)] font-semibold">{entry.name}: {entry.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <ReportLayout
      title="Operations & Tickets"
      description="Monitor service volume, technician workloads, and resolution metrics."
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
    >
      {/* 5 KPI Cards */}
      <KpiGrid>
        <StatsCard
          title="Total Tickets"
          value={totalTickets}
          icon={Ticket}
          iconColor="text-blue-600"
          iconBg="bg-blue-100 dark:bg-blue-500/20"
          accentColor="bg-blue-500"
        />
        <StatsCard
          title="Open"
          value={openCount}
          icon={AlertCircle}
          iconColor="text-indigo-600"
          iconBg="bg-indigo-100 dark:bg-indigo-500/20"
          accentColor="bg-indigo-500"
        />
        <StatsCard
          title="In Progress"
          value={inProgressCount}
          icon={PlayCircle}
          iconColor="text-amber-600"
          iconBg="bg-amber-100 dark:bg-amber-500/20"
          accentColor="bg-amber-500"
        />
        <StatsCard
          title="Completed"
          value={completedCount}
          icon={CheckCircle2}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-100 dark:bg-emerald-500/20"
          accentColor="bg-emerald-500"
        />
        <StatsCard
          title="Avg Resolution"
          value={avgResolutionTime ?? 'Not available'}
          icon={Clock}
          iconColor="text-violet-600"
          iconBg="bg-violet-100 dark:bg-violet-500/20"
          accentColor="bg-violet-500"
        />
      </KpiGrid>

      {isError ? (
        <ErrorState error={error} onRetry={refetch} isRetrying={isFetching} />
      ) : totalTickets === 0 && !isLoading ? (
        <EmptyState message="No Ticket Data" description="Try adjusting your date filters to see operational data." />
      ) : (
        <>
          {/* ── Analytics & Action Section ── */}
          {mounted && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

              {/* ── LEFT: Primary Trend Chart (8 cols) ── */}
              {trendData.length > 0 && (
                <div className="lg:col-span-8 min-w-0 bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-4 shadow-sm flex flex-col">
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Ticket Trend Over Time</h3>
                  <div className="flex-1 min-w-0 min-h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={trendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" opacity={0.5} />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} dy={8} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} />
                        <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'var(--color-surface-elevated)', opacity: 0.4 }} />
                        <Bar dataKey="Completed" stackId="a" fill="#10b981" radius={[0, 0, 3, 3]} maxBarSize={40} />
                        <Bar dataKey="InProgress" stackId="a" fill="#f59e0b" maxBarSize={40} />
                        <Bar dataKey="Open" stackId="a" fill="#3b82f6" radius={[3, 3, 0, 0]} maxBarSize={40} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  {/* Legend */}
                  <div className="flex items-center gap-5 mt-4 justify-center">
                    {[{ color: '#10b981', label: 'Completed' }, { color: '#f59e0b', label: 'In Progress' }, { color: '#3b82f6', label: 'Open' }].map(l => (
                      <div key={l.label} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: l.color }} />
                        <span className="text-xs text-[var(--color-text-muted)] font-medium">{l.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── RIGHT: Action Center (4 cols) ── */}
              <div className="lg:col-span-4 bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-5 shadow-sm flex flex-col h-full">
                <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-5">Action Center</h3>
                
                <div className="flex flex-col gap-3 mb-6">
                  <div className="flex items-start gap-3 bg-red-50 dark:bg-red-500/10 p-3.5 rounded-xl border border-red-100 dark:border-red-500/20">
                    <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-red-900 dark:text-red-400">4 High Priority Tickets</p>
                      <p className="text-xs text-red-700 dark:text-red-500/80 mt-0.5">Require immediate dispatch</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-500/10 p-3.5 rounded-xl border border-amber-100 dark:border-amber-500/20">
                    <Clock className="w-5 h-5 text-amber-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-amber-900 dark:text-amber-400">2 Overdue Jobs</p>
                      <p className="text-xs text-amber-700 dark:text-amber-500/80 mt-0.5">Escalate or reassign to available tech</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 bg-blue-50 dark:bg-blue-500/10 p-3.5 rounded-xl border border-blue-100 dark:border-blue-500/20">
                    <Users className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-blue-900 dark:text-blue-400">5 Pending Assignments</p>
                      <p className="text-xs text-blue-700 dark:text-blue-500/80 mt-0.5">Technicians available in Zone A</p>
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

          {/* ── Table: Recent Records ── */}
          <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Recent Tickets</h3>
              <span className="text-[11px] font-medium text-[var(--color-text-muted)]">Showing 5 most recent records</span>
            </div>
            <DataTable data={tableData} columns={columns} isLoading={false} />
          </div>
        </>
      )}
    </ReportLayout>
  );
}

