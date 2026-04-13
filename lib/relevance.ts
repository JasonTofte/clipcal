import { z } from 'zod';

export const RelevanceScoreSchema = z.object({
  score: z.number().int().min(0).max(100),
  reason: z.string().min(1),
});

export const RelevanceBatchSchema = z.object({
  scores: z.array(RelevanceScoreSchema),
});

export type RelevanceScore = z.infer<typeof RelevanceScoreSchema>;
export type RelevanceBatch = z.infer<typeof RelevanceBatchSchema>;

export function formatScoreBadge(score: number): string {
  return `${score}%`;
}

export function scoreTone(score: number): 'high' | 'medium' | 'low' {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

export function matchesInterests(
  event: { title: string; group_title: string | null; event_types: string[] },
  interests: string[],
): boolean {
  if (interests.length === 0) return false;

  const fields = [
    event.title,
    event.group_title ?? '',
    ...event.event_types,
  ].map((f) => f.toLowerCase());

  for (const interest of interests) {
    const token = interest.trim().toLowerCase();
    if (!token) continue;
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const boundary = new RegExp(`\\b${escaped}`);
    if (fields.some((f) => boundary.test(f))) return true;
  }

  return false;
}

type ScoreableEvent = {
  title: string;
  group_title: string | null;
  event_types: string[];
  cost?: string | null;
};

export function scoreEvent(event: ScoreableEvent, interests: string[]): number | null {
  const tokens = interests.map((i) => i.trim().toLowerCase()).filter(Boolean);
  if (tokens.length === 0) return null;

  const title = event.title.toLowerCase();
  const group = (event.group_title ?? '').toLowerCase();
  const types = event.event_types.map((t) => t.toLowerCase());

  let score = 10;
  for (const token of tokens) {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const boundary = new RegExp(`\\b${escaped}`);
    if (boundary.test(title)) score += 30;
    else if (boundary.test(group)) score += 20;
    else if (types.some((t) => boundary.test(t))) score += 20;
  }

  if (event.cost && event.cost.toLowerCase() === 'free') score += 5;

  return Math.min(score, 99);
}
