'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NavItemDef } from './SidebarNavItem';

export interface NavChildDef {
  href: string;
  label: string;
}

interface DashboardNavGroupProps {
  item: NavItemDef;
  children: NavChildDef[];
  /** True when the current route is the parent's own page or one of the children's pages. */
  isSectionActive: boolean;
  isChildActive: (href: string) => boolean;
  isCollapsed: boolean;
  onClose?: () => void;
}

/**
 * Same visual language as SidebarNavItem (colors, active indicator, hover states) but adds an
 * expand/collapse toggle for a small set of nested child links — used for Dashboard + its
 * report pages, the only nested nav case in this sidebar today.
 */
export function DashboardNavGroup({ item, children, isSectionActive, isChildActive, isCollapsed, onClose }: DashboardNavGroupProps) {
  const [expanded, setExpanded] = useState(isSectionActive);

  // Auto-expand whenever navigation (direct URL, browser back/forward, a dashboard card link)
  // lands inside this section — never force-collapses, so a manual toggle elsewhere is preserved.
  useEffect(() => {
    if (isSectionActive) setExpanded(true);
  }, [isSectionActive]);

  const Icon = item.icon;

  // The parent's own href is always the first child's href (Overview), so this tells apart
  // "the user is literally on this exact page" from "the user is somewhere in this section" —
  // the two get different visual weight below (page = strongest, section = a light hint).
  const isPageActive = isChildActive(item.href);
  const isSectionOnly = isSectionActive && !isPageActive;

  if (isCollapsed) {
    return (
      <div className="sidebar-tooltip-container flex justify-center mb-0.5">
        <Link
          href={item.href}
          onClick={onClose}
          title={item.label}
          className={cn(
            'relative flex items-center justify-center w-10 h-10 mx-auto rounded-xl transition-all duration-200 sb-nav-item',
            isPageActive
              ? 'bg-[var(--color-sidebar-active)] text-[var(--color-primary)]'
              : isSectionOnly
                ? 'text-[var(--color-primary)]/80 hover:text-[var(--color-primary)] hover:bg-[var(--color-sidebar-hover)]'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-sidebar-hover)]',
          )}
        >
          <div className="flex items-center justify-center shrink-0" style={{ lineHeight: 0 }}>
            <Icon size={16} />
          </div>
        </Link>
        <span className="sidebar-tooltip">{item.label}</span>
      </div>
    );
  }

  return (
    <div className="mb-0.5">
      <div
        className={cn(
          'group relative flex items-center gap-1 rounded-xl text-[13px] font-medium w-full',
          'transition-all duration-200',
          isPageActive
            ? [
              'bg-[var(--color-sidebar-active)] text-[var(--color-primary)]',
              'shadow-[0_1px_6px_color-mix(in_srgb,var(--color-primary)_10%,transparent)]',
            ]
            : isSectionOnly
              ? ['text-[var(--color-text-primary)]', 'hover:bg-[var(--color-sidebar-hover)]']
              : [
                'text-[var(--color-text-secondary)]',
                'hover:text-[var(--color-text-primary)]',
                'hover:bg-[var(--color-sidebar-hover)]',
              ],
        )}
      >
        {/* Full accent bar only when this is the exact active page — a mere "active section" gets
            no bar at all, so it never visually competes with the active child below it. */}
        {isPageActive && <span className="sidebar-active-indicator" />}

        <Link href={item.href} onClick={onClose} className="flex items-center gap-3 px-3 py-2 flex-1 min-w-0">
          <div
            className={cn(
              'flex items-center justify-center shrink-0 w-[18px] h-[18px] transition-all duration-200',
              isPageActive
                ? 'text-[var(--color-primary)]'
                : isSectionOnly
                  ? 'text-[var(--color-primary)]/80'
                  : 'text-[var(--color-text-muted)] group-hover:text-[var(--color-primary)]',
            )}
            style={{ lineHeight: 0 }}
          >
            <Icon size={16} />
          </div>
          <span className={cn('truncate', isPageActive ? 'font-semibold text-[var(--color-primary)]' : '')}>
            {item.label}
          </span>
        </Link>

        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          aria-label={expanded ? `Collapse ${item.label}` : `Expand ${item.label}`}
          aria-expanded={expanded}
          className="flex items-center justify-center w-8 h-8 mr-1 shrink-0 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-sidebar-hover)] transition-colors"
        >
          <ChevronDown size={14} className={cn('transition-transform duration-200', expanded ? '' : '-rotate-90')} />
        </button>
      </div>

      {expanded && (
        <div className="mt-0.5 ml-[22px] pl-3 border-l border-[var(--color-border)] space-y-0.5">
          {children.map(child => {
            const active = isChildActive(child.href);
            return (
              <Link
                key={child.href}
                href={child.href}
                onClick={onClose}
                className={cn(
                  'relative flex items-center w-full px-3 py-2 rounded-lg text-[12px] truncate',
                  'transition-all duration-200 cursor-pointer',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-1',
                  active
                    ? 'text-[var(--color-primary)] font-semibold bg-[var(--color-sidebar-active)]'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-sidebar-hover)]',
                )}
              >
                {/* Small accent marking exactly which child page is active — distinct from (and
                    stronger than) the group's own tree line to its left. */}
                {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-3.5 w-[3px] rounded-full bg-[var(--color-primary)]" />}
                {child.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
