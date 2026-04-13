import { RelevanceBatchSchema, type RelevanceScore } from '@/lib/relevance';
import type { Profile } from '@/lib/profile';
import type { Event } from '@/lib/schema';
import type { CampusMatch, CampusMatchResponse } from '@/app/api/campus-match/route';
import type { OrgMatch, OrgMatchResponse } from '@/app/api/campus-orgs/route';

export async function fetchRelevance(
  events: Event[],
  profile: Profile,
): Promise<RelevanceScore[] | null> {
  try {
    const response = await fetch('/api/relevance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events, profile }),
    });
    if (!response.ok) return null;
    const json: unknown = await response.json();
    const parsed = RelevanceBatchSchema.safeParse(json);
    return parsed.success ? parsed.data.scores : null;
  } catch {
    return null;
  }
}

export async function fetchCampusMatches(
  events: Event[],
): Promise<(CampusMatch | null)[]> {
  return Promise.all(
    events.map(async (event) => {
      try {
        const res = await fetch('/api/campus-match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: event.title, start: event.start }),
        });
        if (!res.ok) return null;
        const json = (await res.json()) as CampusMatchResponse;
        return json.matches.length > 0 ? json.matches[0] : null;
      } catch {
        return null;
      }
    }),
  );
}

export async function fetchOrgMatches(
  events: Event[],
): Promise<(OrgMatch | null)[]> {
  return Promise.all(
    events.map(async (event) => {
      try {
        const res = await fetch('/api/campus-orgs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: event.title, start: event.start }),
        });
        if (!res.ok) return null;
        const json = (await res.json()) as OrgMatchResponse;
        return json.matches.length > 0 ? json.matches[0] : null;
      } catch {
        return null;
      }
    }),
  );
}
