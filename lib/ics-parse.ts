import ical from 'node-ical';

export type IcsEvent = {
  uid: string;
  summary: string;
  dtstart: string;
  dtend: string | null;
  location: string | null;
  description: string | null;
  organizer: string | null;
  url: string | null;
  categories: string[];
};

export function parseIcs(text: string): IcsEvent[] {
  const parsed = ical.sync.parseICS(text);
  const out: IcsEvent[] = [];

  for (const key of Object.keys(parsed)) {
    const entry = parsed[key];
    if (!entry || entry.type !== 'VEVENT') continue;

    const summary = typeof entry.summary === 'string' ? entry.summary : '';
    if (!summary) continue;

    const startDate = entry.start instanceof Date ? entry.start : null;
    const endDate = entry.end instanceof Date ? entry.end : null;

    const organizerRaw = entry.organizer as unknown;
    let organizer: string | null = null;
    if (organizerRaw && typeof organizerRaw === 'object') {
      const params = (organizerRaw as { params?: { CN?: string } }).params;
      organizer = params?.CN ?? null;
    } else if (typeof organizerRaw === 'string') {
      const cn = organizerRaw.match(/CN="?([^";\n]+)"?/);
      organizer = cn ? cn[1] : null;
    }

    const catsRaw = entry.categories as unknown;
    const categories = Array.isArray(catsRaw)
      ? catsRaw.map((c) => String(c).trim()).filter(Boolean)
      : typeof catsRaw === 'string'
        ? catsRaw
            .split(',')
            .map((c) => c.trim())
            .filter(Boolean)
        : [];

    out.push({
      uid: typeof entry.uid === 'string' ? entry.uid : key,
      summary,
      dtstart: startDate ? startDate.toISOString() : '',
      dtend: endDate ? endDate.toISOString() : null,
      location: typeof entry.location === 'string' ? entry.location : null,
      description: typeof entry.description === 'string' ? entry.description : null,
      organizer,
      url: typeof entry.url === 'string' ? entry.url : null,
      categories,
    });
  }

  return out;
}
