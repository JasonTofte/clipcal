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
