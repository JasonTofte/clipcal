/**
 * ClipCal → Pi Zero e-ink sync
 *
 * Two transports, same payload format:
 *   WiFi — any browser on the same network: POST to Pi HTTP server (preferred)
 *   BLE  — Chrome on Android / desktop Chrome+Edge (Web Bluetooth API)
 */

const EINK_PI_URL =
  process.env.NEXT_PUBLIC_EINK_PI_URL ?? 'http://10.0.0.140:8080';

import type { Event } from '@/lib/schema';

export const BLE_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const WRITE_CHAR_UUID        = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';

// Compact JSON sent to the Pi — target <512 bytes
export interface EinkPayload {
  p: { t: string; tm: string; l: string; d?: string }; // priority event
  e: Array<{ t: string; tm: string; l?: string }>;     // rest of day
  ts: number;                                           // unix seconds
}

// ─── capability detection ────────────────────────────────────────────────────

export function isBleSupported(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
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

  // Trim until it fits one BLE write / URL paste
  while (JSON.stringify(payload).length > 510 && payload.e.length > 0) {
    payload.e.pop();
  }

  return payload;
}

// ─── BLE transport (Android / desktop Chrome) ───────────────────────────────

export async function syncToEinkBle(events: Event[]): Promise<void> {
  if (!isBleSupported()) {
    throw new Error(
      'Web Bluetooth is not available. Use Chrome on Android or desktop Chrome/Edge, ' +
      'or use the iOS sync code option.',
    );
  }

  const payload = await buildPayload(events);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const device = await (navigator as any).bluetooth.requestDevice({
    filters: [{ name: 'ClipCal' }],
    optionalServices: [BLE_SERVICE_UUID],
  });

  const server   = await device.gatt!.connect();
  const service  = await server.getPrimaryService(BLE_SERVICE_UUID);
  const writeChar = await service.getCharacteristic(WRITE_CHAR_UUID);

  await writeChar.writeValueWithResponse(
    new TextEncoder().encode(JSON.stringify(payload)),
  );

  device.gatt!.disconnect();
}

// ─── WiFi transport (any browser on same network) ───────────────────────────

export async function syncToEinkWifi(events: Event[]): Promise<void> {
  const payload = await buildPayload(events);
  const res = await fetch(`${EINK_PI_URL}/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Pi returned ${res.status}`);
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function filterUpcoming(events: Event[]): Event[] {
  const now = new Date();
  return events
    .filter((e) => new Date(e.start) >= now || (e.end != null && new Date(e.end) > now))
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
  const mins = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
  if (isNaN(mins) || mins <= 0) return undefined;
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h${m}m`;
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
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
