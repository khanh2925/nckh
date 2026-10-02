import { projection } from "./mapProjection";

// The airport is only a few km wide, so lat/lng can be treated as a flat grid in meters.
// 1° of latitude ≈ 110.6 km; 1° of longitude shrinks with cos(latitude) (Tan Son Nhat ≈ 10.81°N).
const METERS_PER_LAT = 110574;
const METERS_PER_LNG = 111320 * Math.cos(10.81 * Math.PI / 180);

// Old locations only have x/y pixels on the first T1 drawing, newer ones have lat/lng
export function getLatLng(item) {
    if (item.lat != null && item.lng != null) return { lat: item.lat, lng: item.lng };
    const latlng = projection.toLatLng(item.x, item.y);
    return { lat: latlng.lat, lng: latlng.lng };
}

export function distance(a, b) {
    return Math.hypot((a.lat - b.lat) * METERS_PER_LAT, (a.lng - b.lng) * METERS_PER_LNG);
}

// Closest point to p on the segment a-b.
// t = how far along the segment (0 = at a, 1 = at b), found by projecting p onto the line a-b.
export function closestPointOnSegment(p, a, b) {
    const dx = (b.lng - a.lng) * METERS_PER_LNG;
    const dy = (b.lat - a.lat) * METERS_PER_LAT;
    const px = (p.lng - a.lng) * METERS_PER_LNG;
    const py = (p.lat - a.lat) * METERS_PER_LAT;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, (px * dx + py * dy) / lengthSquared));
    return { lat: a.lat + t * (b.lat - a.lat), lng: a.lng + t * (b.lng - a.lng), t };
}
