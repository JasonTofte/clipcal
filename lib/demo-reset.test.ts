import { describe, it, expect, beforeEach } from 'vitest';
import { resetDemoData } from './demo-reset';
import { EVENT_STORE_KEY } from './event-store';
import { PROFILE_STORAGE_KEY } from './profile';
import { DEMO_PROFILE } from './demo-seed';

const HIDDEN_EVENTS_KEY = 'clipcal_hidden_events';
const DEMO_MODE_KEY = 'clipcal_demo_mode';
const CALM_MODE_KEY = 'clipcal_calm_mode_v1';
const NOTIFY_OPTIN_KEY = 'clipcal_leave_by_notify_optin';

describe('resetDemoData', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('clears parsed events, profile, and hidden events', () => {
    window.localStorage.setItem(EVENT_STORE_KEY, '[{"stale":true}]');
    window.localStorage.setItem(HIDDEN_EVENTS_KEY, '["batch_x-0"]');

    resetDemoData();

    expect(window.localStorage.getItem(EVENT_STORE_KEY)).toBeNull();
    expect(window.localStorage.getItem(HIDDEN_EVENTS_KEY)).toBeNull();
  });

  it('seeds the canonical profile', () => {
    resetDemoData();
    const stored = window.localStorage.getItem(PROFILE_STORAGE_KEY);
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!)).toEqual(DEMO_PROFILE);
  });

  it('preserves demo-calendar, calm-mode, and notify-optin preferences', () => {
    window.localStorage.setItem(DEMO_MODE_KEY, 'false');
    window.localStorage.setItem(CALM_MODE_KEY, 'true');
    window.localStorage.setItem(NOTIFY_OPTIN_KEY, 'true');

    resetDemoData();

    expect(window.localStorage.getItem(DEMO_MODE_KEY)).toBe('false');
    expect(window.localStorage.getItem(CALM_MODE_KEY)).toBe('true');
    expect(window.localStorage.getItem(NOTIFY_OPTIN_KEY)).toBe('true');
  });
});
