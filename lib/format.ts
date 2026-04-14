// Centralized date/time formatting. All app surfaces target a US/UMN
// audience, so en-US is the intentional default. Having one home for
// these formatters avoids drift across components and makes a future
// i18n pass a single-file change.

const LOCALE = 'en-US';

export function formatEventWhen(start: string): string {
  const d = new Date(start);
  if (Number.isNaN(d.getTime())) return start;
  const date = d.toLocaleDateString(LOCALE, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const time = d.toLocaleTimeString(LOCALE, {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${date} · ${time}`;
}

export function formatTimeRange(start: string, end: string | null | undefined): {
  dateLabel: string;
  timeLabel: string;
  durationLabel: string | null;
} {
  const s = new Date(start);
  if (Number.isNaN(s.getTime())) {
    return { dateLabel: start, timeLabel: '', durationLabel: null };
  }
  const dateLabel = s.toLocaleDateString(LOCALE, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const timeFmt: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
  const startTime = s.toLocaleTimeString(LOCALE, timeFmt);
  if (!end) return { dateLabel, timeLabel: startTime, durationLabel: null };
  const e = new Date(end);
  if (Number.isNaN(e.getTime())) return { dateLabel, timeLabel: startTime, durationLabel: null };
  const endTime = e.toLocaleTimeString(LOCALE, timeFmt);
  const mins = Math.round((e.getTime() - s.getTime()) / 60000);
  let duration: string | null = null;
  if (mins > 0) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    duration = h === 0 ? `${m}m` : m === 0 ? `${h}h` : `${h}h ${m}m`;
  }
  return { dateLabel, timeLabel: `${startTime} – ${endTime}`, durationLabel: duration };
}

// Convert ISO string to the "YYYY-MM-DDTHH:MM" format datetime-local inputs require,
// interpreted in the user's local timezone (which is what the native picker displays).
export function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromDatetimeLocal(value: string): string {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toISOString();
}

export function formatShortDate(start: string): string {
  const d = new Date(start);
  if (Number.isNaN(d.getTime())) return start;
  return d.toLocaleDateString(LOCALE, { month: 'short', day: 'numeric' });
}

export function formatWeekRange(weekStart: Date): string {
  const msPerDay = 24 * 60 * 60 * 1000;
  const end = new Date(weekStart.getTime() + 6 * msPerDay);
  const fmt = (d: Date) =>
    d.toLocaleDateString(LOCALE, { month: 'short', day: 'numeric' });
  return `${fmt(weekStart)} – ${fmt(end)}`;
}

export function formatWeekday(d: Date): string {
  return d.toLocaleDateString(LOCALE, { weekday: 'long' });
}
