import type { Event } from '@/lib/schema';

export type SignupChipState =
  | { kind: 'link'; href: string }
  | { kind: 'fallback' }
  | { kind: 'none' };

// Shared chip copy. Imported by every card/row that renders the gate so
// label edits flow to all surfaces at once.
export const SIGNUP_CHIP_LINK_LABEL = 'Sign up via flyer QR';
// Must contain the visible label per WCAG 2.5.3 (Label in Name) so voice
// control users can activate the chip by speaking its visible text.
export const SIGNUP_CHIP_LINK_ARIA = 'Sign up via flyer QR, opens in new tab';
export const SIGNUP_CHIP_FALLBACK_LABEL = 'QR on flyer — scan original';
export const SIGNUP_CHIP_FALLBACK_ARIA =
  'This flyer has a QR code. Open the original flyer on your phone and scan the QR code with your camera app.';

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
