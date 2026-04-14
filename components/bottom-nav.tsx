'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Camera, Search, LayoutList, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type Tab = { href: string; label: string; Icon: LucideIcon };

const TABS: Tab[] = [
  { href: '/feed', label: 'Feed', Icon: LayoutList },
  { href: '/', label: 'Upload', Icon: Camera },
  { href: '/browse', label: 'Browse', Icon: Search },
  { href: '/profile', label: 'Profile', Icon: User },
];

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main navigation"
      className="fixed bottom-0 inset-x-0 z-30 border-t border-border bg-[var(--surface-paper)] shadow-[0_-8px_20px_-8px_rgba(90,20,0,0.12)] backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-2xl items-stretch justify-around">
        {TABS.map((tab) => {
          const active = isActive(pathname, tab.href);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
                  active
                    ? 'text-[var(--goldy-maroon-500)]'
                    : 'text-muted-foreground'
                }`}
              >
                <tab.Icon aria-hidden size={20} strokeWidth={active ? 2.5 : 1.75} />
                <span className={active ? 'font-bold' : ''}>{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
