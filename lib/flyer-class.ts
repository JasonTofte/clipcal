import type { Event } from '@/lib/schema';

// Shared heuristic: pick a flyer-art class based on the event's category
// and title keywords. Centralised so components (cards, camera-roll strip)
// stay in lockstep when the taxonomy shifts.

export const GAMEDAY_RX = /\b(game|axe|stadium|gophers|gophers vs|huntington)\b/i;
export const FOOD_RX =
  /\b(pizza|taco|donut|bagel|snack|coffee|food|lunch|brunch|dinner|treats|breakfast)\b/i;
export const HACK_RX = /\bhack/i;

export type FlyerClass =
  | 'flyer-game'
  | 'flyer-hack'
  | 'flyer-pizza'
  | 'flyer-career'
  | 'flyer-fest'
  | 'flyer-default';

export function flyerClass(event: Event): FlyerClass {
  const t = event.title.toLowerCase();
  const hay = `${t} ${event.description?.toLowerCase() ?? ''}`;
  if (event.category === 'sports' || GAMEDAY_RX.test(hay)) return 'flyer-game';
  if (event.category === 'hackathon' || HACK_RX.test(t)) return 'flyer-hack';
  if (event.hasFreeFood || FOOD_RX.test(t)) return 'flyer-pizza';
  if (event.category === 'career' || event.category === 'networking') return 'flyer-career';
  if (event.category === 'culture' || event.category === 'social') return 'flyer-fest';
  return 'flyer-default';
}

export function isGamedayEvent(event: Event): boolean {
  const hay = `${event.title} ${event.description ?? ''}`.toLowerCase();
  return event.category === 'sports' || GAMEDAY_RX.test(hay);
}

export function hasFreeFoodHeuristic(event: Event): boolean {
  return !!event.hasFreeFood || FOOD_RX.test(`${event.title} ${event.description ?? ''}`);
}
