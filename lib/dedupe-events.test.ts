import { describe, it, expect } from 'vitest';
import { detectDuplicates, siblingDatesLabel } from './dedupe-events';
import type { Event } from './schema';

function mkEvent(title: string, isoDay: string): Event {
  return {
    title,
    start: `${isoDay}T18:00:00-05:00`,
    end: null,
    location: null,
    description: null,
    category: 'other',
    hasFreeFood: false,
    timezone: 'America/Chicago',
    confidence: 'high',
  };
}

describe('detectDuplicates', () => {
  it('ignores single-occurrence titles', () => {
    const idx = detectDuplicates([
      { rowKey: 'a', event: mkEvent('Solo', '2026-05-01') },
    ]);
    expect(idx.byRowKey.size).toBe(0);
  });

  it('clusters events within a 7-day window', () => {
    const idx = detectDuplicates([
      { rowKey: 'a', event: mkEvent('Tea Club', '2026-05-01') },
      { rowKey: 'b', event: mkEvent('tea club!', '2026-05-05') },
    ]);
    expect(idx.byRowKey.size).toBe(2);
    const cluster = idx.byRowKey.get('a');
    expect(cluster?.memberRowKeys).toEqual(['a', 'b']);
  });

  it('treats gaps >7 days as separate clusters', () => {
    const idx = detectDuplicates([
      { rowKey: 'a', event: mkEvent('Book Club', '2026-05-01') },
      { rowKey: 'b', event: mkEvent('Book Club', '2026-05-20') },
    ]);
    // Neither row should be flagged — no cluster has ≥2 members.
    expect(idx.byRowKey.size).toBe(0);
  });

  it('uses a sliding window — bridging rows keep the chain alive', () => {
    // Days 0, 5, 11: 0↔5 within 7d, 5↔11 within 7d. Previous anchor-to-first
    // behavior flushed day 11 because |11-0|=11 > 7. Sliding window keeps
    // all three in the same cluster.
    const idx = detectDuplicates([
      { rowKey: 'a', event: mkEvent('Yoga', '2026-05-01') },
      { rowKey: 'b', event: mkEvent('Yoga', '2026-05-06') },
      { rowKey: 'c', event: mkEvent('Yoga', '2026-05-12') },
    ]);
    const cluster = idx.byRowKey.get('a');
    expect(cluster?.memberRowKeys).toEqual(['a', 'b', 'c']);
  });

  it('siblingDatesLabel lists every other member', () => {
    const idx = detectDuplicates([
      { rowKey: 'a', event: mkEvent('Yoga', '2026-05-01') },
      { rowKey: 'b', event: mkEvent('Yoga', '2026-05-06') },
      { rowKey: 'c', event: mkEvent('Yoga', '2026-05-12') },
    ]);
    const label = siblingDatesLabel('b', idx);
    expect(label).toMatch(/^also on /);
    expect(label).toContain('May 1');
    expect(label).toContain('May 12');
  });

  it('normalizes titles across punctuation / case differences', () => {
    const idx = detectDuplicates([
      { rowKey: 'a', event: mkEvent('Ultra Hackathon!', '2026-05-01') },
      { rowKey: 'b', event: mkEvent('ultra   hackathon', '2026-05-03') },
    ]);
    expect(idx.byRowKey.size).toBe(2);
  });
});
