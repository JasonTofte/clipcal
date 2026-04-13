import type { Event } from '@/lib/schema';
import type { StoredEventBatch } from '@/lib/event-store';

// Auto-seeded demo batch for first-time visitors to /feed. Covers every
// Goldy bucket (urgent · conflict · gameday · interest-match · free-food ·
// back-to-back · late-night · weekend-open · default) across one
// current-week view, so every live commentary feature has something
// to latch onto during a demo.

export const DEMO_SEED_ID = 'demo_goldy_v2';

type DemoSpec = {
  // Offset from Monday of the current week, 0..6 (0 = Mon).
  dayOfWeek: number;
  // 24-hour local clock.
  hour: number;
  minute: number;
  // Duration in minutes.
  durationMin: number;
  title: string;
  location: string | null;
  description: string | null;
  category: Event['category'];
  hasFreeFood: boolean;
};

// Layout chosen so every bucket is hit and a few cards land in
// back-to-back pairs (same day, ≤90 min gap) without needing a
// location match.
const SPECS: DemoSpec[] = [
  // Monday — routine lecture (falls to default when no conflict fires)
  {
    dayOfWeek: 0,
    hour: 10, minute: 30,
    durationMin: 75,
    title: 'CSCI 5801 · lecture',
    location: 'Keller Hall 3-210',
    description: 'Software engineering — sprint review prep this week.',
    category: 'other',
    hasFreeFood: false,
  },
  // Monday evening — networking, career bucket
  {
    dayOfWeek: 0,
    hour: 18, minute: 30,
    durationMin: 90,
    title: 'CSE Career Fair prep night',
    location: 'Coffman Union',
    description: 'Recruiters + student panels. Bring a resume.',
    category: 'career',
    hasFreeFood: false,
  },
  // Tuesday evening — hackathon, typically hits interest-match if
  // "Hackathons" or "Tech / CS" is in the user's profile interests.
  {
    dayOfWeek: 1,
    hour: 18, minute: 0,
    durationMin: 180,
    title: 'Gopher Hack 26 kickoff',
    location: 'Keller Hall 3-180',
    description:
      'Overnight student hackathon. Prizes, swag, espresso. Register at csesocial.umn.edu.',
    category: 'hackathon',
    hasFreeFood: true,
  },
  // Wednesday — AI/ML club meeting (interest-match candidate)
  {
    dayOfWeek: 2,
    hour: 17, minute: 0,
    durationMin: 90,
    title: 'AI Club · LLM paper reading',
    location: 'Walter Library 402',
    description: 'Monthly paper club. This week: speculative decoding.',
    category: 'cs',
    hasFreeFood: false,
  },
  // Wednesday late — late-night bucket (>= 21:00 local)
  {
    dayOfWeek: 2,
    hour: 22, minute: 0,
    durationMin: 120,
    title: 'Late-night espresso jam',
    location: 'Bordertown Coffee',
    description: 'Open table for anyone coding past dinner. No sign-up.',
    category: 'social',
    hasFreeFood: false,
  },
  // Thursday noon — brief free-food
  {
    dayOfWeek: 3,
    hour: 12, minute: 0,
    durationMin: 45,
    title: 'Free bagels @ Walter',
    location: 'Walter Library lobby',
    description: 'Weekly iSchool meet-and-greet. Bagels + coffee while they last.',
    category: 'social',
    hasFreeFood: true,
  },
  // Friday afternoon — professor office hours (default bucket)
  {
    dayOfWeek: 4,
    hour: 14, minute: 0,
    durationMin: 60,
    title: 'Prof. Nguyen · office hours',
    location: 'Lind Hall 205',
    description: 'Drop-in for 5802 project questions.',
    category: 'other',
    hasFreeFood: false,
  },
  // Saturday mid-afternoon — gameday top-pick
  {
    dayOfWeek: 5,
    hour: 14, minute: 30,
    durationMin: 210,
    title: 'Gophers vs Badgers · Axe Game',
    location: 'Huntington Bank Stadium',
    description: "Paul Bunyan's Axe on the line. Student tickets $15.",
    category: 'sports',
    hasFreeFood: false,
  },
  // Saturday 5pm — free-food + back-to-back (pairs with the game above)
  {
    dayOfWeek: 5,
    hour: 17, minute: 0,
    durationMin: 120,
    title: 'Free Pizza + Linux Install Party',
    location: 'Walter Library 402',
    description:
      'Bring a laptop, leave with a working Linux install. Pizza provided while it lasts.',
    category: 'workshop',
    hasFreeFood: true,
  },
  // Sunday afternoon — weekend-open (when not hit by another higher bucket)
  {
    dayOfWeek: 6,
    hour: 14, minute: 0,
    durationMin: 180,
    title: 'International Festival · Northrop Plaza',
    location: 'Northrop Plaza',
    description: 'Food trucks, student orgs, live music.',
    category: 'culture',
    hasFreeFood: true,
  },
];

function startOfWeekMonday(now: Date): Date {
  const copy = new Date(now);
  copy.setHours(0, 0, 0, 0);
  const day = copy.getDay(); // 0 Sun .. 6 Sat
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

function toIso(d: Date): string {
  return d.toISOString();
}

function specToEvent(spec: DemoSpec, weekStart: Date): Event {
  const start = new Date(weekStart);
  start.setDate(weekStart.getDate() + spec.dayOfWeek);
  start.setHours(spec.hour, spec.minute, 0, 0);
  const end = new Date(start.getTime() + spec.durationMin * 60 * 1000);
  return {
    title: spec.title,
    start: toIso(start),
    end: toIso(end),
    location: spec.location,
    description: spec.description,
    category: spec.category,
    hasFreeFood: spec.hasFreeFood,
    timezone: 'America/Chicago',
    confidence: 'high',
  };
}

export function buildDemoBatch(now: Date = new Date()): StoredEventBatch {
  const weekStart = startOfWeekMonday(now);
  const events = SPECS.map((s) => specToEvent(s, weekStart));

  return {
    id: DEMO_SEED_ID,
    sourceNotes: 'Demo events — seeded on first visit to /feed.',
    addedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    icsCommitted: false,
    events,
  };
}

// Compute a demo `?now=` URL that lands the user ~12 minutes before
// the leave-by of the Tuesday hackathon kickoff — the cleanest moment
// to show the urgent bucket + day-of banner together during a demo.
export function computeDemoUrgentNowIso(now: Date = new Date()): string {
  const weekStart = startOfWeekMonday(now);
  const tuesday = new Date(weekStart);
  tuesday.setDate(weekStart.getDate() + 1);
  tuesday.setHours(18, 0, 0, 0); // matches hackathon kickoff spec
  // Default walk time is 12 min, so leave-by is 17:48 local. Pick now
  // as 17:36 local (12 min before leave-by) so the banner says "leave
  // in 12 min" and the urgent card pops.
  const demoNow = new Date(tuesday.getTime() - 24 * 60 * 1000);
  return demoNow.toISOString();
}

export function isDemoBatch(batchId: string): boolean {
  return batchId.startsWith('demo_');
}
