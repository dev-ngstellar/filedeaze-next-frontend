'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  DashboardIcon,
  UsersIcon,
  SettingsIcon,
  UserCheckIcon,
  ClipboardIcon,
  CreditCardIcon,
  StarIcon,
  WalletIcon,
  SparklesIcon,
  ZapIcon,
  HandCoinsIcon,
  BoxIcon,
  ShieldCheckIcon,
  LayersIcon,
  LayoutListIcon,
} from '@animateicons/react/lucide';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { SidebarNavItem } from './SidebarNavItem';
import type { NavItemDef } from './SidebarNavItem';
import { DashboardNavGroup } from './DashboardNavGroup';
import type { NavChildDef } from './DashboardNavGroup';

const dashboardNavItem: NavItemDef = { href: '/admin/dashboard', label: 'Dashboard', icon: DashboardIcon };

// Reports live under Dashboard now — same routes as before, just reorganized in the nav.
const dashboardReportChildren: NavChildDef[] = [
  { href: '/admin/dashboard', label: 'Overview' },
  { href: '/admin/reports/revenue', label: 'Revenue Report' },
  { href: '/admin/reports/tickets', label: 'Ticket Report' },
  { href: '/admin/reports/technicians', label: 'Technician Report' },
];

const adminOnlyNav: NavItemDef[] = [
  { href: '/admin/managers', label: 'Managers', icon: UsersIcon },
  { href: '/admin/business-settings', label: 'Business Settings', icon: SettingsIcon },
  { href: '/admin/profile', label: 'My Profile', icon: UserCheckIcon },
];

const adminMiscNav: NavItemDef[] = [
  { href: '/admin/audit-logs', label: 'Audit Logs', icon: ClipboardIcon },
  { href: '/admin/subscription', label: 'Subscription', icon: CreditCardIcon },
];

const operationsNav: NavItemDef[] = [
  { href: '/admin/tickets', label: 'Tickets', icon: ClipboardIcon },
  { href: '/admin/technicians', label: 'Technicians', icon: WalletIcon },
  { href: '/admin/skills', label: 'Skills', icon: StarIcon },
  { href: '/admin/service-catalog', label: 'Categories', icon: SparklesIcon },
  { href: '/admin/customers', label: 'Customers', icon: UsersIcon },
  { href: '/admin/assets', label: 'Customer Assets', icon: BoxIcon },
  { href: '/admin/attendance', label: 'Attendance', icon: UserCheckIcon },
  { href: '/admin/feedback', label: 'Feedback', icon: StarIcon },
  { href: '/admin/payments', label: 'Payments', icon: HandCoinsIcon },
  { href: '/admin/invoices', label: 'Invoices', icon: CreditCardIcon },
];

const amcNav: NavItemDef[] = [
  { href: '/admin/amc', label: 'AMC Dashboard', icon: ShieldCheckIcon },
  { href: '/admin/amc/plans', label: 'AMC Plans', icon: LayersIcon },
  { href: '/admin/amc/management', label: 'AMC Management', icon: LayoutListIcon },
];

const managerDashNav: NavItemDef[] = [
  { href: '/manager/dashboard', label: 'Dashboard', icon: DashboardIcon },
];

interface AdminSidebarProps {
  onClose?: () => void;
  isCollapsed?: boolean;
}

const allNavHrefs = [
  ...dashboardReportChildren,
  ...adminOnlyNav,
  ...adminMiscNav,
  ...operationsNav,
  ...amcNav,
  ...managerDashNav,
].map(i => i.href);

export function AdminSidebar({ onClose, isCollapsed = false }: AdminSidebarProps) {
  const path = usePathname();
  const { role } = useAuth();
  // A parent "index" route (e.g. /admin/amc) is also a path-prefix of every one of its own
  // sibling routes (/admin/amc/plans, /admin/amc/assign, ...), so a naive per-item startsWith
  // check matches both at once. Instead, find every href that matches the current path, then
  // keep only the longest (most specific) one — exactly one item is ever active.
  const matchingHrefs = allNavHrefs.filter(href => path === href || path.startsWith(href + '/'));
  const activeHref = matchingHrefs.sort((a, b) => b.length - a.length)[0];
  const isActive = (href: string) => href === activeHref;

  const renderSectionHeader = (label: string, showDivider: boolean) => {
    if (isCollapsed) {
      return showDivider ? <div className="h-px bg-[var(--color-border-strong)] my-3 mx-2 opacity-30" /> : null;
    }
    return (
      <p className="px-2 pt-3 pb-1 text-[9px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
        {label}
      </p>
    );
  };

  return (
    <aside
      className={cn(
        "flex h-full flex-col transition-all duration-300 ease-in-out select-none bg-[var(--color-sidebar)]",
        isCollapsed ? "w-20" : "w-64"
      )}
    >
      {/* Brand Header */}
      <div
        className={cn(
          "flex items-center gap-3 px-5 h-16 shrink-0 transition-all duration-300 bg-[var(--color-header-bg)] shadow-sm",
          isCollapsed ? "justify-center px-4" : "justify-start"
        )}
        style={{ borderBottom: '1px solid var(--color-border)' }}
      >
        <div
          className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300"
          style={{
            background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%)',
            boxShadow: '0 4px 12px var(--color-primary-ring)',
          }}
        >
          <ZapIcon size={17} className="text-white" isAnimated />
        </div>
        {!isCollapsed && (
          <div className="animate-fe-slide-left">
            <p className="text-sm font-bold text-[var(--color-text-primary)] leading-tight">FieldEaze</p>
            <p className="text-[10px] font-semibold mt-0.5 text-[var(--color-text-muted)]">
              {role === 'ADMIN' ? 'Admin Portal' : 'Manager Portal'}
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col overflow-y-auto sidebar-scroll py-3 px-3 space-y-0.5">
        {role === 'ADMIN' && (
          <>
            {renderSectionHeader("Admin", false)}
            <DashboardNavGroup
              item={dashboardNavItem}
              children={dashboardReportChildren}
              isSectionActive={dashboardReportChildren.some(c => isActive(c.href))}
              isChildActive={isActive}
              isCollapsed={isCollapsed}
              onClose={onClose}
            />
            {adminOnlyNav.map(item => (
              <SidebarNavItem key={item.href} item={item} isActive={isActive(item.href)} isCollapsed={isCollapsed} onClose={onClose} />
            ))}

            {renderSectionHeader("System", true)}
            {adminMiscNav.map(item => (
              <SidebarNavItem key={item.href} item={item} isActive={isActive(item.href)} isCollapsed={isCollapsed} onClose={onClose} />
            ))}
          </>
        )}

        {role === 'MANAGER' && (
          <>
            {renderSectionHeader("Overview", false)}
            {managerDashNav.map(item => (
              <SidebarNavItem key={item.href} item={item} isActive={isActive(item.href)} isCollapsed={isCollapsed} onClose={onClose} />
            ))}
          </>
        )}

        {renderSectionHeader("Operations", true)}
        {operationsNav.map(item => (
          <SidebarNavItem key={item.href} item={item} isActive={isActive(item.href)} isCollapsed={isCollapsed} onClose={onClose} />
        ))}

        {renderSectionHeader("AMC Management", true)}
        {amcNav.map(item => (
          <SidebarNavItem key={item.href} item={item} isActive={isActive(item.href)} isCollapsed={isCollapsed} onClose={onClose} />
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3" style={{ borderTop: '1px solid var(--color-sidebar-border)' }}>
        <p className="text-[10px] font-medium text-center text-[var(--color-text-muted)]">
          {isCollapsed ? 'v1.0' : 'FieldEaze Platform v1.0'}
        </p>
      </div>
    </aside>
  );
}
