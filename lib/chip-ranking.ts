import type { Noticing } from './noticings';

export type ChipPriority = 'priority' | 'secondary';

export type RankedChip = Noticing & {
  priority: ChipPriority;
  rankKey: string;
};

type ChipTier = 'conflict' | 'interest' | 'walk' | 'time' | 'amenity';

function detectTier(noticing: Noticing): ChipTier {
  if (noticing.icon === '🔁' || noticing.text.toLowerCase().includes('back-to-back')) {
    return 'conflict';
  }
  if (noticing.icon === '⭐' || noticing.text.toLowerCase().includes('matches your interest')) {
    return 'interest';
  }
  if (noticing.icon === '🚶' || noticing.text.toLowerCase().includes('walk')) {
    return 'walk';
  }
  if (
    noticing.icon === '⚠' ||
    noticing.tone === 'heads-up' ||
    noticing.text.toLowerCase().includes('am class') ||
    noticing.text.toLowerCase().includes('pm class')
  ) {
    return 'time';
  }
  return 'amenity';
}

// Lower number = higher priority. When no real interests exist, interest chips demote to amenity level.
const TIER_WITH_INTERESTS: Record<ChipTier, number> = {
  conflict: 0,
  interest: 1,
  walk: 2,
  time: 3,
  amenity: 4,
};

// Empty-profile default order: time before walk. Reason: for ADHD/time-blind
// users a "leave by 6:43" constraint is more load-bearing than walk distance.
const TIER_NO_INTERESTS: Record<ChipTier, number> = {
  conflict: 0,
  time: 1,
  walk: 2,
  interest: 3,
  amenity: 3,
};

function hasRealInterests(interests: string[] | null | undefined): boolean {
  if (!interests) return false;
  return interests.some((i) => typeof i === 'string' && i.trim() !== '');
}

export function rankChips(
  noticings: Noticing[],
  interests: string[] | null | undefined,
): RankedChip[] {
  if (noticings.length === 0) return [];

  const withInterests = hasRealInterests(interests);
  const tierOrder = withInterests ? TIER_WITH_INTERESTS : TIER_NO_INTERESTS;

  const annotated = noticings.map((n, i) => ({
    noticing: n,
    tier: detectTier(n),
    originalIndex: i,
  }));

  annotated.sort((a, b) => {
    const tierDiff = tierOrder[a.tier] - tierOrder[b.tier];
    if (tierDiff !== 0) return tierDiff;
    // Same tier: sort by text for deterministic tie-breaking
    if (a.noticing.text < b.noticing.text) return -1;
    if (a.noticing.text > b.noticing.text) return 1;
    return a.originalIndex - b.originalIndex;
  });

  return annotated.map((item, sortedIndex) => {
    // Conflict chips share the exact key 'conflict' by convention; generateNoticings
    // produces at most one per event. Other tiers append originalIndex to prevent
    // React-key collisions when two chips in the same tier have identical text.
    const rankKey =
      item.tier === 'conflict'
        ? 'conflict'
        : `${item.tier}-${item.noticing.text.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 40)}-${item.originalIndex}`;
    // Intentional: when interests are empty, no chip is marked 'priority'.
    // The UI renders flat secondary + a nudge toward the profile interview.
    const priority: ChipPriority =
      withInterests && sortedIndex === 0 ? 'priority' : 'secondary';
    return {
      ...item.noticing,
      priority,
      rankKey,
    };
  });
}
