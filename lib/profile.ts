import { z } from 'zod';

export const AcademicStage = z.enum([
  'freshman',
  'sophomore',
  'junior',
  'senior',
  'grad',
]);

export const ProfilePreferences = z.object({
  showTradeoffs: z.boolean(),
  surfaceNoticings: z.boolean(),
});

// Geocoded "home base" for walk-distance computation. Optional/null — when
// absent, consumers fall back to UMN campus center.
export const HomeBase = z.object({
  address: z.string(),
  lat: z.number(),
  lng: z.number(),
});
export type HomeBase = z.infer<typeof HomeBase>;

export const ProfileSchema = z.object({
  major: z.string().nullable(),
  stage: AcademicStage.nullable(),
  interests: z.array(z.string()),
  preferences: ProfilePreferences,
  vibe: z.string().nullable(),
  // optional() so existing stored profiles without homeBase still parse.
  homeBase: HomeBase.nullable().optional(),
});

export type Profile = z.infer<typeof ProfileSchema>;

export const PROFILE_STORAGE_KEY = 'clipcal_profile';

export function loadProfileFromStorage(): Profile | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = ProfileSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function saveProfileToStorage(profile: Profile): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
}
