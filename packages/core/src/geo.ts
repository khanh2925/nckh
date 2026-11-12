import type { LatLng } from "./types";

// Đo đạc trên mặt phẳng cục bộ. Một địa điểm chỉ rộng vài km nên coi lat/lng là lưới phẳng tính bằng mét là đủ.
// 1° vĩ độ ≈ 110,6 km; 1° kinh độ co lại theo cos(vĩ độ).
const METERS_PER_LAT = 110574;
const metersPerLng = (lat: number) => 111320 * Math.cos((lat * Math.PI) / 180);

/** b đổi sang toạ độ (đông, bắc) tính bằng mét, gốc tại a */
export function toLocalMeters(a: LatLng, b: LatLng): { x: number; y: number } {
    return { x: (b.lng - a.lng) * metersPerLng(a.lat), y: (b.lat - a.lat) * METERS_PER_LAT };
}

/** Ngược với toLocalMeters: (đông, bắc) tính bằng mét quanh gốc origin -> lat/lng */
export function fromLocalMeters(origin: LatLng, x: number, y: number): LatLng {
    return { lat: origin.lat + y / METERS_PER_LAT, lng: origin.lng + x / metersPerLng(origin.lat) };
}

export function distance(a: LatLng, b: LatLng): number {
    const d = toLocalMeters(a, b);
    return Math.hypot(d.x, d.y);
}

/** Hướng từ a tới b, độ theo chiều kim đồng hồ từ hướng Bắc (0 = Bắc, 90 = Đông) */
export function bearing(a: LatLng, b: LatLng): number {
    const d = toLocalMeters(a, b);
    return ((Math.atan2(d.x, d.y) * 180) / Math.PI + 360) % 360;
}

/** Hiệu hai hướng trong khoảng (-180, 180]. Dương = phải. */
export function angleDiff(to: number, from: number): number {
    let d = (to - from) % 360;
    if (d > 180) d -= 360;
    if (d <= -180) d += 360;
    return d;
}

export interface SegmentSpot extends LatLng {
    /** 0 = tại a, 1 = tại b */
    t: number;
}

/** Điểm gần p nhất trên đoạn a–b */
export function closestPointOnSegment(p: LatLng, a: LatLng, b: LatLng): SegmentSpot {
    const ab = toLocalMeters(a, b);
    const ap = toLocalMeters(a, p);
    const lengthSquared = ab.x * ab.x + ab.y * ab.y;
    const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, (ap.x * ab.x + ap.y * ab.y) / lengthSquared));
    return { lat: a.lat + t * (b.lat - a.lat), lng: a.lng + t * (b.lng - a.lng), t };
}

export type Side = "trái" | "phải";

/** p nằm bên trái hay bên phải khi đi theo hướng a -> b */
export function sideOf(a: LatLng, b: LatLng, p: LatLng): Side {
    const ab = toLocalMeters(a, b);
    const ap = toLocalMeters(a, p);
    return ab.x * ap.y - ab.y * ap.x > 0 ? "trái" : "phải";
}

/** Điểm cách at một quãng "meters" theo hướng geoBearing */
export function offset(at: LatLng, geoBearing: number, meters: number): LatLng {
    const rad = (geoBearing * Math.PI) / 180;
    return {
        lat: at.lat + (Math.cos(rad) * meters) / METERS_PER_LAT,
        lng: at.lng + (Math.sin(rad) * meters) / metersPerLng(at.lat)
    };
}
