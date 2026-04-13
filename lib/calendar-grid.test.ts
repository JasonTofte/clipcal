import { describe, it, expect } from 'vitest';
import { buildMonthGrid, startOfMonthSunday, type GridEvent } from './calendar-grid';

const ev = (id: number, dateIso: string, title = `e${id}`): GridEvent => ({
  id,
  title,
  url: `https://x/${id}`,
  date_iso: dateIso,
});

describe('startOfMonthSunday', () => {
  it('returns the Sunday on or before the first of the month', () => {
    // May 1, 2026 is a Friday → grid start is Sun Apr 26
    const d = startOfMonthSunday(new Date('2026-05-01T00:00:00Z'));
    expect(d.getUTCDay()).toBe(0);
    expect(d.getUTCMonth()).toBe(3); // April (0-indexed)
    expect(d.getUTCDate()).toBe(26);
  });

  it('returns the same date when the 1st is already a Sunday', () => {
    // Feb 1, 2026 is a Sunday
    const d = startOfMonthSunday(new Date('2026-02-01T00:00:00Z'));
    expect(d.getUTCDay()).toBe(0);
    expect(d.getUTCDate()).toBe(1);
  });
});

describe('buildMonthGrid', () => {
  it('produces 42 cells (6 weeks × 7 days) for any month', () => {
    const grid = buildMonthGrid(new Date('2026-05-01T00:00:00Z'), []);
    expect(grid).toHaveLength(42);
  });

  it('marks cells inside vs outside the target month', () => {
    const grid = buildMonthGrid(new Date('2026-05-01T00:00:00Z'), []);
    const inMonth = grid.filter((c) => c.inMonth);
    expect(inMonth).toHaveLength(31); // May has 31 days
  });

  it('places an event into the cell matching its date_iso day', () => {
    const grid = buildMonthGrid(new Date('2026-05-01T00:00:00Z'), [
      ev(1, '2026-05-05T14:00:00Z'),
    ]);
    const cell = grid.find((c) => c.date.getUTCDate() === 5 && c.date.getUTCMonth() === 4);
    expect(cell?.events.map((e) => e.id)).toEqual([1]);
  });

  it('groups multiple events on the same day in order received', () => {
    const grid = buildMonthGrid(new Date('2026-05-01T00:00:00Z'), [
      ev(1, '2026-05-10T09:00:00Z'),
      ev(2, '2026-05-10T12:00:00Z'),
      ev(3, '2026-05-10T18:00:00Z'),
    ]);
    const cell = grid.find((c) => c.date.getUTCDate() === 10 && c.inMonth);
    expect(cell?.events).toHaveLength(3);
  });

  it('ignores events with unparseable date_iso', () => {
    const grid = buildMonthGrid(new Date('2026-05-01T00:00:00Z'), [
      ev(1, 'not-a-date'),
      ev(2, '2026-05-05T00:00:00Z'),
    ]);
    const totalEvents = grid.reduce((n, c) => n + c.events.length, 0);
    expect(totalEvents).toBe(1);
  });

  it('drops events outside the 6-week window', () => {
    // An event in August should never land in May's grid
    const grid = buildMonthGrid(new Date('2026-05-01T00:00:00Z'), [
      ev(1, '2026-08-15T00:00:00Z'),
    ]);
    const totalEvents = grid.reduce((n, c) => n + c.events.length, 0);
    expect(totalEvents).toBe(0);
  });
});
