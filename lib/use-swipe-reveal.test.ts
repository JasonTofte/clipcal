import { describe, it, expect } from 'vitest';
import {
  swipeDecision,
  shouldCancelForScroll,
  clampOffset,
} from '@/lib/use-swipe-reveal';

describe('swipeDecision', () => {
  it('returns "right" when release dx >= threshold', () => {
    expect(
      swipeDecision({ dxAtRelease: 100, cancelled: false, threshold: 80 }),
    ).toBe('right');
  });
  it('returns "left" when release dx <= -threshold', () => {
    expect(
      swipeDecision({ dxAtRelease: -100, cancelled: false, threshold: 80 }),
    ).toBe('left');
  });
  it('returns null when below threshold', () => {
    expect(
      swipeDecision({ dxAtRelease: 30, cancelled: false, threshold: 80 }),
    ).toBe(null);
    expect(
      swipeDecision({ dxAtRelease: -50, cancelled: false, threshold: 80 }),
    ).toBe(null);
  });
  it('returns null when cancelled regardless of dx', () => {
    expect(
      swipeDecision({ dxAtRelease: 200, cancelled: true, threshold: 80 }),
    ).toBe(null);
    expect(
      swipeDecision({ dxAtRelease: -200, cancelled: true, threshold: 80 }),
    ).toBe(null);
  });
  it('treats dx exactly at threshold as commit', () => {
    expect(
      swipeDecision({ dxAtRelease: 80, cancelled: false, threshold: 80 }),
    ).toBe('right');
    expect(
      swipeDecision({ dxAtRelease: -80, cancelled: false, threshold: 80 }),
    ).toBe('left');
  });
});

describe('shouldCancelForScroll', () => {
  it('cancels when |dy| > cancelOnVerticalPx AND |dy| > |dx|', () => {
    expect(
      shouldCancelForScroll({ dx: 5, dy: 30, cancelOnVerticalPx: 14 }),
    ).toBe(true);
  });
  it('does NOT cancel when |dy| > threshold but |dx| dominates (already going horizontal)', () => {
    expect(
      shouldCancelForScroll({ dx: 50, dy: 30, cancelOnVerticalPx: 14 }),
    ).toBe(false);
  });
  it('does NOT cancel when vertical movement is below threshold', () => {
    expect(
      shouldCancelForScroll({ dx: 5, dy: 10, cancelOnVerticalPx: 14 }),
    ).toBe(false);
  });
  it('does NOT cancel at zero movement', () => {
    expect(
      shouldCancelForScroll({ dx: 0, dy: 0, cancelOnVerticalPx: 14 }),
    ).toBe(false);
  });
});

describe('clampOffset', () => {
  it('clamps positive overflow', () => {
    expect(clampOffset(1000, 160)).toBe(160);
  });
  it('clamps negative overflow', () => {
    expect(clampOffset(-1000, 160)).toBe(-160);
  });
  it('passes through values within bounds', () => {
    expect(clampOffset(50, 160)).toBe(50);
    expect(clampOffset(-50, 160)).toBe(-50);
    expect(clampOffset(0, 160)).toBe(0);
  });
});
