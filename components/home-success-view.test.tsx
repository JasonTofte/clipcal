// @vitest-environment jsdom
import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { HomeSuccessView } from '@/components/home-success-view';
import type { Event } from '@/lib/schema';

afterEach(cleanup);

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
  events: [baseEvent],
  posterUrl: null,
  relevance: null,
  campusMatches: [null],
  orgMatches: [null],
  conflicts: [null],
  noticingsPerEvent: [[]],
  interests: null,
  leaveByPerEvent: [null],
  busySlots: [],
  canRetryWithSonnet: false,
  onUpdateEvent: noOp,
  onDownloadIcs: noOp,
  onDownloadAll: noOp,
  onReset: noOp,
  onRetryWithSonnet: noOp,
};

describe('HomeSuccessView — sourceNotes linkification (AC-8)', () => {
  // T-23 (AC-8) — sourceNotes containing a URL renders an <a> with correct attributes.
  // Queries by href attribute rather than accessible name so a future
  // aria-label addition can't silently retarget this test onto a
  // different element while the href assertions still pass.
  it('T-23: AC-8 — renders <a href="https://z.umn.edu/beltsander"> inside sourceNotes when URL is present', () => {
    const { container } = render(
      <HomeSuccessView
        {...baseProps}
        sourceNotes="QR reference at bottom mentions https://z.umn.edu/beltsander for more info"
      />,
    );

    const link = container.querySelector('a[href="https://z.umn.edu/beltsander"]');
    expect(link).not.toBeNull();
    expect(link!.getAttribute('target')).toBe('_blank');
    expect(link!.getAttribute('rel')).toBe('noopener noreferrer');
  });
});
