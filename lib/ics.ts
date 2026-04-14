import { createEvent, createEvents, type DateArray, type EventAttributes } from 'ics';
import type { Event } from '@/lib/schema';

function isoToUtcDateArray(iso: string): DateArray {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`invalid ISO date: ${iso}`);
  }
  return [
    d.getUTCFullYear(),
    d.getUTCMonth() + 1,
    d.getUTCDate(),
    d.getUTCHours(),
    d.getUTCMinutes(),
  ];
}

function eventToIcsAttributes(event: Event): EventAttributes {
  const start = isoToUtcDateArray(event.start);
  const shared = {
    start,
    startInputType: 'utc' as const,
    startOutputType: 'utc' as const,
    title: event.title,
    description: event.description ?? undefined,
    location: event.location ?? undefined,
    categories: [event.category],
  };

  if (event.end) {
    return {
      ...shared,
      end: isoToUtcDateArray(event.end),
      endInputType: 'utc' as const,
      endOutputType: 'utc' as const,
    };
  }

  return { ...shared, duration: { hours: 1 } };
}

export function buildIcsContent(events: Event[]): string {
  if (events.length === 0) {
    throw new Error('buildIcsContent: events array is empty');
  }

  if (events.length === 1) {
    const result = createEvent(eventToIcsAttributes(events[0]));
    if (result.error || !result.value) {
      throw result.error ?? new Error('ics generation failed');
    }
    return result.value;
  }

  const result = createEvents(events.map(eventToIcsAttributes));
  if (result.error || !result.value) {
    throw result.error ?? new Error('ics generation failed');
  }
  return result.value;
}

export function buildIcsBlobUrl(events: Event[]): string {
  const content = buildIcsContent(events);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  return URL.createObjectURL(blob);
}

export function buildIcsFilename(events: Event[]): string {
  const raw = events.length === 1 ? events[0].title || 'event' : 'showup-events';
  const slug = raw
    .replace(/[^a-z0-9-_ ]+/gi, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase();
  return `${slug || 'event'}.ics`;
}

export function triggerIcsDownload(events: Event[]): void {
  const url = buildIcsBlobUrl(events);
  const a = document.createElement('a');
  a.href = url;
  a.download = buildIcsFilename(events);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
