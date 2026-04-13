import type { Event } from '@/lib/schema';

const DUPLICATE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

// Normalize a title for comparison: lowercase, strip punctuation, collapse
// whitespace. Keeps `hack`/`hacking` distinct (we don't stem) but treats
// "Ultra Hackathon!" and "ultra hackathon" as the same string.
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// A duplicate cluster: events that share a normalized title and whose
// starts are within a 7-day window. Members are keyed by the caller's
// row key so the UI can look up group metadata without re-hashing.
export type DuplicateCluster = {
  titleKey: string;
  memberRowKeys: string[]; // e.g. "batch-3"
  memberStartIsos: string[];
};

export type DuplicateIndex = {
  // rowKey -> cluster containing that row (only populated for rows that
  // are actually in a multi-member cluster).
  byRowKey: Map<string, DuplicateCluster>;
};

export type DetectInput = {
  rowKey: string;
  event: Event;
};

export function detectDuplicates(rows: DetectInput[]): DuplicateIndex {
  // Bucket by normalized title.
  const byTitle = new Map<string, DetectInput[]>();
  for (const row of rows) {
    const key = normalizeTitle(row.event.title);
    if (!key) continue;
    const bucket = byTitle.get(key);
    if (bucket) bucket.push(row);
    else byTitle.set(key, [row]);
  }

  // For each title bucket, partition into 7-day sliding-window clusters
  // keyed by start time. A new row joins the active cluster if it is
  // within the window of the *previous* member (not the first) — this
  // is the correct sliding-window behavior: events at days {0, 5, 11}
  // all belong in the same cluster even though 0 and 11 are >7 days
  // apart, because 5 bridges them.
  const byRowKey = new Map<string, DuplicateCluster>();
  for (const [title, bucket] of byTitle.entries()) {
    if (bucket.length < 2) continue;
    const sorted = [...bucket].sort((a, b) => a.event.start.localeCompare(b.event.start));
    let active: DetectInput[] = [];
    for (const row of sorted) {
      if (active.length === 0) {
        active.push(row);
        continue;
      }
      const prevMs = new Date(active[active.length - 1].event.start).getTime();
      const rowMs = new Date(row.event.start).getTime();
      if (rowMs - prevMs <= DUPLICATE_WINDOW_MS) {
        active.push(row);
      } else {
        flushCluster(title, active, byRowKey);
        active = [row];
      }
    }
    flushCluster(title, active, byRowKey);
  }

  return { byRowKey };
}

function flushCluster(
  titleKey: string,
  rows: DetectInput[],
  out: Map<string, DuplicateCluster>,
): void {
  if (rows.length < 2) return;
  const cluster: DuplicateCluster = {
    titleKey,
    memberRowKeys: rows.map((r) => r.rowKey),
    memberStartIsos: rows.map((r) => r.event.start),
  };
  for (const r of rows) out.set(r.rowKey, cluster);
}

// Helper the UI can call to build a short sub-chip label like
// "also on Apr 15" (singular) or "also on Apr 15 · Apr 17" (two
// siblings). Returns null if no siblings exist (should never happen
// for a row that lives in the index, defensive only).
export function siblingDatesLabel(
  thisRowKey: string,
  index: DuplicateIndex,
): string | null {
  const cluster = index.byRowKey.get(thisRowKey);
  if (!cluster) return null;
  const siblings: string[] = [];
  for (let i = 0; i < cluster.memberRowKeys.length; i++) {
    if (cluster.memberRowKeys[i] === thisRowKey) continue;
    siblings.push(formatShortDay(cluster.memberStartIsos[i]));
  }
  if (siblings.length === 0) return null;
  return `also on ${siblings.join(' · ')}`;
}

function formatShortDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
