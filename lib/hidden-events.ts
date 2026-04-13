// Soft-hide store for events the user has dismissed from /feed.
// Key shape: `${batchId}-${eventIndex}` — same as the feed row key
// used in goldy-feed-client, so no id generation is needed.
//
// Soft-hide (not delete) so:
// - The underlying batch data stays intact (Sherlock "inform don't
//   decide": never silently mutate user uploads).
// - Users can recover a mistake from the "Hidden (N) — show" pill.
// - A wrong dedup-merge decision stays reversible.

const HIDDEN_EVENTS_KEY = 'clipcal_hidden_events';

export function loadHiddenIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(HIDDEN_EVENTS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is string => typeof x === 'string'));
  } catch {
    return new Set();
  }
}

function saveHiddenIds(ids: Set<string>): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(HIDDEN_EVENTS_KEY, JSON.stringify([...ids]));
}

export function hideEvent(id: string): void {
  const current = loadHiddenIds();
  current.add(id);
  saveHiddenIds(current);
}

export function unhideEvent(id: string): void {
  const current = loadHiddenIds();
  current.delete(id);
  saveHiddenIds(current);
}

export function clearHiddenEvents(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(HIDDEN_EVENTS_KEY);
}
