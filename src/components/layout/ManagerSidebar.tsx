'use client';

import { usePathname } from 'next/navigation';
import {
    DashboardIcon,
    UsersIcon,
    UserCheckIcon,
    StarIcon,
    CreditCardIcon,
    SparklesIcon,
    WalletIcon,
    HandCoinsIcon,
    ClipboardIcon,
    ZapIcon,
    BoxIcon,
    ShieldCheckIcon,
    LayersIcon,
    LayoutListIcon,
} from '@animateicons/react/lucide';
import { cn } from '@/lib/utils';
import { SidebarNavItem } from './SidebarNavItem';
import type { NavItemDef } from './SidebarNavItem';
import { DashboardNavGroup } from './DashboardNavGroup';
import type { NavChildDef } from './DashboardNavGroup';

const dashboardNavItem: NavItemDef = { href: '/manager/dashboard', label: 'Dashboard', icon: DashboardIcon };

// The Technician Report lives under Dashboard now — same route as before, just reorganized in
// the nav (matches the Admin sidebar's Dashboard → Reports pattern).
const dashboardReportChildren: NavChildDef[] = [
    { href: '/manager/dashboard', label: 'Overview' },
    { href: '/manager/reports/technicians', label: 'Technician Report' },
];

const operationsNav: NavItemDef[] = [
    { href: '/manager/tickets', label: 'Tickets', icon: ClipboardIcon },
    { href: '/manager/technicians', label: 'Technicians', icon: WalletIcon },
    { href: '/manager/skills', label: 'Skills', icon: StarIcon },
    { href: '/manager/customers', label: 'Customers', icon: UsersIcon },
    { href: '/manager/assets', label: 'Customer Assets', icon: BoxIcon },
    { href: '/manager/attendance', label: 'Attendance', icon: UserCheckIcon },
    { href: '/manager/feedback', label: 'Feedback', icon: StarIcon },
];

const amcNav: NavItemDef[] = [
    { href: '/manager/amc', label: 'AMC Dashboard', icon: ShieldCheckIcon },
    { href: '/manager/amc/plans', label: 'AMC Plans', icon: LayersIcon },
    { href: '/manager/amc/management', label: 'AMC Management', icon: LayoutListIcon },
];

const catalogNav: NavItemDef[] = [
    { href: '/manager/service-catalog', label: 'Categories and Sub-Categories', icon: SparklesIcon },
];

const financeNav: NavItemDef[] = [
    { href: '/manager/payments', label: 'Payments', icon: HandCoinsIcon },
    { href: '/manager/invoices', label: 'Invoices', icon: CreditCardIcon },
];

interface ManagerSidebarProps {
    onClose?: () => void;
    isCollapsed?: boolean;
}

const allNavHrefs = [...dashboardReportChildren, ...operationsNav, ...amcNav, ...catalogNav, ...financeNav].map(i => i.href);

export function ManagerSidebar({ onClose, isCollapsed = false }: ManagerSidebarProps) {
    const path = usePathname();
    // A parent "index" route (e.g. /manager/amc) is also a path-prefix of every one of its own
    // sibling routes (/manager/amc/plans, /manager/amc/assign, ...), so a naive per-item
    // startsWith check matches both at once. Instead, find every href that matches the current
    // path, then keep only the longest (most specific) one — exactly one item is ever active.
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
                            Manager Portal
                        </p>
                    </div>
                )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 flex flex-col overflow-y-auto sidebar-scroll py-3 px-3 space-y-0.5">
                {renderSectionHeader("Overview", false)}
                <DashboardNavGroup
                    item={dashboardNavItem}
                    children={dashboardReportChildren}
                    isSectionActive={dashboardReportChildren.some(c => isActive(c.href))}
                    isChildActive={isActive}
                    isCollapsed={isCollapsed}
                    onClose={onClose}
                />

                {renderSectionHeader("Operations", true)}
                {operationsNav.map(item => (
                    <SidebarNavItem key={item.href} item={item} isActive={isActive(item.href)} isCollapsed={isCollapsed} onClose={onClose} />
                ))}

                {renderSectionHeader("AMC Management", true)}
                {amcNav.map(item => (
                    <SidebarNavItem key={item.href} item={item} isActive={isActive(item.href)} isCollapsed={isCollapsed} onClose={onClose} />
                ))}

                {renderSectionHeader("Service Catalog", true)}
                {catalogNav.map(item => (
                    <SidebarNavItem key={item.href} item={item} isActive={isActive(item.href)} isCollapsed={isCollapsed} onClose={onClose} />
                ))}

                {renderSectionHeader("Finance", true)}
                {financeNav.map(item => (
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
