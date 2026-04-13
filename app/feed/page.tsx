import { GoldyFeedClient } from '@/components/goldy-feed-client';
import { GoldyAvatar } from '@/components/goldy-avatar';
import { GoldyFab } from '@/components/goldy-fab';

export default function FeedPage() {
  return (
    <div
      className="goldy-theme min-h-[100dvh]"
      style={{
        paddingBottom:
          'calc(env(safe-area-inset-bottom) + 120px)',
      }}
    >
      <header
        className="sticky top-0 z-20 shadow-lg"
        style={{
          background: 'var(--goldy-maroon-500)',
          color: 'white',
          paddingTop: 'env(safe-area-inset-top)',
        }}
      >
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <GoldyAvatar size={44} showStatus />
            <div>
              <h1 className="goldy-display text-lg font-bold leading-tight">
                Gopherly
              </h1>
              <p
                className="text-[11px] leading-tight"
                style={{ color: 'var(--goldy-gold-300)' }}
              >
                Goldy · your campus sidekick
              </p>
            </div>
          </div>
          <span
            className="rounded-full px-3 py-1 text-[10px] font-bold"
            style={{
              background: 'var(--goldy-gold-400)',
              color: 'var(--goldy-maroon-600)',
            }}
          >
            Feed
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-5">
        <GoldyFeedClient />
      </main>
      <GoldyFab />
    </div>
  );
}
