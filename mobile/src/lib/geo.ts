/**
 * geo.ts — small maths helpers for safe zones (distance, moving a point, time windows).
 * Owner: Person 3/4 (Zuhayr). No package needed.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Distance in metres between two points (haversine formula).
 * Why haversine: accurate enough for zones of 50–500 m, and simple.
 */
export function distanceM(a: LatLng, b: LatLng): number {
  const R = 6_371_000; // Earth radius in metres
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** A point `t` of the way from a to b (t = 0..1). Used by the SAMPLE walk. */
export const lerp = (a: LatLng, b: LatLng, t: number): LatLng => ({
  lat: a.lat + (b.lat - a.lat) * t,
  lng: a.lng + (b.lng - a.lng) * t,
});

/** "07:30" → minutes after midnight (450), or null if the text isn't a valid 24 h time. */
export function parseHHMM(v: string): number | null {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(v.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** Minutes after midnight for a Date (phone's local time). */
export const minutesOf = (d: Date) => d.getHours() * 60 + d.getMinutes();

/**
 * Is `mins` inside the window from–to? Handles windows that cross midnight (e.g. 22:00–06:00).
 */
export function inWindow(mins: number, from: string, to: string): boolean {
  const f = parseHHMM(from);
  const t = parseHHMM(to);
  if (f === null || t === null) return false;
  return f <= t ? mins >= f && mins <= t : mins >= f || mins <= t;
}

/** Friendly "120 m" / "1.2 km". */
export const formatDistance = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);
