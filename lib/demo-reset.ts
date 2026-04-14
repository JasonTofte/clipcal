import { EVENT_STORE_KEY, clearAllBatches } from './event-store';
import { PROFILE_STORAGE_KEY, saveProfileToStorage } from './profile';
import { clearHiddenEvents } from './hidden-events';
import { DEMO_PROFILE, DEMO_EVENT_BATCHES } from './demo-seed';

// Preserved on purpose: clipcal_demo_mode (calendar toggle state),
// clipcal_calm_mode_v1 (accessibility pref), clipcal_leave_by_notify_optin
// (paired with a browser permission grant).
export function resetDemoData(): void {
  if (typeof window === 'undefined') return;

  clearAllBatches();
  window.localStorage.removeItem(PROFILE_STORAGE_KEY);
  clearHiddenEvents();

  saveProfileToStorage(DEMO_PROFILE);
  if (DEMO_EVENT_BATCHES.length > 0) {
    window.localStorage.setItem(EVENT_STORE_KEY, JSON.stringify(DEMO_EVENT_BATCHES));
  }
}
