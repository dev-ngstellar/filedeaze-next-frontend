'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Ticket, Users, DollarSign, UserCheck, AlertTriangle, ClipboardList, CheckCircle2, Receipt,
  Plus, UserPlus, BarChart2, Settings, Zap, ArrowRight, ChevronRight, ShieldCheck, MapPinCheck,
} from 'lucide-react';
import Link from 'next/link';
import api from '@/lib/axios';
import { AdminDashboard } from '@/types';
import { StatsCard } from '@/components/ui/StatsCard';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { SkeletonCard, SkeletonLine } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { useRoleAccent } from '@/lib/useRoleAccent';
import { useAmcOverview, AmcOverview } from '@/lib/useAmcOverview';

/* ── Greeting helper ──────────────────────────────────── */
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function getTodayLabel() {
  return new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

/* ── Quick action definitions ─────────────────────────── */
const QUICK_ACTIONS = [
  {
    icon: Plus,
    label: 'New Ticket',
    desc: 'Create a service request',
    href: '/admin/tickets',
    color: 'text-[var(--color-primary)]',
    bg: 'bg-[var(--color-primary-light)]',
  },
  {
    icon: UserPlus,
    label: 'Add Technician',
    desc: 'Onboard a new provider',
    href: '/admin/technicians',
    color: 'text-[var(--color-success)]',
    bg: 'bg-[var(--color-success-light)] dark:bg-[var(--color-success)]/10',
  },
  {
    icon: Users,
    label: 'Invite Manager',
    desc: 'Expand your team',
    href: '/admin/managers',
    color: 'text-[var(--color-accent-purple)]',
    bg: 'bg-[var(--color-accent-purple)]/10',
  },
  {
    icon: BarChart2,
    label: 'View Reports',
    desc: 'Revenue & ticket analytics',
    href: '/admin/reports/revenue',
    color: 'text-[var(--color-warning)]',
    bg: 'bg-[var(--color-warning-light)] dark:bg-[var(--color-warning)]/10',
  },
];

/* ── Needs Attention ──────────────────────────────────── */
function NeedsAttention({ data, amc }: { data: AdminDashboard; amc: AmcOverview }) {
  const items: { key: string; text: string; href: string }[] = [];

  if (data.pendingAssignments > 0) {
    items.push({ key: 'pending-assignments', text: `${data.pendingAssignments} ticket${data.pendingAssignments !== 1 ? 's' : ''} awaiting assignment`, href: '/admin/tickets?status=NEW_TICKET' });
  }
  if (data.overdueTickets > 0) {
    items.push({ key: 'overdue', text: `${data.overdueTickets} overdue ticket${data.overdueTickets !== 1 ? 's' : ''}`, href: '/admin/tickets?overdue=true' });
  }
  if (!amc.isLoading && !amc.isError && amc.expiringCount > 0) {
    items.push({ key: 'amc-expiring', text: `${amc.expiringCount} AMC contract${amc.expiringCount !== 1 ? 's' : ''} expiring soon`, href: '/admin/amc/expiring' });
  }
  if (data.pendingPayments > 0) {
    items.push({ key: 'payments-verify', text: `${data.pendingPayments} payment${data.pendingPayments !== 1 ? 's' : ''} awaiting verification`, href: '/admin/payments?status=COLLECTED' });
  }
  if (data.paymentsAwaitingCollection > 0) {
    items.push({ key: 'payments-collect', text: `${data.paymentsAwaitingCollection} completed ticket${data.paymentsAwaitingCollection !== 1 ? 's' : ''} awaiting payment collection`, href: '/admin/tickets?awaitingCollection=true' });
  }

  return (
    <div>
      <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--color-text-muted)] mb-3">
        Needs Attention
      </h3>
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm p-2">
        {items.length === 0 ? (
          <div className="flex items-center gap-2.5 text-sm text-[var(--color-text-secondary)] p-3">
            <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
            Nothing needs your attention right now.
          </div>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {items.map(item => (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className="group flex items-center gap-2.5 text-sm text-[var(--color-text-secondary)] rounded-xl px-3 py-2.5 cursor-pointer hover:bg-[var(--color-surface-elevated)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] transition-colors"
                >
                  <AlertTriangle size={15} className="text-amber-500 shrink-0" />
                  <span className="flex-1">{item.text}</span>
                  <span className="flex items-center gap-1 text-xs font-medium text-[var(--color-primary)] opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity">
                    View <ChevronRight size={13} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const accent = useRoleAccent();
  const amc = useAmcOverview();
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<AdminDashboard>({
    queryKey: ['admin-dashboard'],
    queryFn: async () => (await api.get('/web/admin/dashboard')).data.data,
  });

  const { user } = useAuth();
  const sub = data?.subscription;
  const showTrialBanner = sub?.isTrial;

  return (
    <div className="space-y-7 animate-fe-fade-in">

      {/* ── Trial Banner ────────────────────────────────── */}
      {showTrialBanner && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/25 dark:to-orange-950/20 dark:border-amber-800/30 px-5 py-3.5 text-sm stagger-1">
          <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <span className="text-amber-800 dark:text-amber-300">
            You are on a <strong>{sub?.currentPlan?.name ?? 'STARTER'}</strong> free trial.{' '}
            {sub?.trialDaysLeft != null && sub.trialDaysLeft > 0
              ? <><strong>{sub.trialDaysLeft} day{sub.trialDaysLeft !== 1 ? 's' : ''}</strong> remaining.</>
              : <strong>Trial has ended.</strong>}{' '}
            <Link href="/admin/subscription" className="underline font-semibold hover:text-amber-900 dark:hover:text-amber-200 transition-colors">
              Subscribe now
            </Link>{' '}to keep access.
          </span>
        </div>
      )}

      {/* ── Hero Welcome Section ────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-7 py-6 shadow-[var(--shadow-sm)] stagger-1">
        {/* Decorative blob */}
        <div
          className="pointer-events-none absolute -right-12 -top-12 h-52 w-52 rounded-full opacity-[0.07]"
          style={{
            background: 'radial-gradient(circle, var(--color-primary) 0%, transparent 70%)',
          }}
        />
        <div
          className="pointer-events-none absolute right-24 bottom-0 h-28 w-28 rounded-full opacity-[0.05]"
          style={{
            background: 'radial-gradient(circle, var(--color-primary) 0%, transparent 70%)',
          }}
        />

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div
                className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 fe-icon-bounce"
                style={{
                  background: 'linear-gradient(135deg, var(--color-primary) 0%, color-mix(in srgb, var(--color-primary) 60%, #a78bfa) 100%)',
                  boxShadow: '0 4px 12px var(--color-primary-ring)',
                }}
              >
                <Zap size={16} className="text-white" />
              </div>
              <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
                {getGreeting()}, {user?.name?.split(' ')[0] ?? 'there'} 👋
              </h2>
            </div>
            <p className="text-sm text-[var(--color-text-muted)] ml-[2.75rem]">
              Here&apos;s today&apos;s overview of your workspace.
            </p>
          </div>

          <div className="ml-[2.75rem] sm:ml-0 flex-shrink-0">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-elevated)] px-3 py-1.5 text-[11px] font-medium text-[var(--color-text-muted)]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {getTodayLabel()}
            </span>
          </div>
        </div>
      </div>

      {/* ── Loading skeleton ─────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-7">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
          <div className="bg-[var(--color-surface)] rounded-2xl p-6 border border-[var(--color-border)] shadow-sm max-w-2xl space-y-5">
            <SkeletonLine className="w-48 h-5 mb-4" />
            <SkeletonLine className="w-full h-6" />
            <SkeletonLine className="w-full h-6" />
            <SkeletonLine className="w-full h-6" />
          </div>
        </div>
      ) : isError || !data ? (
        <ErrorState error={error} onRetry={refetch} isRetrying={isFetching} />
      ) : (
        <>
          {/* ── KPI Cards ───────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link href="/admin/tickets?open=true" className="block rounded-2xl cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2">
              <StatsCard
                title="Open Tickets"
                value={data.openTickets}
                icon={Ticket}
                accentHex={accent}
                context={`${data.openTicketsInProgress} currently in progress`}
                staggerClass="stagger-1"
              />
            </Link>
            <Link href="/admin/tickets?status=NEW_TICKET" className="block rounded-2xl cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2">
              <StatsCard
                title="Pending Assignments"
                value={data.pendingAssignments}
                icon={ClipboardList}
                accentHex={accent}
                context="Needs technician assignment"
                status={data.pendingAssignments > 0 ? 'attention' : 'healthy'}
                staggerClass="stagger-2"
              />
            </Link>
            <Link href="/admin/technicians?available=true" className="block rounded-2xl cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2">
              <StatsCard
                title="Available Technicians"
                value={data.availableTechnicians}
                icon={UserCheck}
                accentHex={accent}
                context={`${data.totalTechnicians} technician${data.totalTechnicians !== 1 ? 's' : ''} total`}
                status={data.availableTechnicians > 0 ? 'available' : 'offline'}
                staggerClass="stagger-3"
              />
            </Link>
            <Link href="/admin/tickets?completedToday=true" className="block rounded-2xl cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2">
              <StatsCard
                title="Completed Today"
                value={data.completedToday}
                icon={CheckCircle2}
                accentHex={accent}
                context={`${data.completedToday} job${data.completedToday !== 1 ? 's' : ''} completed today`}
                staggerClass="stagger-4"
              />
            </Link>
            <Link href="/admin/reports/revenue" className="block rounded-2xl cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2">
              <StatsCard
                title="Monthly Revenue"
                value={`₹${(data.monthlyRevenue || 0).toLocaleString()}`}
                icon={DollarSign}
                accentHex={accent}
                context="Verified revenue this month"
                staggerClass="stagger-5"
              />
            </Link>
            <Link href="/admin/payments?status=COLLECTED" className="block rounded-2xl cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2">
              <StatsCard
                title="Pending Payments"
                value={data.pendingPayments}
                icon={Receipt}
                accentHex={accent}
                context={`${data.pendingPayments} payment${data.pendingPayments !== 1 ? 's' : ''} awaiting verification`}
                status={data.pendingPayments > 0 ? 'followup' : 'healthy'}
                staggerClass="stagger-6"
              />
            </Link>
          </div>

          {/* ── Needs Attention ──────────────────────────── */}
          <NeedsAttention data={data} amc={amc} />

          {/* ── Quick Actions ────────────────────────────── */}
          <div className="stagger-5">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--color-text-muted)] mb-3">
              Quick Actions
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {QUICK_ACTIONS.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="quick-action-card group block px-4 py-4"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-110', action.bg)}>
                      <action.icon size={16} className={action.color} />
                    </div>
                    <ArrowRight
                      size={14}
                      className="text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-[-4px] group-hover:translate-x-0"
                    />
                  </div>
                  <p className="text-[13px] font-semibold text-[var(--color-text-primary)] leading-tight">
                    {action.label}
                  </p>
                  <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5 leading-relaxed">
                    {action.desc}
                  </p>
                </Link>
              ))}
            </div>
          </div>

          {/* ── AMC Overview ──────────────────────────────── */}
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--color-text-muted)] mb-3">
              AMC Overview
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Link href="/admin/amc/history?status=ACTIVE" className="block">
                <StatsCard
                  title="Active AMC"
                  value={amc.activeCount}
                  icon={ShieldCheck}
                  accentHex={accent}
                  context="Assets currently under contract"
                  status="active"
                  footerText="Live"
                />
              </Link>
              <Link href="/admin/amc/expiring" className="block">
                <StatsCard
                  title="Expiring AMC"
                  value={amc.expiringCount}
                  icon={AlertTriangle}
                  accentHex={accent}
                  context="Ending within 30 days"
                  status={amc.expiringCount > 0 ? 'attention' : 'stable'}
                  footerText="Live"
                />
              </Link>
              <Link href="/admin/amc/upcoming-visits" className="block">
                <StatsCard
                  title="Upcoming AMC Visits"
                  value={amc.upcomingVisitCount}
                  icon={MapPinCheck}
                  accentHex={accent}
                  context="Scheduled in the next 7 days"
                  status="ontrack"
                  footerText="Live"
                />
              </Link>
            </div>
          </div>

          {/* ── Plan Resource Usage ──────────────────────── */}
          <div className="stagger-6">
            <div className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]">
              {/* Top accent */}
              <div className="absolute left-0 top-0 right-0 h-[3px] bg-[var(--color-primary)] rounded-t-2xl" />

              {/* Decorative background circle */}
              <div
                className="pointer-events-none absolute -right-8 -bottom-8 h-36 w-36 rounded-full opacity-[0.04]"
                style={{ background: 'radial-gradient(circle, var(--color-primary) 0%, transparent 70%)' }}
              />

              <div className="p-6">
                {/* Section header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-[var(--color-primary-light)] flex items-center justify-center flex-shrink-0">
                      <Settings size={14} className="text-[var(--color-primary)]" />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
                        Plan Resource Usage
                      </p>
                    </div>
                  </div>
                  {data.planUsage && (
                    <span className="inline-flex items-center rounded-full bg-[var(--color-primary-light)] border border-[var(--color-primary-ring)] px-3 py-1 text-[11px] font-bold text-[var(--color-primary)]">
                      {data.planUsage.plan}
                    </span>
                  )}
                </div>

                {data.planUsage ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-12 gap-y-3">
                    <ProgressBar
                      label="Managers"
                      used={data.planUsage.usage.managers.current}
                      limit={data.planUsage.usage.managers.limit}
                    />
                    <ProgressBar
                      label="Technicians"
                      used={data.planUsage.usage.technicians.current}
                      limit={data.planUsage.usage.technicians.limit}
                    />
                    <ProgressBar
                      label="Tickets (this month)"
                      used={data.planUsage.usage.tickets.current}
                      limit={data.planUsage.usage.tickets.limit}
                    />
                    {data.planUsage.usage.customers && (
                      <ProgressBar
                        label="Customers"
                        used={data.planUsage.usage.customers.current}
                        limit={data.planUsage.usage.customers.limit}
                      />
                    )}
                    <ProgressBar
                      label="Storage"
                      used={data.planUsage.usage.storage.current}
                      limit={data.planUsage.usage.storage.limit}
                      unit=" GB"
                    />
                  </div>
                ) : (
                  <div className="text-center py-10">
                    <div className="h-12 w-12 rounded-xl bg-[var(--color-surface-elevated)] flex items-center justify-center mx-auto mb-3">
                      <Settings size={20} className="text-[var(--color-text-muted)]" />
                    </div>
                    <p className="text-sm font-medium text-[var(--color-text-secondary)]">No active plan allocated</p>
                    <p className="text-xs mt-1 text-[var(--color-text-muted)]">
                      Please assign a plan from the Super Admin portal.
                    </p>
                    <Link
                      href="/admin/subscription"
                      className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--color-primary)] hover:underline"
                    >
                      View Subscription <ArrowRight size={13} />
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
