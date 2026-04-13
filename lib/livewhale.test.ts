import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { extractKeywords, dateWindow, fetchBrowse } from './livewhale';

describe('extractKeywords', () => {
  it('strips stopwords and returns top N tokens joined by +', () => {
    expect(extractKeywords('The Data Science Workshop for Beginners', 3))
      .toBe('data+science+workshop');
  });

  it('drops words shorter than 3 chars', () => {
    expect(extractKeywords('CS Club Tuesday Meetup', 3))
      .toBe('club+tuesday+meetup');
  });

  it('returns empty string when all tokens are stopwords', () => {
    expect(extractKeywords('the and of for', 3)).toBe('');
  });

  it('lowercases and strips non-alphanumeric', () => {
    expect(extractKeywords('AI/ML Research Lab!', 3)).toBe('aiml+research+lab');
  });
});

describe('dateWindow', () => {
  it('returns ±N day window as YYYY-MM-DD', () => {
    const w = dateWindow('2026-04-15T18:00:00Z', 3);
    expect(w).toEqual({ startDate: '2026-04-12', endDate: '2026-04-18' });
  });

  it('returns null for unparseable input', () => {
    expect(dateWindow('not a date', 3)).toBeNull();
  });
});

// Helpers shared across fetchBrowse tests
const makeEvent = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  title: 'Test Event',
  url: 'https://events.tc.umn.edu/1',
  date_iso: '2026-05-01T12:00:00Z',
  date: 'May 1, 2026',
  location: null,
  location_latitude: null,
  location_longitude: null,
  group_title: null,
  thumbnail: null,
  cost: null,
  has_registration: false,
  is_all_day: false,
  event_types: [],
  ...overrides,
});

function mockFetch(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

describe('fetchBrowse', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch([makeEvent()]));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds a valid URL path when q is empty (date-range-only)', async () => {
    const fetchSpy = mockFetch([makeEvent()]);
    vi.stubGlobal('fetch', fetchSpy);

    await fetchBrowse({ q: '', startDate: '2026-05-01', endDate: '2026-05-31' });

    expect(fetchSpy).toHaveBeenCalledOnce();
    const calledUrl: string = fetchSpy.mock.calls[0][0] as string;
    // Must include both dates and must NOT include an empty search keyword segment
    expect(calledUrl).toContain('2026-05-01');
    expect(calledUrl).toContain('2026-05-31');
    // URL should not contain a bare double-slash or empty keyword segment
    expect(calledUrl).not.toMatch(/\/search\/\/|\/search\//);
  });

  it('defaults max to 50 when omitted', async () => {
    const fetchSpy = mockFetch([makeEvent()]);
    vi.stubGlobal('fetch', fetchSpy);

    await fetchBrowse({ q: 'workshop', startDate: '2026-05-01', endDate: '2026-05-31' });

    const calledUrl: string = fetchSpy.mock.calls[0][0] as string;
    expect(calledUrl).toContain('/50');
  });

  it('clamps max of 0 up to 1', async () => {
    const fetchSpy = mockFetch([makeEvent()]);
    vi.stubGlobal('fetch', fetchSpy);

    await fetchBrowse({ q: 'workshop', startDate: '2026-05-01', endDate: '2026-05-31', max: 0 });

    const calledUrl: string = fetchSpy.mock.calls[0][0] as string;
    expect(calledUrl).toContain('/1');
  });

  it('clamps max of 500 down to 200', async () => {
    const fetchSpy = mockFetch([makeEvent()]);
    vi.stubGlobal('fetch', fetchSpy);

    await fetchBrowse({ q: 'workshop', startDate: '2026-05-01', endDate: '2026-05-31', max: 500 });

    const calledUrl: string = fetchSpy.mock.calls[0][0] as string;
    expect(calledUrl).toContain('/200');
  });

  it('passes through max of 150 unchanged', async () => {
    const fetchSpy = mockFetch([makeEvent()]);
    vi.stubGlobal('fetch', fetchSpy);

    await fetchBrowse({ q: 'workshop', startDate: '2026-05-01', endDate: '2026-05-31', max: 150 });

    const calledUrl: string = fetchSpy.mock.calls[0][0] as string;
    expect(calledUrl).toContain('/150');
  });

  it('parses LiveWhale v1 response shape (bare array)', async () => {
    vi.stubGlobal('fetch', mockFetch([makeEvent({ id: 42, title: 'v1 Event' })]));

    const result = await fetchBrowse({ q: '', startDate: '2026-05-01', endDate: '2026-05-31' });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(42);
    expect(result[0].title).toBe('v1 Event');
  });

  it('parses LiveWhale v2 response shape ({ data: [] })', async () => {
    vi.stubGlobal('fetch', mockFetch({ data: [makeEvent({ id: 99, title: 'v2 Event' })] }));

    const result = await fetchBrowse({ q: '', startDate: '2026-05-01', endDate: '2026-05-31' });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(99);
    expect(result[0].title).toBe('v2 Event');
  });

  it('returns [] on a non-2xx response', async () => {
    vi.stubGlobal('fetch', mockFetch('Not Found', 404));

    const result = await fetchBrowse({ q: 'workshop', startDate: '2026-05-01', endDate: '2026-05-31' });

    expect(result).toEqual([]);
  });

  it('returns [] when fetch rejects (timeout / abort)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError')));

    const result = await fetchBrowse({ q: 'workshop', startDate: '2026-05-01', endDate: '2026-05-31' });

    expect(result).toEqual([]);
  });
});
