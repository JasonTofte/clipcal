'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { syncToEinkWifi } from '@/lib/ble-sync';
import type { Event } from '@/lib/schema';

type SyncStatus = 'idle' | 'syncing' | 'done' | 'error';

export function EinkSyncButton({ events }: { events: Event[] }) {
  return <WifiSync events={events} />;
}

// ── WiFi path (any browser on the same network) ───────────────────────────────

function WifiSync({ events }: { events: Event[] }) {
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [error, setError]   = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  async function handleSync() {
    setStatus('syncing');
    setError(null);
    try {
      await syncToEinkWifi(events);
      setStatus('done');
      setLastSync(new Date());
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant={status === 'error' ? 'destructive' : 'outline'}
        onClick={handleSync}
        disabled={status === 'syncing'}
        className="gap-2 font-mono text-xs"
      >
        <span aria-hidden>▦</span>
        {status === 'syncing' ? 'syncing…'
          : status === 'done'   ? 'synced ✓'
          : status === 'error'  ? 'retry sync'
          : 'sync e-ink display'}
      </Button>
      {lastSync && status === 'done' && (
        <p className="text-[10px] text-muted-foreground">
          last sync {lastSync.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
        </p>
      )}
      {error && <p className="text-[10px] text-destructive">{error}</p>}
    </div>
  );
}
