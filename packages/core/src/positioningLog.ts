import { closestPointOnSegment, distance } from "./geo";
import { HeadingFilter } from "./pdr";
import { ParticleFilter, StepGate, WeinbergStepDetector, headingFromOrientation, type ParticleFilterOptions, type WalkwayIndex } from "./positioning";
import type { FloorPoint, LatLng, WalkwayNetworkDto } from "./types";

// Nhật ký cảm biến của định vị nâng cao: app ghi lại khi đi thật, rồi chạy lại y hệt ở đây (Node/Vitest, cùng seed)
// để đo sai số tại các mốc QR và tinh chỉnh tham số mà không phải đi lại.

export type PositioningLogEvent =
    | { t: number; type: "motion"; x: number; y: number; z: number }
    /** abs = sự kiện là la bàn tuyệt đối (một số trình duyệt Android); screen = góc xoay màn hình */
    | { t: number; type: "orientation"; a: number; b: number; g: number; abs?: boolean; screen?: number }
    | { t: number; type: "route"; legs: { floorId: number; points: [number, number][] }[] }
    /** Mốc đặt lại vị trí: bắt đầu chuyến, quét QR, "Đã xong bước này", chọn trên bản đồ, đổi tầng */
    | { t: number; type: "anchor"; source: string; floorId: number; lat: number; lng: number; sigma: number; prior?: { absolute: number; spread: number } | null }
    | { t: number; type: "gps"; floorId: number; lat: number; lng: number; accuracy: number }
    /** GPS chỉ ghi lại để đối chiếu (không đưa vào bộ lọc), ví dụ khi tắt GPS mà vẫn ghi nhật ký ngoài trời */
    | { t: number; type: "gps-ref"; lat: number; lng: number; accuracy: number }
    | { t: number; type: "posture" }
    /** Ước lượng app đã tính lúc đi (để so với lúc chạy lại) */
    | { t: number; type: "estimate"; floorId: number; lat: number; lng: number; spread: number };

export interface PositioningLog {
    version: 1;
    venue: string;
    startedAt: string;
    device: string;
    settings: { stepLength: number; weinbergK: number | null };
    /** Mạng lối đi của địa điểm lúc ghi, để chạy lại không cần tải dữ liệu */
    walkways?: WalkwayNetworkDto;
    events: PositioningLogEvent[];
}

export interface ReplayCheckpoint {
    t: number;
    source: string;
    /** Khoảng cách từ vị trí bộ lọc đang tin tới mốc, ngay trước khi mốc sửa lại (m) */
    error: number;
    /** Bán kính sai số bộ lọc tự báo lúc đó (m) */
    spread: number;
    /** Cách cũ trên cùng lần đi: mỗi bước cộng stepLength dọc tuyến từ mốc trước (m); null nếu mốc không cùng tầng với tuyến */
    basicError: number | null;
}

export interface ReplayResult {
    checkpoints: ReplayCheckpoint[];
    steps: number;
    k: number | null;
}

type Polyline = { floorId: number; points: LatLng[] }[];

/** Mét dọc tuyến của điểm gần p nhất (chỉ xét các chặng cùng tầng); null nếu tuyến không qua tầng đó */
function metersAlong(route: Polyline, p: FloorPoint): number | null {
    let best: { gap: number; at: number } | null = null;
    let offset = 0;
    for (const leg of route) {
        for (let k = 1; k < leg.points.length; k++) {
            const a = leg.points[k - 1]!;
            const b = leg.points[k]!;
            const length = distance(a, b);
            if (leg.floorId === p.floorId) {
                const spot = closestPointOnSegment(p, a, b);
                const gap = distance(p, spot);
                if (!best || gap < best.gap) best = { gap, at: offset + length * spot.t };
            }
            offset += length;
        }
    }
    return best?.at ?? null;
}

/** Điểm cách đầu tuyến "meters" mét */
function pointAlong(route: Polyline, meters: number): FloorPoint | null {
    let left = Math.max(0, meters);
    let last: FloorPoint | null = null;
    for (const leg of route) {
        for (let k = 1; k < leg.points.length; k++) {
            const a = leg.points[k - 1]!;
            const b = leg.points[k]!;
            const length = distance(a, b);
            if (length >= left) {
                const t = length === 0 ? 0 : left / length;
                return { floorId: leg.floorId, lat: a.lat + t * (b.lat - a.lat), lng: a.lng + t * (b.lng - a.lng) };
            }
            left -= length;
            last = { floorId: leg.floorId, lat: b.lat, lng: b.lng };
        }
    }
    return last;
}

/**
 * Chạy lại một nhật ký qua đúng chuỗi xử lý của app (đếm bước -> lọc nhịp -> bộ lọc hạt),
 * đồng thời tính cách cũ (mỗi bước cộng stepLength dọc tuyến) để so sánh trên cùng một lần đi.
 */
export function replayPositioningLog(log: PositioningLog, index: WalkwayIndex, options: Partial<ParticleFilterOptions> = {}): ReplayResult {
    const filter = new ParticleFilter(index, { seed: 1, learnedK: log.settings.weinbergK, stepLength: { mean: log.settings.stepLength, spread: 0.2 }, ...options });
    const detector = new WeinbergStepDetector();
    const gate = new StepGate();
    const smooth = new HeadingFilter(0.5);
    let heading: number | null = null;
    let absolute = false;
    let steps = 0;
    const checkpoints: ReplayCheckpoint[] = [];
    // cách cũ: mét dọc tuyến = vị trí mốc trước + số bước × stepLength
    let route: Polyline | null = null;
    let basicMeters: number | null = null;
    for (const e of log.events) {
        switch (e.type) {
            case "orientation":
                heading = smooth.push(headingFromOrientation(e.a, e.b, e.g) + (e.screen ?? 0));
                absolute = Boolean(e.abs);
                break;
            case "motion": {
                const sample = detector.push(e.x, e.y, e.z, e.t);
                if (sample && basicMeters != null) basicMeters += log.settings.stepLength;
                if (!sample || heading == null) break;
                for (const s of gate.push(sample)) {
                    filter.step(s, heading, absolute ? 12 : undefined);
                    steps++;
                }
                break;
            }
            case "route":
                route = e.legs.map(l => ({ floorId: l.floorId, points: l.points.map(([lat, lng]) => ({ lat, lng })) }));
                filter.setRoute(route);
                break;
            case "anchor": {
                const est = filter.estimate();
                if (est && e.source !== "pdr") {
                    const basic = route && basicMeters != null ? pointAlong(route, basicMeters) : null;
                    checkpoints.push({
                        t: e.t, source: e.source, error: est.floorId === e.floorId ? distance(est, e) : Infinity, spread: est.spread,
                        basicError: basic && basic.floorId === e.floorId ? distance(basic, e) : null
                    });
                }
                filter.reset({ floorId: e.floorId, lat: e.lat, lng: e.lng }, e.sigma, e.prior ?? null);
                basicMeters = route ? metersAlong(route, e) : null;
                break;
            }
            case "gps":
                filter.observe({ floorId: e.floorId, lat: e.lat, lng: e.lng }, Math.max(3, e.accuracy));
                break;
            case "posture":
                filter.loosen();
                break;
            default:
                break;
        }
    }
    return { checkpoints, steps, k: filter.estimate()?.k ?? null };
}
