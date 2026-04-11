import { describe, it, expect } from 'vitest';
import { googleCalendarUrl, outlookCalendarUrl } from './calendar-links';
import type { Event } from './schema';

const baseEvent: Event = {
  title: 'CSE Welcome Night',
  start: '2026-04-15T18:00:00-05:00', // 23:00:00 UTC
  end: '2026-04-15T20:00:00-05:00',
  location: 'Keller Hall 3-180',
  description: 'Pizza and intros.',
  category: 'networking',
  hasFreeFood: true,
  timezone: 'America/Chicago',
  confidence: 'high',
};

describe('googleCalendarUrl', () => {
  it('builds a render template URL with the correct date format', () => {
    const url = googleCalendarUrl(baseEvent);
    const parsed = new URL(url);
    expect(parsed.host).toBe('calendar.google.com');
    expect(parsed.pathname).toBe('/calendar/render');
    expect(parsed.searchParams.get('action')).toBe('TEMPLATE');
    expect(parsed.searchParams.get('text')).toBe('CSE Welcome Night');
    expect(parsed.searchParams.get('dates')).toBe('20260415T230000Z/20260416T010000Z');
    expect(parsed.searchParams.get('location')).toBe('Keller Hall 3-180');
    expect(parsed.searchParams.get('details')).toBe('Pizza and intros.');
    expect(parsed.searchParams.get('ctz')).toBe('America/Chicago');
  });

  it('synthesizes a 1-hour end when event.end is null', () => {
    const url = googleCalendarUrl({ ...baseEvent, end: null });
    const parsed = new URL(url);
    expect(parsed.searchParams.get('dates')).toBe('20260415T230000Z/20260416T000000Z');
  });

  it('omits optional fields when empty', () => {
    const url = googleCalendarUrl({
      ...baseEvent,
      location: null,
      description: null,
    });
    const parsed = new URL(url);
    expect(parsed.searchParams.has('location')).toBe(false);
    expect(parsed.searchParams.has('details')).toBe(false);
  });
});

describe('outlookCalendarUrl', () => {
  it('builds an outlook deeplink with ISO dates', () => {
    const url = outlookCalendarUrl(baseEvent);
    const parsed = new URL(url);
    expect(parsed.host).toBe('outlook.live.com');
    expect(parsed.pathname).toBe('/calendar/0/deeplink/compose');
    expect(parsed.searchParams.get('path')).toBe('/calendar/action/compose');
    expect(parsed.searchParams.get('rru')).toBe('addevent');
    expect(parsed.searchParams.get('subject')).toBe('CSE Welcome Night');
    expect(parsed.searchParams.get('startdt')).toBe('2026-04-15T18:00:00-05:00');
    expect(parsed.searchParams.get('enddt')).toBe('2026-04-15T20:00:00-05:00');
    expect(parsed.searchParams.get('location')).toBe('Keller Hall 3-180');
    expect(parsed.searchParams.get('body')).toBe('Pizza and intros.');
  });

  it('synthesizes a 1-hour end ISO when event.end is null', () => {
    const url = outlookCalendarUrl({ ...baseEvent, end: null });
    const parsed = new URL(url);
    const enddt = parsed.searchParams.get('enddt');
    expect(enddt).toBeTruthy();
    // enddt should be a valid ISO string exactly 1h after start
    const startMs = new Date(baseEvent.start).getTime();
    const endMs = new Date(enddt!).getTime();
    expect(endMs - startMs).toBe(60 * 60 * 1000);
  });
});
