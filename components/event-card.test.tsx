// @vitest-environment jsdom
import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { EventCard } from '@/components/event-card';
import type { Event } from '@/lib/schema';

// Vitest 4 runs with globals: false by default, which means RTL's automatic
// afterEach cleanup doesn't register itself. Without this, DOM from test N
// leaks into test N+1 and absence-assertions ("no note chip") spuriously fail.
afterEach(cleanup);

// Minimal stubs for heavy props that EventCard accepts but the chip tests
// do not exercise. Keeps test setup shallow and deterministic.
const noOp = () => {};

const baseEvent: Event = {
  title: 'Test Event',
  start: '2026-05-01T18:00:00',
  end: '2026-05-01T20:00:00',
  location: 'Test Hall',
  description: null,
  category: 'other',
  hasFreeFood: false,
  timezone: 'America/Chicago',
  confidence: 'high',
  venueSetting: null,
  crowdSize: null,
  dressCode: null,
  room: null,
  signupUrl: null,
  hasQR: false,
  starred: false,
};

const baseProps = {
  conflict: null,
  relevance: null,
  campusMatch: null,
  orgMatch: null,
  noticings: [],
  interests: null,
  leaveBy: null,
  busySlots: [],
  readOnly: true,
  posterSrc: null,
  onChange: noOp,
  onDownloadIcs: noOp,
  onOpenGoogle: noOp,
  onOpenOutlook: noOp,
};

describe('EventCard — signup chip (AC-1, AC-2, AC-3)', () => {
  // T-1 (AC-1) — link chip renders when signupUrl is set.
  // AC-1 specifies aria-label "Open signup link in new tab" (becomes the
  // accessible name for RTL queries) AND visible text "Sign up via flyer QR"
  // (user-visible label). We assert both separately.
  it('T-1: AC-1 — renders sign-up anchor with correct href, target, rel, aria-label, and visible text when signupUrl is present', () => {
    const event: Event = {
      ...baseEvent,
      signupUrl: 'https://z.umn.edu/beltsander',
      hasQR: true,
    };

    render(<EventCard {...baseProps} event={event} />);

    const link = screen.getByRole('link', { name: /sign up via flyer qr, opens in new tab/i });
    expect(link).toBeDefined();
    expect(link.getAttribute('href')).toBe('https://z.umn.edu/beltsander');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link.textContent).toMatch(/sign up via flyer qr/i);
  });

  // T-3 (AC-2) — fallback note chip renders when hasQR is true but no signupUrl
  it('T-3: AC-2 — renders fallback note chip with "QR on flyer — scan original" when hasQR is true and signupUrl is null', () => {
    const event: Event = {
      ...baseEvent,
      signupUrl: null,
      hasQR: true,
    };

    render(<EventCard {...baseProps} event={event} />);

    const chip = screen.getByRole('note');
    expect(chip).toBeDefined();
    expect(chip.textContent).toMatch(/QR on flyer.*scan original/i);
    // No anchor should be present
    expect(screen.queryByRole('link', { name: /sign up/i })).toBeNull();
  });

  // T-6 (AC-3) — neither chip renders when signupUrl is null and hasQR is false
  it('T-6: AC-3 — renders no signup link and no note chip when signupUrl is null and hasQR is false', () => {
    const event: Event = {
      ...baseEvent,
      signupUrl: null,
      hasQR: false,
    };

    render(<EventCard {...baseProps} event={event} />);

    expect(screen.queryByRole('link', { name: /sign up/i })).toBeNull();
    expect(screen.queryByRole('note')).toBeNull();
  });
});
