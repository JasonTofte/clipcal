'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { GoldyAvatar } from '@/components/goldy-avatar';
import { resetDemoData } from '@/lib/demo-reset';

// Small, muted contextual subtitle per page. Keeps the mascot
// contextual without shouting.
const SUBTITLE_BY_PATH: Array<[test: (p: string) => boolean, subtitle: string]> = [
  [(p) => p === '/', 'snap · decide · go'],
  [(p) => p === '/feed' || p.startsWith('/feed/'), 'your campus sidekick'],
  [(p) => p === '/browse' || p.startsWith('/browse/'), 'what\u2019s on campus this month'],
  [(p) => p === '/profile' || p.startsWith('/profile/'), 'what you\u2019re into'],
];

function subtitleFor(pathname: string | null): string {
  if (!pathname) return 'your campus sidekick';
  const hit = SUBTITLE_BY_PATH.find(([test]) => test(pathname));
  return hit?.[1] ?? 'your campus sidekick';
}

// Redesigned for the One Thing Now direction (PR #35 final mockup):
// paper surface with a small Block M tile + maroon wordmark. No
// full-bleed maroon band — keeps visual weight to the content below.
export function GoldyHeader() {
  const pathname = usePathname();
  const subtitle = subtitleFor(pathname);
  return (
    <header
      className="sticky top-0 z-20 border-b"
      style={{
        background: 'var(--surface-calm)',
        borderColor: 'var(--border)',
        paddingTop: 'env(safe-area-inset-top)',
      }}
    >
      <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-2.5">
        <Link
          href="/feed"
          aria-label="ShowUp home"
          className="flex shrink-0 items-center gap-2.5 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          style={{
            // @ts-expect-error - custom property for focus ring
            '--tw-ring-color': 'var(--goldy-gold-400)',
          }}
        >
          <GoldyAvatar size={36} />
          <span className="flex flex-col leading-tight">
            <span
              className="goldy-display text-base font-bold tracking-tight sm:text-lg"
              style={{ color: 'var(--goldy-maroon-600)' }}
            >
              ShowUp
            </span>
            <span
              className="text-[10px] sm:text-[11px]"
              style={{ color: 'var(--muted-foreground)' }}
            >
              {subtitle}
            </span>
          </span>
        </Link>
        <button
          type="button"
          onClick={() => {
            resetDemoData();
            window.location.reload();
          }}
          aria-label="Reset demo data"
          className="ml-auto shrink-0 rounded border px-2 py-1 text-[11px] font-medium hover:bg-muted"
          style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
        >
          Reset demo
        </button>
      </div>
    </header>
  );
}
