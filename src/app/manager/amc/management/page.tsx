'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { UserRoundCheck, MapPinCheck, TriangleAlert, ListChecks } from 'lucide-react';
import AssignTab from './tabs/AssignTab';
import VisitsTab from './tabs/VisitsTab';
import ExpiringTab from './tabs/ExpiringTab';
import HistoryTab from './tabs/HistoryTab';

const TABS = [
  { key: 'assignments', label: 'Assign AMC', icon: UserRoundCheck, Component: AssignTab },
  { key: 'visits', label: 'Upcoming Visits', icon: MapPinCheck, Component: VisitsTab },
  { key: 'expiring', label: 'Expiring AMC', icon: TriangleAlert, Component: ExpiringTab },
  { key: 'history', label: 'AMC History', icon: ListChecks, Component: HistoryTab },
] as const;

type TabKey = typeof TABS[number]['key'];

export default function AmcManagementPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const requestedTab = searchParams.get('tab');
  const activeTab: TabKey = TABS.some(t => t.key === requestedTab) ? (requestedTab as TabKey) : 'assignments';
  const ActiveComponent = TABS.find(t => t.key === activeTab)!.Component;

  const selectTab = (key: TabKey) => {
    router.push(`${pathname}?tab=${key}`);
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-[var(--color-text-primary)]">AMC Management</h2>
        <p className="text-sm text-[var(--color-text-muted)] mt-0.5">Assign contracts, track visits, and manage the full AMC subscription lifecycle</p>
      </div>

      <div className="border-b border-[var(--color-border)] mb-6">
        <nav className="flex gap-1 overflow-x-auto" role="tablist" aria-label="AMC Management sections">
          {TABS.map(tab => {
            const isActive = tab.key === activeTab;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => selectTab(tab.key)}
                className={`flex items-center gap-2 whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  isActive
                    ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                    : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                <tab.icon size={15} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      <ActiveComponent />
    </div>
  );
}
