import type { Event } from '@/lib/schema';

export type SignupChipState =
  | { kind: 'link'; href: string }
  | { kind: 'fallback' }
  | { kind: 'none' };

// Card/row chip gate. A decoded or LLM-extracted URL always wins over
// the QR-detected hint, since a live link is more useful than a "scan
// the flyer yourself" prompt.
export function resolveSignupChip(
  event: Pick<Event, 'signupUrl' | 'hasQR'>,
): SignupChipState {
  if (event.signupUrl) return { kind: 'link', href: event.signupUrl };
  if (event.hasQR) return { kind: 'fallback' };
  return { kind: 'none' };
}
