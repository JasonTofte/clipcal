import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  appendBatch,
  loadBatches,
  markBatchCommitted,
  clearAllBatches,
  EVENT_STORE_KEY,
} from './event-store';
import type { Event } from './schema';

function makeEvent(title: string): Event {
  return {
    title,
    start: '2026-04-15T18:00:00-05:00',
    end: null,
    location: 'Somewhere',
    description: null,
    category: 'other',
    hasFreeFood: false,
    timezone: 'America/Chicago',
    confidence: 'high',
  };
}

// Install a minimal localStorage mock before each test so the store
// functions (which guard typeof window) still operate.
beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    },
  });
});

describe('event store', () => {
  it('returns empty on first load', () => {
    expect(loadBatches()).toEqual([]);
  });

  it('appends a batch and returns it', () => {
    const batch = appendBatch([makeEvent('A')], null);
    expect(batch.events[0].title).toBe('A');
    expect(batch.icsCommitted).toBe(false);
    expect(batch.id).toMatch(/^batch_/);
  });

  it('persists appended batches across loadBatches calls', () => {
    appendBatch([makeEvent('A')], null);
    appendBatch([makeEvent('B')], 'some notes');
    const loaded = loadBatches();
    expect(loaded).toHaveLength(2);
    expect(loaded[0].events[0].title).toBe('A');
    expect(loaded[1].events[0].title).toBe('B');
    expect(loaded[1].sourceNotes).toBe('some notes');
  });

  it('marks a batch as committed by id', () => {
    const a = appendBatch([makeEvent('A')], null);
    appendBatch([makeEvent('B')], null);
    markBatchCommitted(a.id);
    const loaded = loadBatches();
    expect(loaded.find((b) => b.id === a.id)?.icsCommitted).toBe(true);
    expect(loaded.find((b) => b.id !== a.id)?.icsCommitted).toBe(false);
  });

  it('ignores unknown batch ids in markBatchCommitted', () => {
    appendBatch([makeEvent('A')], null);
    expect(() => markBatchCommitted('nope')).not.toThrow();
    expect(loadBatches()[0].icsCommitted).toBe(false);
  });

  it('recovers from corrupt JSON by returning empty', () => {
    window.localStorage.setItem(EVENT_STORE_KEY, '{not valid json');
    expect(loadBatches()).toEqual([]);
  });

  it('recovers from schema-mismatched JSON by returning empty', () => {
    window.localStorage.setItem(EVENT_STORE_KEY, JSON.stringify({ oops: 1 }));
    expect(loadBatches()).toEqual([]);
  });

  it('clearAllBatches wipes the store', () => {
    appendBatch([makeEvent('A')], null);
    clearAllBatches();
    expect(loadBatches()).toEqual([]);
  });
});
