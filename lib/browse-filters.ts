import type { LiveWhaleEvent } from '@/lib/livewhale';

// === Date windows =========================================================
//
// The API call needs YYYY-MM-DD start + end. The active window also drives
// a stricter client-side filter so "today" doesn't match a Friday event
// that happens to be in the same API result set.

export type DateWindow =
  | 'today'
  | 'tomorrow'
  | 'this-week'
  | 'this-weekend'
  | 'this-month'
  | 'next-month';

export type DateRange = {
  startDate: string; // YYYY-MM-DD (UTC slice)
  endDate: string;
  label: string;
  // Optional precise local-day start/end for the client filter.
  startMs: number;
  endMs: number;
};

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function dayStartLocal(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function dayEndLocal(d: Date): Date {
  const c = new Date(d);
  c.setHours(23, 59, 59, 999);
  return c;
}

export function dateRangeFor(window: DateWindow, now: Date = new Date()): DateRange {
  const today = dayStartLocal(now);
  switch (window) {
    case 'today': {
      const end = dayEndLocal(now);
      return {
        startDate: isoDay(today),
        endDate: isoDay(end),
        label: 'Today',
        startMs: today.getTime(),
        endMs: end.getTime(),
      };
    }
    case 'tomorrow': {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const end = dayEndLocal(tomorrow);
      return {
        startDate: isoDay(tomorrow),
        endDate: isoDay(end),
        label: 'Tomorrow',
        startMs: tomorrow.getTime(),
        endMs: end.getTime(),
      };
    }
    case 'this-week': {
      // Week = today through next Sunday.
      const day = today.getDay(); // 0 Sun..6 Sat
      const daysToSun = day === 0 ? 0 : 7 - day;
      const end = new Date(today);
      end.setDate(end.getDate() + daysToSun);
      end.setHours(23, 59, 59, 999);
      return {
        startDate: isoDay(today),
        endDate: isoDay(end),
        label: 'This week',
        startMs: today.getTime(),
        endMs: end.getTime(),
      };
    }
    case 'this-weekend': {
      // Sat 00:00 → Sun 23:59. If today is Sun, just today.
      const day = today.getDay();
      const sat = new Date(today);
      if (day === 0) {
        // It's already Sunday — weekend = today only.
        return {
          startDate: isoDay(today),
          endDate: isoDay(dayEndLocal(today)),
          label: 'This weekend',
          startMs: today.getTime(),
          endMs: dayEndLocal(today).getTime(),
        };
      }
      const daysToSat = 6 - day;
      sat.setDate(sat.getDate() + daysToSat);
      const sun = new Date(sat);
      sun.setDate(sun.getDate() + 1);
      sun.setHours(23, 59, 59, 999);
      return {
        startDate: isoDay(sat),
        endDate: isoDay(sun),
        label: 'This weekend',
        startMs: sat.getTime(),
        endMs: sun.getTime(),
      };
    }
    case 'this-month': {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
      return {
        startDate: isoDay(start),
        endDate: isoDay(end),
        label: 'This month',
        startMs: start.getTime(),
        endMs: end.getTime(),
      };
    }
    case 'next-month': {
      const start = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 2, 0, 23, 59, 59, 999);
      return {
        startDate: isoDay(start),
        endDate: isoDay(end),
        label: 'Next month',
        startMs: start.getTime(),
        endMs: end.getTime(),
      };
    }
  }
}

// === Time of day ==========================================================

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'late';

const TIME_LABELS: Record<TimeOfDay, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
  late: 'Late',
};

export function timeLabel(t: TimeOfDay): string {
  return TIME_LABELS[t];
}

export function timeOfDayBucket(iso: string): TimeOfDay | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const h = d.getHours();
  if (h < 6) return 'late'; // pre-dawn = late
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  if (h < 21) return 'evening';
  return 'late';
}

// === What's-on flags ======================================================

export type WhatsOnFlag = 'free-food' | 'free-cost' | 'registration';

const FOOD_RX = /\b(pizza|taco|donut|bagel|snack|coffee|food|lunch|brunch|dinner|treats|breakfast)\b/i;

export function eventHasFreeFood(e: LiveWhaleEvent): boolean {
  return FOOD_RX.test(`${e.title} ${e.group_title ?? ''}`);
}

export function eventIsFree(e: LiveWhaleEvent): boolean {
  if (!e.cost) return false;
  return e.cost.trim().toLowerCase() === 'free';
}

// === Top event types from result set ======================================

// Returns event_type strings sorted by frequency, capped at `cap`.
// Powers the dynamic event-type chip row (no hardcoded taxonomy).
export function topEventTypes(events: LiveWhaleEvent[], cap = 8): string[] {
  const counts = new Map<string, number>();
  for (const e of events) {
    for (const t of e.event_types) {
      const k = t.trim();
      if (!k) continue;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, cap)
    .map(([k]) => k);
}

// === Apply all client-side filters ========================================

export type FilterState = {
  window: DateWindow;
  timesOfDay: ReadonlySet<TimeOfDay>;
  flags: ReadonlySet<WhatsOnFlag>;
  eventTypes: ReadonlySet<string>;
  interestsOnly: boolean; // priority sort; doesn't filter
};

export function applyFilters(
  events: LiveWhaleEvent[],
  state: FilterState,
  range: DateRange,
): LiveWhaleEvent[] {
  return events.filter((e) => {
    // Date window — compare by the event's own calendar day (first 10
    // chars of date_iso). Using absolute ms would mis-bucket all-day
    // events tagged at midnight Central when the user's browser runs in
    // a westward timezone (e.g. Apr 14 00:00 CT parses to Apr 13 22:00
    // PT, which falls before a "today" range built from local midnight).
    const eDay = e.date_iso.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(eDay)) {
      if (eDay < range.startDate || eDay > range.endDate) return false;
    }

    // Time of day. All-day events are excluded when a *partial* time-of-day
    // filter is active (otherwise filtering "evening" would surface every
    // all-day event). But when all 4 buckets are selected, the user is
    // saying "any time" — include all-day events too.
    if (state.timesOfDay.size > 0 && state.timesOfDay.size < 4) {
      if (e.is_all_day) return false;
      const bucket = timeOfDayBucket(e.date_iso);
      if (!bucket || !state.timesOfDay.has(bucket)) return false;
    }

    // What's-on flags — AND across selected.
    if (state.flags.has('free-food') && !eventHasFreeFood(e)) return false;
    if (state.flags.has('free-cost') && !eventIsFree(e)) return false;
    if (state.flags.has('registration') && !e.has_registration) return false;

    // Event types — OR within group, AND with other groups.
    if (state.eventTypes.size > 0) {
      const hit = e.event_types.some((t) => state.eventTypes.has(t));
      if (!hit) return false;
    }

    return true;
  });
}

// Active-filter summary text. Returns null when nothing is active.
export function summarizeFilters(state: FilterState, range: DateRange): string | null {
  const parts: string[] = [range.label.toLowerCase()];
  for (const t of state.timesOfDay) parts.push(timeLabel(t).toLowerCase());
  if (state.flags.has('free-food')) parts.push('free food');
  if (state.flags.has('free-cost')) parts.push('free');
  if (state.flags.has('registration')) parts.push('registration');
  for (const t of state.eventTypes) parts.push(t.toLowerCase());
  if (state.interestsOnly) parts.push('★ interests');
  return parts.length > 1 ? parts.join(' · ') : null;
}
