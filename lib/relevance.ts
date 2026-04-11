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
