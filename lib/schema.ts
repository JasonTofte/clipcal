import { z } from 'zod';

export const EventCategory = z.enum([
  'workshop',
  'networking',
  'social',
  'cs',
  'career',
  'culture',
  'sports',
  'hackathon',
  'other',
]);

export const Confidence = z.enum(['high', 'medium', 'low']);

export const VenueSetting = z.enum(['indoor', 'outdoor', 'hybrid']).nullable();
export const CrowdSize = z.enum(['small', 'medium', 'large']).nullable();

export const EventSchema = z.object({
  title: z.string(),
  start: z.string(),
  end: z.string().nullable(),
  location: z.string().nullable(),
  description: z.string().nullable(),
  category: EventCategory,
  hasFreeFood: z.boolean(),
  timezone: z.string(),
  confidence: Confidence,
  venueSetting: VenueSetting.optional(),
  crowdSize: CrowdSize.optional(),
});

export const ExtractionSchema = z.object({
  events: z.array(EventSchema).min(1),
  sourceNotes: z.string().nullable(),
});

export type Event = z.infer<typeof EventSchema>;
export type Extraction = z.infer<typeof ExtractionSchema>;
