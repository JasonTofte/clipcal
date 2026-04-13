import type { StoredEventBatch } from '@/lib/event-store';

// Auto-seeded demo batch for first-time visitors to /feed. Gives the
// Goldy UI something to react to instead of an empty-state prompt.
// Marked with `id` starting `demo_` so the UI can show a reset link.

export const DEMO_SEED_ID = 'demo_goldy_v1';

// Build dates relative to "now" so the demo always feels fresh. We need
// events that:
//  - land on distinct days of the *current* week
//  - include one gameday (Saturday afternoon)
//  - include one free-food event back-to-back with the gameday
//  - include one interest-match hackathon during the workweek
function pickTargets(now: Date): { hack: Date; pizza: Date; game: Date } {
  const copy = new Date(now);
  copy.setHours(0, 0, 0, 0);
  const day = copy.getDay(); // 0 Sun .. 6 Sat
  // Distance to the next Saturday (inclusive); if today is Sat, use today.
  const daysToSat = day === 6 ? 0 : (6 - day + 7) % 7;
  const saturday = new Date(copy);
  saturday.setDate(copy.getDate() + daysToSat);

  const game = new Date(saturday);
  game.setHours(14, 30, 0, 0); // 2:30 PM
  const pizza = new Date(saturday);
  pizza.setHours(17, 0, 0, 0); // 5:00 PM, ~90 min after game ends

  // Hackathon on the Tuesday of the same week as Saturday.
  const tuesday = new Date(saturday);
  tuesday.setDate(saturday.getDate() - 4);
  tuesday.setHours(18, 0, 0, 0); // 6:00 PM

  return { hack: tuesday, pizza, game };
}

function toIso(d: Date): string {
  return d.toISOString();
}

export function buildDemoBatch(now: Date = new Date()): StoredEventBatch {
  const { hack, pizza, game } = pickTargets(now);
  const gameEnd = new Date(game.getTime() + 3.5 * 60 * 60 * 1000);
  const hackEnd = new Date(hack.getTime() + 3 * 60 * 60 * 1000);
  const pizzaEnd = new Date(pizza.getTime() + 2 * 60 * 60 * 1000);

  return {
    id: DEMO_SEED_ID,
    sourceNotes: 'Demo events — seeded on first visit to /feed.',
    addedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    icsCommitted: false,
    events: [
      {
        title: 'Gopher Hack 26',
        start: toIso(hack),
        end: toIso(hackEnd),
        location: 'Keller Hall 3-180',
        description:
          'Overnight student hackathon. Prizes, swag, espresso. Register at csesocial.umn.edu.',
        category: 'hackathon',
        hasFreeFood: true,
        timezone: 'America/Chicago',
        confidence: 'high',
      },
      {
        title: 'Gophers vs Badgers — Axe Game',
        start: toIso(game),
        end: toIso(gameEnd),
        location: 'Huntington Bank Stadium',
        description: "Paul Bunyan's Axe on the line. Student tickets $15.",
        category: 'sports',
        hasFreeFood: false,
        timezone: 'America/Chicago',
        confidence: 'high',
      },
      {
        title: 'Free Pizza + Linux Install Party',
        start: toIso(pizza),
        end: toIso(pizzaEnd),
        location: 'Walter Library 402',
        description:
          'Bring a laptop, leave with a working Linux install. Pizza provided while it lasts.',
        category: 'workshop',
        hasFreeFood: true,
        timezone: 'America/Chicago',
        confidence: 'high',
      },
    ],
  };
}

export function isDemoBatch(batchId: string): boolean {
  return batchId.startsWith('demo_');
}
