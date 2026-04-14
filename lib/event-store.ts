import { z } from 'zod';
import { EventSchema, type Event } from './schema';

export const StoredEventBatchSchema = z.object({
  id: z.string(),
  events: z.array(EventSchema),
  sourceNotes: z.string().nullable(),
  addedAt: z.string(),
  icsCommitted: z.boolean(),
});

export type StoredEventBatch = z.infer<typeof StoredEventBatchSchema>;

const StoredBatchArraySchema = z.array(StoredEventBatchSchema);

export const EVENT_STORE_KEY = 'showup_parsed_events';

function generateId(): string {
  // Not crypto-grade; just needs to be unique within a session.
  return `batch_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function loadBatches(): StoredEventBatch[] {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(EVENT_STORE_KEY);
  if (!raw) return [];
  try {
    const parsed = StoredBatchArraySchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

function saveBatches(batches: StoredEventBatch[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(EVENT_STORE_KEY, JSON.stringify(batches));
}

export function appendBatch(
  events: Event[],
  sourceNotes: string | null,
): StoredEventBatch {
  const batch: StoredEventBatch = {
    id: generateId(),
    events,
    sourceNotes,
    addedAt: new Date().toISOString(),
    icsCommitted: false,
  };
  const existing = loadBatches();
  saveBatches([...existing, batch]);
  return batch;
}

export function updateEventInBatch(batchId: string, eventIndex: number, updated: Event): void {
  const existing = loadBatches();
  const next = existing.map((b) => {
    if (b.id !== batchId) return b;
    const events = [...b.events];
    events[eventIndex] = updated;
    return { ...b, events };
  });
  saveBatches(next);
}

export function markBatchCommitted(batchId: string): void {
  const existing = loadBatches();
  const next = existing.map((b) =>
    b.id === batchId ? { ...b, icsCommitted: true } : b,
  );
  saveBatches(next);
}

export function clearAllBatches(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(EVENT_STORE_KEY);
}
