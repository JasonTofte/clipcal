'use client';

import { useCallback, useEffect, useState } from 'react';

export const CALM_MODE_STORAGE_KEY = 'clipcal_calm_mode_v1';

function readFromStorage(): boolean {
  try {
    return window.localStorage.getItem(CALM_MODE_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeToStorage(next: boolean): void {
  try {
    window.localStorage.setItem(CALM_MODE_STORAGE_KEY, String(next));
  } catch {
    // Swallow QuotaExceededError and similar — Calm Mode is a preference,
    // never load-bearing.
  }
}

function applyToDocument(next: boolean): void {
  if (typeof document === 'undefined') return;
  if (next) {
    document.body.dataset.calm = 'true';
  } else {
    delete document.body.dataset.calm;
  }
}

// Real React hook. SSR returns { calmMode: false } on first render to avoid
// hydration mismatch, then useEffect hydrates from localStorage after mount.
// This is what earns the AC-1 "within one frame" guarantee — local state
// drives the component re-render so the toggle knob moves immediately.
export function useCalmMode(): {
  calmMode: boolean;
  setCalmMode: (next: boolean) => void;
} {
  const [calmMode, setCalmModeState] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = readFromStorage();
    setCalmModeState(stored);
    applyToDocument(stored);
  }, []);

  const setCalmMode = useCallback((next: boolean) => {
    writeToStorage(next);
    applyToDocument(next);
    setCalmModeState(next);
  }, []);

  return { calmMode, setCalmMode };
}
