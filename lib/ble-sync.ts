/**
 * ClipCal → Pi Zero e-ink sync
 *
 * Two transports, same payload format:
 *   WiFi — POST to Pi HTTP server (works on Chrome/Edge/Firefox; iOS
 *          Safari blocks HTTPS→HTTP-LAN unconditionally — for iOS use
 *          the Pi's captive-portal paste fallback in pi/http_server.py).
 *   BLE  — Web Bluetooth API (Chrome / Edge / Android Chrome only).
 *          Default ATT MTU is 23 bytes (20 bytes payload), so the
 *          payload is chunked into 20-byte writes.
 *
 * Pi URL must come from NEXT_PUBLIC_EINK_PI_URL — no hardcoded LAN IP
 * fallback. UI hides the sync button when the env var is unset.
 */

import type { Event } from '@/lib/schema';

const PI_URL = process.env.NEXT_PUBLIC_EINK_PI_URL ?? '';
// Shared-secret header required by pi/http_server.py /sync. Baked at build
// time — the Pi's isolated-AP origin is the only place this value is sent.
const PI_SYNC_TOKEN = process.env.NEXT_PUBLIC_EINK_SYNC_TOKEN ?? '';

export const BLE_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const WRITE_CHAR_UUID         = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
const NOTIFY_CHAR_UUID        = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';
const BLE_CHUNK_SIZE = 20; // ATT default 23 minus 3-byte ATT header

// Compact JSON sent to the Pi — target <512 bytes.
export interface EinkPayload {
  p: { t: string; tm: string; l: string; d?: string }; // priority event
  e: Array<{ t: string; tm: string; l?: string }>;     // rest of day
  ts: number;                                           // unix seconds
}

// ─── capability detection ────────────────────────────────────────────────────

export function isBleSupported(): boolean {
  if (typeof navigator === 'undefined') return false;
  return 'bluetooth' in navigator;
}

export function isWifiSupported(): boolean {
  return !!PI_URL;
}

// ─── payload chunker (exported for tests) ────────────────────────────────────

export function chunkBytes(bytes: Uint8Array, chunkSize = BLE_CHUNK_SIZE): Uint8Array[] {
  if (chunkSize <= 0) throw new Error('chunkSize must be > 0');
  if (bytes.length === 0) return [];
  const out: Uint8Array[] = [];
  for (let i = 0; i < bytes.length; i += chunkSize) {
    out.push(bytes.slice(i, i + chunkSize));
  }
  return out;
}

// ─── payload builder (shared by both transports) ────────────────────────────

export async function buildPayload(events: Event[]): Promise<EinkPayload> {
  const todayEvents = filterUpcoming(events);
  if (todayEvents.length === 0) throw new Error('No upcoming events to sync.');

  const abbreviated = await abbreviateEvents(todayEvents);
  const priorityEvent = todayEvents[0];
  const priorityAbbr  = abbreviated[0];
  const restAbbr      = abbreviated.slice(1);

  const payload: EinkPayload = {
    p: {
      t:  priorityAbbr.shortTitle,
      tm: formatTime(priorityEvent.start),
      l:  priorityAbbr.shortLoc ?? '',
      d:  durationLabel(priorityEvent.start, priorityEvent.end),
    },
    e: todayEvents.slice(1).map((evt, i) => ({
      t:  restAbbr[i]?.shortTitle ?? truncate(evt.title, 20),
      tm: formatTime(evt.start),
      ...(restAbbr[i]?.shortLoc ? { l: restAbbr[i].shortLoc ?? undefined } : {}),
    })),
    ts: Math.floor(Date.now() / 1000),
  };

  // Trim until it fits one BLE write / URL paste. Measure in UTF-8 bytes,
  // not JS string length — multi-byte characters (em-dashes, emoji in
  // abbreviations, accented venue names) otherwise let us overflow the
  // 510-byte BLE target.
  const encoder = new TextEncoder();
  while (
    encoder.encode(JSON.stringify(payload)).length > 510 &&
    payload.e.length > 0
  ) {
    payload.e.pop();
  }

  return payload;
}

// ─── BLE transport (Chrome / Edge / Android Chrome) ─────────────────────────

// Minimal Web Bluetooth shape we touch — keeps `as any` out of the call site.
type BluetoothDevice = {
  gatt?: {
    connect(): Promise<{
      getPrimaryService(uuid: string): Promise<{
        getCharacteristic(uuid: string): Promise<BluetoothCharacteristic>;
      }>;
    }>;
    disconnect(): void;
  };
};
type BluetoothCharacteristic = {
  writeValueWithResponse(data: BufferSource): Promise<void>;
  startNotifications?(): Promise<unknown>;
};
type BluetoothNamespace = {
  requestDevice(opts: {
    filters: Array<{ name?: string; services?: string[] }>;
    optionalServices?: string[];
  }): Promise<BluetoothDevice>;
};

function getBluetooth(): BluetoothNamespace | null {
  if (typeof navigator === 'undefined') return null;
  const n = navigator as unknown as { bluetooth?: BluetoothNamespace };
  return n.bluetooth ?? null;
}

export async function syncToEinkBle(events: Event[]): Promise<void> {
  const bt = getBluetooth();
  if (!bt) {
    throw new Error(
      'Web Bluetooth not available. Use Chrome / Edge / Android Chrome, or paste the sync code into the Pi captive portal.',
    );
  }

  const payload = await buildPayload(events);

  const device = await bt.requestDevice({
    filters: [{ name: 'ClipCal' }],
    optionalServices: [BLE_SERVICE_UUID],
  });

  if (!device.gatt) throw new Error('Selected device has no GATT.');
  const server = await device.gatt.connect();
  const service = await server.getPrimaryService(BLE_SERVICE_UUID);
  const writeChar = await service.getCharacteristic(WRITE_CHAR_UUID);

  // Subscribe to the TX characteristic *before* writing so we don't miss
  // the Pi's first response (per Google's Web Bluetooth samples).
  try {
    const notifyChar = await service.getCharacteristic(NOTIFY_CHAR_UUID);
    await notifyChar.startNotifications?.();
  } catch {
    // Pi peripheral may not expose the notify char — non-fatal, continue.
  }

  // Default ATT MTU is 23 bytes (20 bytes payload). Web Bluetooth doesn't
  // expose MTU negotiation, so we chunk every payload into 20-byte writes.
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  for (const chunk of chunkBytes(bytes, BLE_CHUNK_SIZE)) {
    // TS 5.7+ narrows Uint8Array<ArrayBufferLike>; BufferSource expects
    // ArrayBuffer-backed. Cast at the boundary — runtime types match.
    await writeChar.writeValueWithResponse(chunk as unknown as BufferSource);
  }

  device.gatt.disconnect();
}

// ─── WiFi transport (Chrome / Edge / Android Chrome / Firefox) ──────────────

export async function syncToEinkWifi(events: Event[]): Promise<void> {
  if (!isWifiSupported()) {
    throw new Error(
      'WiFi sync needs NEXT_PUBLIC_EINK_PI_URL set at build time. Set it to your Pi IP, e.g. http://10.0.0.140:8080.',
    );
  }

  const payload = await buildPayload(events);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (PI_SYNC_TOKEN) headers['X-Sync-Token'] = PI_SYNC_TOKEN;
  const res = await fetch(`${PI_URL}/sync`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  if (res.status === 401) {
    throw new Error(
      'Pi rejected sync (unauthorized). Set NEXT_PUBLIC_EINK_SYNC_TOKEN to the value on the Pi (/etc/clipcal/sync_token).',
    );
  }
  if (!res.ok) throw new Error(`Pi returned ${res.status}`);
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function filterUpcoming(events: Event[]): Event[] {
  const now = new Date();
  return events
    .filter(
      (e) => new Date(e.start) >= now || (e.end != null && new Date(e.end) > now),
    )
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '?';
  const h = d.getHours();
  const m = d.getMinutes();
  const suffix = h >= 12 ? 'p' : 'a';
  const h12 = h % 12 || 12;
  return m === 0 ? `${h12}${suffix}` : `${h12}:${String(m).padStart(2, '0')}${suffix}`;
}

function durationLabel(start: string, end: string | null): string | undefined {
  if (!end) return undefined;
  const mins = Math.round(
    (new Date(end).getTime() - new Date(start).getTime()) / 60000,
  );
  if (isNaN(mins) || mins <= 0) return undefined;
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h${m}m`;
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '\u2026';
}

async function abbreviateEvents(
  events: Event[],
): Promise<Array<{ shortTitle: string; shortLoc: string | null }>> {
  try {
    const res = await fetch('/api/abbreviate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events }),
    });
    if (!res.ok) throw new Error('abbreviate API error');
    const data = await res.json();
    return data.events;
  } catch {
    return events.map((e) => ({
      shortTitle: truncate(e.title, 20),
      shortLoc:   e.location ? truncate(e.location, 14) : null,
    }));
  }
}
