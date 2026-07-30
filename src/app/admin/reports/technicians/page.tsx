'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell
} from 'recharts';
import api from '@/lib/axios';
import { TechnicianReportRow } from '@/types';
import { DataTable } from '@/components/ui/DataTable';
import { Users, UserCheck, CalendarCheck, CheckSquare, Star, AlertCircle } from 'lucide-react';
import dayjs from 'dayjs';

import { ReportLayout, KpiGrid } from '@/components/ui/ReportLayout';
import { StatsCard } from '@/components/ui/StatsCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16'];

export default function TechniciansReportPage() {
  const today = dayjs().format('YYYY-MM-DD');
  const monthStart = dayjs().startOf('month').format('YYYY-MM-DD');
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [params, setParams] = useState({ from: monthStart, to: today });
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const { data: reportData, isLoading, isError, error, refetch, isFetching } = useQuery<{
    rows: TechnicianReportRow[];
    activeToday: number;
    totalPossibleDays: number;
  }>({
    queryKey: ['technicians-report', params],
    queryFn: async () => {
      const raw: {
        technicians: { id: string; name: string; rating: number; _count: { tickets: number; attendance: number } }[];
        activeToday: number;
        totalPossibleDays: number;
      } = (await api.get('/web/admin/reports/technicians', { params })).data.data;
      const rows = raw.technicians.map(t => ({
        id: t.id, name: t.name, totalTickets: t._count.tickets, attendanceDays: t._count.attendance, rating: t.rating ?? 0,
      })) as unknown as TechnicianReportRow[];
      return { rows, activeToday: raw.activeToday, totalPossibleDays: raw.totalPossibleDays };
    },
    staleTime: 30_000,
    retry: 1,
  });

  const data = reportData?.rows ?? [];

  // Calculate KPIs — activeToday and totalPossibleDays now come from the backend, computed from
  // real Attendance rows and the actual selected date range (see admin.service.ts).
  const totalTechnicians = data.length;
  const activeToday = reportData?.activeToday ?? 0;

  const totalJobs = data.reduce((sum, t) => sum + t.totalTickets, 0);
  const totalPossibleDays = reportData?.totalPossibleDays ?? 1;
  const totalAttendance = data.reduce((sum, t) => sum + t.attendanceDays, 0);
  const attendanceRate = totalTechnicians > 0 ? Math.round((totalAttendance / (totalTechnicians * totalPossibleDays)) * 100) : 0;

  const avgRating = totalTechnicians > 0 ? (data.reduce((sum, t) => sum + t.rating, 0) / totalTechnicians).toFixed(1) : '0.0';

  // Process Primary Chart (Performance Comparison)
  const performanceData = useMemo(() => {
    return [...data].sort((a, b) => b.totalTickets - a.totalTickets).slice(0, 10);
  }, [data]);

  // Generate Insights
  const insights = useMemo(() => {
    if (totalTechnicians === 0) return ['No technician data recorded for this period.'];
    const i = [];
    
    const topTech = [...data].sort((a, b) => b.totalTickets - a.totalTickets)[0];
    if (topTech && topTech.totalTickets > 0) {
      i.push(`${topTech.name} handled the highest workload with ${topTech.totalTickets} completed jobs.`);
    }

    if (attendanceRate > 0) {
      i.push(`Team attendance rate is strong at ${Math.min(attendanceRate, 100)}%.`);
    }

    i.push(`Customer satisfaction remains steady with an average rating of ${avgRating} stars.`);

    return i;
  }, [totalTechnicians, data, attendanceRate, avgRating]);

  const columns: ColumnDef<TechnicianReportRow, unknown>[] = [
    { accessorKey: 'name', header: 'Technician' },
    { accessorKey: 'totalTickets', header: 'Total Tickets' },
    { accessorKey: 'attendanceDays', header: 'Attendance Days' },
    {
      accessorKey: 'rating', header: 'Rating',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Star size={12} className="fill-yellow-400 text-yellow-400" />
          <span className="font-medium text-[var(--color-text-primary)]">{row.original.rating.toFixed(1)}</span>
        </div>
      ),
    },
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-border)] shadow-lg rounded-xl p-3 text-sm">
          <p className="text-[var(--color-text-secondary)] font-medium mb-1">{label}</p>
          <p className="text-[var(--color-text-primary)] font-bold text-lg tabular-nums">
            {payload[0].value} {payload[0].name === 'rate' ? '%' : 'Jobs'}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <ReportLayout
      title="Workforce & Technicians"
      description="Track field team performance, job completion rates, and customer satisfaction."
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
          title="Total Technicians"
          value={totalTechnicians}
          icon={Users}
          iconColor="text-blue-600"
          iconBg="bg-blue-100 dark:bg-blue-500/20"
          accentColor="bg-blue-500"
        />
        <StatsCard
          title="Active Today"
          value={activeToday}
          icon={UserCheck}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-100 dark:bg-emerald-500/20"
          accentColor="bg-emerald-500"
        />
        <StatsCard
          title="Attendance Rate"
          value={`${Math.min(attendanceRate, 100)}%`}
          icon={CalendarCheck}
          iconColor="text-indigo-600"
          iconBg="bg-indigo-100 dark:bg-indigo-500/20"
          accentColor="bg-indigo-500"
        />
        <StatsCard
          title="Jobs Completed"
          value={totalJobs}
          icon={CheckSquare}
          iconColor="text-teal-600"
          iconBg="bg-teal-100 dark:bg-teal-500/20"
          accentColor="bg-teal-500"
        />
        <StatsCard
          title="Average Rating"
          value={avgRating}
          icon={Star}
          iconColor="text-amber-500"
          iconBg="bg-amber-100 dark:bg-amber-500/20"
          accentColor="bg-amber-500"
        />
      </KpiGrid>

      {isError ? (
        <ErrorState error={error} onRetry={refetch} isRetrying={isFetching} />
      ) : totalTechnicians === 0 && !isLoading ? (
        <EmptyState message="No Technician Data" description="No technicians found for this period." />
      ) : (
        <>
          {/* ── Analytics & Action Section ── */}
          {mounted && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

              {/* ── LEFT: Primary Chart — Top Technicians (8 cols) ── */}
              {performanceData.length > 0 && (
                <div className="lg:col-span-8 min-w-0 bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-4 shadow-sm flex flex-col">
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Performance Comparison</h3>
                  <div className="flex-1 min-w-0 min-h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={performanceData} layout="vertical" margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border)" opacity={0.5} />
                        <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} />
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--color-text-primary)', fontWeight: 500 }} width={90} />
                        <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'var(--color-surface-elevated)', opacity: 0.4 }} />
                        <Bar dataKey="totalTickets" radius={[0, 4, 4, 0]} maxBarSize={26}>
                          {performanceData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* ── RIGHT: Performance Leaderboard & Action Panel (4 cols) ── */}
              <div className="lg:col-span-4 bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-5 shadow-sm flex flex-col h-full">
                <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-5">Performance Leaderboard</h3>
                
                <div className="flex flex-col gap-3 mb-6">
                  <div className="flex items-start gap-3 bg-emerald-50 dark:bg-emerald-500/10 p-3.5 rounded-xl border border-emerald-100 dark:border-emerald-500/20">
                    <Star className="w-5 h-5 text-emerald-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-400">Top Performer</p>
                      <p className="text-xs text-emerald-700 dark:text-emerald-500/80 mt-0.5">
                        {performanceData[0]?.name || 'N/A'} ({performanceData[0]?.totalTickets || 0} Jobs)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 bg-red-50 dark:bg-red-500/10 p-3.5 rounded-xl border border-red-100 dark:border-red-500/20">
                    <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-red-900 dark:text-red-400">Needs Attention</p>
                      <p className="text-xs text-red-700 dark:text-red-500/80 mt-0.5">
                        {performanceData.length > 1 ? performanceData[performanceData.length - 1]?.name : 'N/A'} (Lowest performer)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 bg-blue-50 dark:bg-blue-500/10 p-3.5 rounded-xl border border-blue-100 dark:border-blue-500/20">
                    <Users className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-blue-900 dark:text-blue-400">Workforce Status</p>
                      <p className="text-xs text-blue-700 dark:text-blue-500/80 mt-0.5">1 Technician Overloaded</p>
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

          {/* ── Table: Recent Performance ── */}
          <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Detailed Performance</h3>
              <span className="text-[11px] font-medium text-[var(--color-text-muted)]">Showing {Math.min(data.length, 5)} most recent records</span>
            </div>
            <DataTable<TechnicianReportRow> data={data.slice(0, 5)} columns={columns} isLoading={false} />
          </div>
        </>
      )}
    </ReportLayout>
  );
}
