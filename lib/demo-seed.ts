// Canonical demo seed data for the "Reset demo data" button.
//
// DEMO_PROFILE populates /profile so relevance scores light up immediately
// after a reset — no 90-second interview required to give a live pitch.
//
// DEMO_EVENT_BATCHES is intentionally empty: the demo flow scans real
// flyers live. Populate this array with saved extractions if you want the
// Feed to be pre-loaded after a reset.

import type { Profile } from './profile';
import type { StoredEventBatch } from './event-store';

export const DEMO_PROFILE: Profile = {
  major: 'Computer Science',
  stage: 'junior',
  interests: ['free food', 'tech talks', 'hackathons', 'gopher sports'],
  preferences: {
    showTradeoffs: true,
    surfaceNoticings: true,
  },
  vibe: 'builder energy — would rather ship than sit through a lecture',
  homeBase: null,
};

export const DEMO_EVENT_BATCHES: StoredEventBatch[] = [];
