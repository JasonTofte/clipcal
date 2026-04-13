import type { Event } from '@/lib/schema';
import type { GoldyBucket, GoldyContext } from '@/lib/goldy-commentary';
import { formatEventWhen } from '@/lib/format';

// Given a bucket + event, produce a short "why Goldy picked this"
// explanation suitable for the expand-on-tap panel inside the speech
// bubble. Keeps the reasoning in one place so both the UI and any
// future log/export surface can reuse it.
export function buildGoldyWhy(event: Event, ctx: GoldyContext): string {
  const { bucket, slots } = ctx;
  const loc = event.location ?? 'unlisted location';

  switch (bucket) {
    case 'urgent':
      return [
        `Leave-by is right now. ${slots.walkMinutes ?? 12}-min walk to ${loc}.`,
        `Event starts at ${new Date(event.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}.`,
        'Your calendar doesn\u2019t show anything blocking. Your call.',
      ].join(' ');

    case 'conflict':
      return [
        `Overlaps ${slots.conflictTitle ?? 'something on your calendar'}.`,
        'Double-booking check runs against your demo calendar — conflict is real, not a guess.',
        'Tap Add anyway if the trade is worth it.',
      ].join(' ');

    case 'top-pick-gameday':
      return [
        'Gameday keywords + sports category.',
        `${formatEventWhen(event.start)} at ${loc}.`,
        'Student tix run out fast — worth grabbing early.',
      ].join(' ');

    case 'interest-match':
      return [
        `Matched your interest "${slots.interestHit ?? ''}" against this event\u2019s title and category.`,
        'No LLM call — just a client-side word-boundary match.',
      ].join(' ');

    case 'free-food':
      return [
        `Flagged hasFreeFood = true. Specific hint detected: "${slots.foodHint ?? 'free food'}".`,
        'Usually the small, human-scale events.',
      ].join(' ');

    case 'back-to-back':
      return [
        `${slots.nextEventTitle ?? 'Another event'} follows within 90 min of this.`,
        slots.walkMinutes
          ? `Different venue — I padded a ${slots.walkMinutes}-min walk into the math.`
          : 'Same venue — no walk to plan.',
      ].join(' ');

    case 'late-night':
      return [
        `Local start time is after 9 PM. This one runs past normal hours.`,
        'Not bad — just worth knowing before you commit.',
      ].join(' ');

    case 'weekend-open':
      return [
        'Saturday or Sunday event with nothing else booked in the slot.',
        'Your weekend is otherwise clear — easy add if it fits.',
      ].join(' ');

    case 'default':
    default:
      return [
        `Nothing particularly flashy — no conflict, no free food, no gameday or interest match.`,
        `Filed as a neutral option at ${formatEventWhen(event.start)}.`,
      ].join(' ');
  }
}

// Human-readable label for the bucket, used in the expand panel header.
export function bucketLabel(bucket: GoldyBucket): string {
  switch (bucket) {
    case 'urgent':
      return 'Urgent · leave-by in reach';
    case 'conflict':
      return 'Conflict · overlaps your calendar';
    case 'top-pick-gameday':
      return 'Top pick · gameday';
    case 'interest-match':
      return 'Interest match';
    case 'free-food':
      return 'Free food';
    case 'back-to-back':
      return 'Back-to-back';
    case 'late-night':
      return 'Late night';
    case 'weekend-open':
      return 'Weekend slot';
    case 'default':
    default:
      return 'Open slot';
  }
}
