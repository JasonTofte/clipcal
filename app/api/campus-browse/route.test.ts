import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const sampleEvent = {
  id: 1,
  title: 'Sample',
  url: 'https://events.tc.umn.edu/1',
  date_iso: '2026-05-05T12:00:00Z',
  date_display: 'May 5',
  location: null,
  location_latitude: null,
  location_longitude: null,
  group_title: null,
  thumbnail: null,
  cost: null,
  has_registration: false,
  is_all_day: false,
  event_types: [],
};

// Each test loads the route module fresh so the in-memory cache is isolated.
async function loadRoute() {
  const mod = await import('./route');
  return mod.GET;
}

describe('/api/campus-browse GET', () => {
  const fetchBrowseMock = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    fetchBrowseMock.mockReset();
    vi.doMock('@/lib/livewhale', async () => {
      const actual = await vi.importActual<typeof import('@/lib/livewhale')>('@/lib/livewhale');
      return { ...actual, fetchBrowse: fetchBrowseMock };
    });
  });

  afterEach(() => {
    vi.doUnmock('@/lib/livewhale');
  });

  it('returns events and range on a valid request (cached: false)', async () => {
    fetchBrowseMock.mockResolvedValueOnce([sampleEvent]);
    const GET = await loadRoute();
    const res = await GET(
      new Request('http://localhost/api/campus-browse?startDate=2026-05-01&endDate=2026-05-31'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.events).toHaveLength(1);
    expect(body.cached).toBe(false);
    expect(body.range).toEqual({ startDate: '2026-05-01', endDate: '2026-05-31' });
    expect(fetchBrowseMock).toHaveBeenCalledOnce();
  });

  it('returns 400 when startDate is missing', async () => {
    const GET = await loadRoute();
    const res = await GET(new Request('http://localhost/api/campus-browse?endDate=2026-05-31'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it('returns 400 when endDate is missing', async () => {
    const GET = await loadRoute();
    const res = await GET(new Request('http://localhost/api/campus-browse?startDate=2026-05-01'));
    expect(res.status).toBe(400);
  });

  it('returns 400 on malformed startDate', async () => {
    const GET = await loadRoute();
    const res = await GET(
      new Request('http://localhost/api/campus-browse?startDate=2026-4-1&endDate=2026-05-31'),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 on non-date string', async () => {
    const GET = await loadRoute();
    const res = await GET(
      new Request('http://localhost/api/campus-browse?startDate=next-week&endDate=2026-05-31'),
    );
    expect(res.status).toBe(400);
  });

  it('AC-8: cache hit on identical (q, startDate, endDate) within TTL', async () => {
    fetchBrowseMock.mockResolvedValue([sampleEvent]);
    const GET = await loadRoute();
    const url = 'http://localhost/api/campus-browse?q=music&startDate=2026-05-01&endDate=2026-05-31';

    const first = await GET(new Request(url));
    const firstBody = await first.json();
    expect(firstBody.cached).toBe(false);

    const second = await GET(new Request(url));
    const secondBody = await second.json();
    expect(secondBody.cached).toBe(true);
    expect(secondBody.events).toHaveLength(1);

    expect(fetchBrowseMock).toHaveBeenCalledOnce();
  });

  it('cache miss when q differs but dates match', async () => {
    fetchBrowseMock.mockResolvedValue([sampleEvent]);
    const GET = await loadRoute();
    await GET(
      new Request('http://localhost/api/campus-browse?q=music&startDate=2026-05-01&endDate=2026-05-31'),
    );
    await GET(
      new Request('http://localhost/api/campus-browse?q=coding&startDate=2026-05-01&endDate=2026-05-31'),
    );
    expect(fetchBrowseMock).toHaveBeenCalledTimes(2);
  });

  it('returns empty events with 200 when fetchBrowse throws (AC-7)', async () => {
    fetchBrowseMock.mockRejectedValueOnce(new Error('upstream down'));
    const GET = await loadRoute();
    const res = await GET(
      new Request('http://localhost/api/campus-browse?startDate=2026-05-01&endDate=2026-05-31'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.events).toEqual([]);
    expect(body.cached).toBe(false);
  });

  it('returns 400 when max is not a positive integer', async () => {
    const GET = await loadRoute();
    const res = await GET(
      new Request(
        'http://localhost/api/campus-browse?startDate=2026-05-01&endDate=2026-05-31&max=abc',
      ),
    );
    expect(res.status).toBe(400);
  });

  it('cache miss when max differs (max is part of cache key)', async () => {
    fetchBrowseMock.mockResolvedValue([sampleEvent]);
    const GET = await loadRoute();
    await GET(
      new Request('http://localhost/api/campus-browse?startDate=2026-05-01&endDate=2026-05-31&max=5'),
    );
    await GET(
      new Request('http://localhost/api/campus-browse?startDate=2026-05-01&endDate=2026-05-31&max=50'),
    );
    expect(fetchBrowseMock).toHaveBeenCalledTimes(2);
  });

  it('passes q through to fetchBrowse including URL-encoded spaces', async () => {
    fetchBrowseMock.mockResolvedValueOnce([sampleEvent]);
    const GET = await loadRoute();
    await GET(
      new Request(
        'http://localhost/api/campus-browse?q=career%20fair&startDate=2026-05-01&endDate=2026-05-31',
      ),
    );
    expect(fetchBrowseMock).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'career fair', startDate: '2026-05-01', endDate: '2026-05-31' }),
    );
  });
});
