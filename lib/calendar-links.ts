import type { Event } from '@/lib/schema';

const DEFAULT_DURATION_MS = 60 * 60 * 1000;

function resolveEndIso(event: Event): string {
  if (event.end) return event.end;
  const startMs = new Date(event.start).getTime();
  return new Date(startMs + DEFAULT_DURATION_MS).toISOString();
}

function isoToGoogleDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`invalid ISO date: ${iso}`);
  }
  const pad = (n: number) => n.toString().padStart(2, '0');
  return (
    `${d.getUTCFullYear()}` +
    `${pad(d.getUTCMonth() + 1)}` +
    `${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}` +
    `${pad(d.getUTCMinutes())}` +
    `${pad(d.getUTCSeconds())}Z`
  );
}

export function googleCalendarUrl(event: Event): string {
  const start = isoToGoogleDate(event.start);
  const end = isoToGoogleDate(resolveEndIso(event));

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${start}/${end}`,
  });

  if (event.description) params.set('details', event.description);
  if (event.location) params.set('location', event.location);
  if (event.timezone) params.set('ctz', event.timezone);

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function outlookCalendarUrl(event: Event): string {
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: event.title,
    startdt: event.start,
    enddt: resolveEndIso(event),
  });

  if (event.description) params.set('body', event.description);
  if (event.location) params.set('location', event.location);

  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}
