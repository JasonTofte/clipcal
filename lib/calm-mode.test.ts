// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useCalmMode, CALM_MODE_STORAGE_KEY } from './calm-mode';

// All DOM interaction is driven through jsdom (real document + localStorage).
// Hook is tested via renderHook so useState/useEffect run correctly.

function clearStore() {
  try {
    window.localStorage.clear();
  } catch {
    // ignore
  }
  delete document.body.dataset.calm;
}

describe('useCalmMode', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    clearStore();
  });

  // AC-1 T-1 — SSR safety is enforced by the `'use client'` directive +
  // useEffect-on-mount pattern. In jsdom the hook always runs client-side;
  // the SSR code path is validated by type signature alone (server returns
  // calmMode: false for the first render, then hydrates on mount).
  it('AC-1 T-1: initial render returns calmMode=false before effect hydration', () => {
    clearStore();
    const { result } = renderHook(() => useCalmMode());
    // After mount-effect, calmMode stays false since storage is empty.
    expect(result.current.calmMode).toBe(false);
    expect(document.body.dataset.calm).toBeUndefined();
  });

  it('AC-1 T-2: setCalmMode(true) writes localStorage and sets document.body.dataset.calm', () => {
    clearStore();
    const { result } = renderHook(() => useCalmMode());

    act(() => {
      result.current.setCalmMode(true);
    });

    expect(window.localStorage.getItem(CALM_MODE_STORAGE_KEY)).toBe('true');
    expect(document.body.dataset.calm).toBe('true');
    expect(result.current.calmMode).toBe(true);
  });

  it('AC-1 T-3: initializes calmMode to true when localStorage already contains "true"', () => {
    window.localStorage.setItem(CALM_MODE_STORAGE_KEY, 'true');

    const { result } = renderHook(() => useCalmMode());

    expect(result.current.calmMode).toBe(true);
    expect(document.body.dataset.calm).toBe('true');
  });

  it('AC-1 T-4: setCalmMode(false) after setCalmMode(true) removes data-calm and writes "false"', () => {
    clearStore();
    const { result } = renderHook(() => useCalmMode());

    act(() => result.current.setCalmMode(true));
    expect(document.body.dataset.calm).toBe('true');

    act(() => result.current.setCalmMode(false));

    expect(document.body.dataset.calm).toBeUndefined();
    expect(window.localStorage.getItem(CALM_MODE_STORAGE_KEY)).toBe('false');
    expect(result.current.calmMode).toBe(false);
  });

  it('AC-1 T-5: does not throw when localStorage.setItem throws (defensive write)', () => {
    const origSet = window.localStorage.setItem.bind(window.localStorage);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    const { result } = renderHook(() => useCalmMode());

    expect(() => act(() => result.current.setCalmMode(true))).not.toThrow();
    // DOM still mutates — storage failure is non-fatal.
    expect(document.body.dataset.calm).toBe('true');

    vi.restoreAllMocks();
    origSet(CALM_MODE_STORAGE_KEY, 'false'); // restore a clean slot
  });

  it('falls back to calmMode=false when localStorage contains a non-boolean string (e.g. "yes_please")', () => {
    window.localStorage.setItem(CALM_MODE_STORAGE_KEY, 'yes_please');

    const { result } = renderHook(() => useCalmMode());

    expect(result.current.calmMode).toBe(false);
  });

  it('falls back to calmMode=false and does not throw when localStorage.getItem throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });

    let result: ReturnType<typeof renderHook<ReturnType<typeof useCalmMode>, void>>;
    expect(() => {
      result = renderHook(() => useCalmMode());
    }).not.toThrow();
    expect(result!.result.current.calmMode).toBe(false);
  });

  it('exports CALM_MODE_STORAGE_KEY as "clipcal_calm_mode_v1"', () => {
    expect(CALM_MODE_STORAGE_KEY).toBe('clipcal_calm_mode_v1');
  });
});
