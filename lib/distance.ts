// UMN Twin Cities campus center (Northrop Mall). Used as the fallback
// origin when the user has no `homeBase` in their profile.
export const UMN_CAMPUS: { lat: number; lng: number } = {
  lat: 44.9740,
  lng: -93.2277,
};

// Average walking pace: 5 km/hr = 83.33 m/min. We round the minute result
// upward so short walks still show "1 min" rather than "0 min", and so
// time estimates err on the side of "leave a bit earlier."
const WALK_METERS_PER_MIN = 83.33;

// Haversine great-circle distance in meters. Deterministic, no deps.
export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLng * sinDLng;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Walking time in whole minutes, rounded up. Anything under 1 min rounds
// to 1 so the chip doesn't pretend walking takes zero time.
export function walkMinutes(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): number {
  const meters = haversineMeters(from, to);
  return Math.max(1, Math.ceil(meters / WALK_METERS_PER_MIN));
}

// If a destination geocodes far from the origin, it's almost certainly a
// mis-geocode (e.g., "Room 101" matched some random US address), not a
// genuine 200-km walk. Anything above this threshold is suppressed rather
// than rendered as "12000-min walk".
export const MAX_REASONABLE_WALK_MIN = 60;

export function walkMinutesOrNull(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): number | null {
  const mins = walkMinutes(from, to);
  return mins > MAX_REASONABLE_WALK_MIN ? null : mins;
}
