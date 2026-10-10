import type { Geo, Proximity, Session } from "@/lib/types";

const R = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;

export function distanceMeters(a: Geo, b: Geo): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function requireProximity(): boolean {
  return (process.env.REQUIRE_PROXIMITY ?? "true").toLowerCase() !== "false";
}

export function maxDistance(): number {
  return Number(process.env.MAX_DISTANCE_METERS ?? 100);
}

export function evaluateProximity(s: Session): { proximity: Proximity; distanceMeters?: number } {
  if (!requireProximity()) return { proximity: "skipped" };
  if (!s.b || !s.a.geo || !s.b.geo) return { proximity: "unknown" };
  const d = distanceMeters(s.a.geo, s.b.geo);
  // allow for GPS noise: widen by the worse reported accuracy, capped at 50 m
  const slack = Math.min(50, Math.max(s.a.geo.accuracy ?? 0, s.b.geo.accuracy ?? 0));
  return {
    proximity: d <= maxDistance() + slack ? "ok" : "too_far",
    distanceMeters: Math.round(d),
  };
}
