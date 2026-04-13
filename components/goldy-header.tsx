'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { GoldyAvatar } from '@/components/goldy-avatar';

// Subtitle shown on the right side of the header, one line max.
// Pathname-scoped so the mascot's "role" changes with context without
// adding a per-page header component.
const SUBTITLE_BY_PATH: Array<[test: (p: string) => boolean, subtitle: string]> = [
  [(p) => p === '/', 'Snap a flyer · I turn it into a decision'],
  [(p) => p === '/feed' || p.startsWith('/feed/'), 'your campus sidekick'],
  [(p) => p === '/browse' || p.startsWith('/browse/'), 'what\u2019s on campus this month'],
  [(p) => p === '/profile' || p.startsWith('/profile/'), 'what you\u2019re into'],
];

function subtitleFor(pathname: string | null): string {
  if (!pathname) return 'your campus sidekick';
  const hit = SUBTITLE_BY_PATH.find(([test]) => test(pathname));
  return hit?.[1] ?? 'your campus sidekick';
}

// Rendered at the top of every page via app/layout.tsx. The sticky
// maroon band is the single strongest visual signal that every
// ClipCal surface is the same app — it was previously scoped to /feed,
// which made /, /browse, and /profile feel like separate products.
export function GoldyHeader() {
  const pathname = usePathname();
  const subtitle = subtitleFor(pathname);
  return (
    <header
      className="sticky top-0 z-20 shadow-lg"
      style={{
        background: 'var(--goldy-maroon-500)',
        color: 'white',
        paddingTop: 'env(safe-area-inset-top)',
      }}
    >
      <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
        <Link
          href="/feed"
          aria-label="Gopherly home"
          className="flex shrink-0 items-center gap-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--goldy-gold-300)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--goldy-maroon-500)] rounded-lg"
        >
          <GoldyAvatar size={40} />
          <span className="flex flex-col leading-tight">
            <span className="goldy-display text-base font-bold sm:text-lg">
              Gopherly
            </span>
            <span
              className="text-[10px] sm:text-[11px]"
              style={{ color: 'var(--goldy-gold-300)' }}
            >
              {subtitle}
            </span>
          </span>
        </Link>
      </div>
    </header>
  );
}
