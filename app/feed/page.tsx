import { GoldyFeedClient } from '@/components/goldy-feed-client';
import { GoldyFab } from '@/components/goldy-fab';

export default function FeedPage() {
  return (
    <div
      className="goldy-theme min-h-[100dvh]"
      style={{
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 120px)',
      }}
    >
      <main className="mx-auto max-w-2xl px-4 py-5">
        <GoldyFeedClient />
      </main>
      <GoldyFab />
    </div>
  );
}
