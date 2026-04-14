'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { isWifiSupported, syncToEinkWifi } from '@/lib/ble-sync';
import type { Event } from '@/lib/schema';

type SyncStatus = 'idle' | 'syncing' | 'done' | 'error';

// Sync ShowUp's upcoming events to a Pi Zero e-ink display. Hidden when
// NEXT_PUBLIC_EINK_PI_URL is unset (PR A ships with no UI mount; PR B
// wires it into /feed).
//
// iOS Safari note: HTTPS Vercel → http://LAN is mixed-content blocked
// unconditionally on iOS. Workaround is the Pi's own WiFi AP captive
// portal (pi/http_server.py) — user joins the Pi's network and pastes
// the sync code. Documented in lib/ble-sync.ts.
export function EinkSyncButton({ events }: { events: Event[] }) {
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  if (!isWifiSupported()) return null;
  if (events.length === 0) return null;

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
        <span aria-hidden>\u25a6</span>
        {status === 'syncing'
          ? 'syncing\u2026'
          : status === 'done'
            ? 'synced \u2713'
            : status === 'error'
              ? 'retry sync'
              : 'sync e-ink'}
      </Button>
      {lastSync && status === 'done' && (
        <p className="text-[10px] text-muted-foreground">
          last sync{' '}
          {lastSync.toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit',
          })}
        </p>
      )}
      {error && <p className="text-[10px] text-destructive">{error}</p>}
    </div>
  );
}
