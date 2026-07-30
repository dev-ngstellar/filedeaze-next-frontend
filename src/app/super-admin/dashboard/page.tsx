'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2, CheckCircle, XCircle, AlertCircle, DollarSign, Users } from 'lucide-react';
import api from '@/lib/axios';
import { SuperAdminDashboard } from '@/types';
import { StatsCard } from '@/components/ui/StatsCard';
import { SkeletonCard } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { useRoleAccent } from '@/lib/useRoleAccent';
import Link from 'next/link';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function SuperAdminDashboardPage() {
  const ACCENT = useRoleAccent();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<SuperAdminDashboard>({
    queryKey: ['super-admin-dashboard'],
    queryFn: async () => (await api.get('/web/super-admin/dashboard')).data.data,
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-xl font-bold text-[var(--color-text-primary)] transition-colors duration-250">Dashboard</h2>
        <p className="text-sm text-[var(--color-text-muted)] mt-0.5 transition-colors duration-250">Platform-wide metrics and performance overview</p>
      </div>

      {/* KPI Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : isError || !data ? (
        <ErrorState error={error} onRetry={refetch} isRetrying={isFetching} />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

            {/* ── Standard: Total Tenants ── */}
            <Link href="/super-admin/tenants" className="block focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] rounded-2xl">
              <StatsCard
                variant="standard"
                title="Total Tenants"
                value={data.totalTenants}
                icon={Building2}
                accentHex={ACCENT}
                context="Total onboarded companies"
                status="stable"
                footerText="Platform Total"
              />
            </Link>

            {/* ── Standard: Active Tenants ── */}
            <Link href="/super-admin/tenants" className="block focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] rounded-2xl">
              <StatsCard
                variant="standard"
                title="Active Tenants"
                value={data.activeTenants}
                icon={CheckCircle}
                accentHex={ACCENT}
                context={`${((data.activeTenants / (data.totalTenants || 1)) * 100).toFixed(0)}% of tenants active`}
                status={data.activeTenants > 0 ? 'healthy' : 'offline'}
                footerText="Live"
              />
            </Link>

            {/* ── Primary: Total Revenue ── */}
            <Link href="/super-admin/revenue-reports" className="block focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] rounded-2xl">
              <StatsCard
                variant="primary"
                title="Total Revenue"
                value={`₹${data.totalRevenue.toLocaleString()}`}
                icon={DollarSign}
                accentHex={ACCENT}
                context="Accumulated platform earnings"
                status="healthy"
                footerText="Platform Total"
              />
            </Link>

            {/* ── Status: Expired Tenants ── */}
            <Link href="/super-admin/tenants" className="block focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] rounded-2xl">
              <StatsCard
                variant="status"
                title="Expired Tenants"
                value={data.expiredTenants}
                icon={AlertCircle}
                accentHex={ACCENT}
                context={data.expiredTenants > 0 ? `${data.expiredTenants} expired subscriptions` : "No pending renewals"}
                status={data.expiredTenants > 0 ? 'critical' : 'healthy'}
                footerText="Sync Status"
              />
            </Link>

            {/* ── Status: Suspended Tenants ── */}
            <Link href="/super-admin/tenants" className="block focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] rounded-2xl">
              <StatsCard
                variant="status"
                title="Suspended Tenants"
                value={data.suspendedTenants}
                icon={XCircle}
                accentHex={ACCENT}
                context={data.suspendedTenants > 0 ? `${data.suspendedTenants} suspended accounts` : "All accounts in good standing"}
                status={data.suspendedTenants > 0 ? 'attention' : 'stable'}
                footerText="Live Status"
              />
            </Link>

            {/* ── Standard: Active Users ── */}
            <div className="relative group block focus:outline-none rounded-2xl cursor-default">
              <StatsCard
                variant="standard"
                title="Active Users"
                value={data.activeUsers}
                icon={Users}
                accentHex={ACCENT}
                context={`${data.activeUsers} users currently active`}
                status={data.activeUsers > 0 ? 'active' : 'inactive'}
                footerText="Real-time"
              />
              <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-[var(--color-surface-elevated)] border border-[var(--color-border)] rounded-lg p-3 shadow-lg text-xs text-[var(--color-text-secondary)] pointer-events-none">
                <p className="font-semibold text-[var(--color-text-primary)] mb-1">Active Users Metric</p>
                Total number of enabled (non-disabled) user accounts across all tenants, excluding Super Admins. Reflects current account status, not recent login activity.
                <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-[var(--color-surface-elevated)] border-b border-r border-[var(--color-border)] transform rotate-45"></div>
              </div>
            </div>
          </div>

          {/* Revenue & Tenant Growth Charts */}
          {mounted && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
            <div className="min-w-0 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
              <div className="flex items-center gap-2 mb-6">
                <div className="h-1.5 w-5 rounded-full bg-blue-500" />
                <h3 className="text-[13px] font-bold tracking-wide uppercase text-[var(--color-text-muted)]">Revenue Trend</h3>
              </div>
              <div className="h-64 min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.revenueTrend ?? []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={ACCENT} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={ACCENT} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} dx={-10} tickFormatter={(val) => `₹${val/1000}k`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'var(--color-surface-elevated)', borderRadius: '8px', border: '1px solid var(--color-border)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                      itemStyle={{ color: 'var(--color-text-primary)', fontSize: '13px', fontWeight: 600 }}
                      labelStyle={{ color: 'var(--color-text-muted)', fontSize: '12px', marginBottom: '4px' }}
                    />
                    <Area type="monotone" dataKey="revenue" stroke={ACCENT} strokeWidth={2} fillOpacity={1} fill="url(#colorRev)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              {!data.revenueTrend?.some(p => p.revenue > 0) && (
                <p className="text-xs text-[var(--color-text-muted)] text-center -mt-2">No revenue recorded for this period</p>
              )}
            </div>

            <div className="min-w-0 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
              <div className="flex items-center gap-2 mb-6">
                <div className="h-1.5 w-5 rounded-full bg-emerald-500" />
                <h3 className="text-[13px] font-bold tracking-wide uppercase text-[var(--color-text-muted)]">Tenant Growth</h3>
              </div>
              <div className="h-64 min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.tenantGrowth ?? []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorTenants" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} dx={-10} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'var(--color-surface-elevated)', borderRadius: '8px', border: '1px solid var(--color-border)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                      itemStyle={{ color: 'var(--color-text-primary)', fontSize: '13px', fontWeight: 600 }}
                      labelStyle={{ color: 'var(--color-text-muted)', fontSize: '12px', marginBottom: '4px' }}
                    />
                    <Area type="monotone" dataKey="tenants" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorTenants)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          )}
        </>
      )}
    </div>
  );
}
