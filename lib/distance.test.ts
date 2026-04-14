import { describe, it, expect } from 'vitest';
import { haversineMeters, walkMinutes, UMN_CAMPUS } from './distance';

describe('haversineMeters', () => {
  it('returns 0 for identical points', () => {
    expect(haversineMeters(UMN_CAMPUS, UMN_CAMPUS)).toBe(0);
  });

  it('matches a known short distance (UMN Northrop → Coffman Union ≈ 500m)', () => {
    // Coffman Memorial Union is at ~44.9720, -93.2353
    const coffman = { lat: 44.9720, lng: -93.2353 };
    const d = haversineMeters(UMN_CAMPUS, coffman);
    // Real is ~620m walking distance; Haversine (straight-line) is ~600m
    expect(d).toBeGreaterThan(500);
    expect(d).toBeLessThan(750);
  });

  it('is symmetric', () => {
    const a = { lat: 44.97, lng: -93.23 };
    const b = { lat: 44.98, lng: -93.24 };
    expect(haversineMeters(a, b)).toBeCloseTo(haversineMeters(b, a), 5);
  });

  it('handles antipodal points without NaN', () => {
    const result = haversineMeters({ lat: 0, lng: 0 }, { lat: 0, lng: 180 });
    expect(Number.isFinite(result)).toBe(true);
    // Earth's circumference / 2 ≈ 20,015 km
    expect(result).toBeGreaterThan(19_900_000);
    expect(result).toBeLessThan(20_100_000);
  });
});

describe('walkMinutes', () => {
  it('returns at least 1 minute for identical points (never 0)', () => {
    expect(walkMinutes(UMN_CAMPUS, UMN_CAMPUS)).toBe(1);
  });

  it('rounds up (ceiling) so time estimates err on leaving earlier', () => {
    // 84 meters is ~1.008 min at 83.33 m/min → rounds UP to 2
    const a = UMN_CAMPUS;
    // 84m north of a (1m ≈ 1/111000 deg lat)
    const b = { lat: a.lat + 84 / 111_000, lng: a.lng };
    expect(walkMinutes(a, b)).toBe(2);
  });

  it('returns a sensible walk time across campus (~7 min for 600m)', () => {
    const coffman = { lat: 44.9720, lng: -93.2353 };
    const mins = walkMinutes(UMN_CAMPUS, coffman);
    expect(mins).toBeGreaterThanOrEqual(7);
    expect(mins).toBeLessThanOrEqual(9);
  });
});
