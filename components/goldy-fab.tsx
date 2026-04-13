import Link from 'next/link';
import { GoldyAvatar } from '@/components/goldy-avatar';

// Persistent primary CTA that sits above BottomNav. Restores the
// mockup's "Hey Goldy, I snapped a flyer" entry point — without this
// the snap-a-flyer loop has no prominent thumb-reachable affordance
// once the user is on /feed.
export function GoldyFab() {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-30 flex justify-center px-4"
      style={{
        bottom: 'calc(env(safe-area-inset-bottom) + 64px)',
      }}
    >
      <Link
        href="/"
        aria-label="Snap a flyer — go to upload"
        className="pointer-events-auto inline-flex min-h-[48px] items-center gap-2 rounded-full px-5 shadow-2xl transition"
        style={{
          background: 'var(--goldy-maroon-500)',
          color: 'var(--goldy-gold-400)',
        }}
      >
        <GoldyAvatar size={28} decorative />
        <span className="text-sm font-bold">Hey Goldy, I snapped a flyer</span>
      </Link>
    </div>
  );
}
