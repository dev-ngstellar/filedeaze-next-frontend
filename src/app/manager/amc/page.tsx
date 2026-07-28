'use client';

import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ShieldCheck, Layers, UserRoundCheck, MapPinCheck, TriangleAlert, ListChecks, ArrowRight } from 'lucide-react';
import api from '@/lib/axios';
import { AmcPlan } from '@/types';
import { StatsCard } from '@/components/ui/StatsCard';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageSpinner } from '@/components/ui/Spinner';
import { useAmcOverview } from '@/lib/useAmcOverview';
import { useRoleAccent } from '@/lib/useRoleAccent';

export default function AmcDashboardPage() {
  const pathname = usePathname();
  const prefix = pathname.startsWith('/admin/') ? 'admin' : 'manager';
  const accent = useRoleAccent();
  const overview = useAmcOverview();

  const { data: plans = [], isLoading: loadingPlans, isError: plansError, error: plansErr, refetch: refetchPlans } = useQuery<AmcPlan[]>({
    queryKey: ['amc-plans-all'],
    queryFn: async () => (await api.get('/web/manager/amc/plans')).data.data,
  });

  const links = [
    { href: `/${prefix}/amc/plans`, label: 'AMC Plans', description: 'Manage maintenance contract offerings', icon: Layers },
    { href: `/${prefix}/amc/assign`, label: 'Assign AMC', description: 'Attach a plan to a customer asset', icon: UserRoundCheck },
    { href: `/${prefix}/amc/upcoming-visits`, label: 'Upcoming Visits', description: 'Scheduled maintenance visits', icon: MapPinCheck },
    { href: `/${prefix}/amc/expiring`, label: 'Expiring AMC', description: 'Subscriptions ending within 30 days', icon: TriangleAlert },
    { href: `/${prefix}/amc/history`, label: 'AMC History', description: 'All subscriptions, every status', icon: ListChecks },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[var(--color-text-primary)]">AMC Dashboard</h2>
        <p className="text-sm text-[var(--color-text-muted)] mt-0.5">Annual Maintenance Contract overview</p>
      </div>

      {overview.isLoading || loadingPlans ? (
        <PageSpinner />
      ) : overview.isError || plansError ? (
        <ErrorState
          title="Unable to load AMC overview"
          error={overview.error ?? plansErr}
          onRetry={() => { overview.refetch(); refetchPlans(); }}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link href={`/${prefix}/amc/history?status=ACTIVE`}>
            <StatsCard title="Active Subscriptions" value={overview.activeCount} icon={ShieldCheck} accentHex={accent} status="active" footerText="Live" />
          </Link>
          <Link href={`/${prefix}/amc/expiring`}>
            <StatsCard title="Expiring ≤ 30 Days" value={overview.expiringCount} icon={TriangleAlert} accentHex={accent} status={overview.expiringCount > 0 ? 'attention' : 'stable'} footerText="Live" />
          </Link>
          <Link href={`/${prefix}/amc/upcoming-visits`}>
            <StatsCard title="Upcoming Visits ≤ 7 Days" value={overview.upcomingVisitCount} icon={MapPinCheck} accentHex={accent} status="ontrack" footerText="Live" />
          </Link>
          <Link href={`/${prefix}/amc/plans`}>
            <StatsCard title="Total Plans" value={plans.length} icon={Layers} accentHex={accent} status="stable" footerText="Live" />
          </Link>
        </div>
      )}

      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-3">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {links.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className="group flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
            >
              <div className="h-10 w-10 rounded-full flex items-center justify-center shrink-0" style={{ background: `${accent}18`, color: accent }}>
                <link.icon size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">{link.label}</p>
                <p className="text-xs text-[var(--color-text-muted)] truncate">{link.description}</p>
              </div>
              <ArrowRight size={15} className="text-[var(--color-text-muted)] group-hover:translate-x-0.5 transition-transform shrink-0" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
