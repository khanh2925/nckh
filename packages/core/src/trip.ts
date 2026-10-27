import { buildDirections, currentStepIndex, type Step } from "./directions";
import { findRoute, isRouteError, legStart, pointAt, snapToRoute, type PointOnRoute, type Route, type RouteOptions } from "./routing";
import type { FloorPoint } from "./types";
import type { Place, VenueModel } from "./venueModel";

// Trạng thái một chuyến đi đang chỉ đường, viết dạng hàm thuần (reducer) để web và React Native dùng chung.

export type PositionSource = "qr" | "pick" | "place" | "sim";

export interface Position extends FloorPoint {
    source: PositionSource;
    /** Mã QR / tên địa điểm đã dùng để định vị */
    label?: string;
    nodeId?: string;
    /** Khi đứng tại một địa điểm (source = "place") */
    placeId?: number;
    at?: number;
}

export interface PlannedRoute extends Route {
    steps: Step[];
}

export interface Trip {
    to: Place;
    from: Position;
    route: PlannedRoute;
    /** Quãng đã đi dọc tuyến (m) */
    progress: number;
    /** Chặng đang đi; chỉ tăng khi khách xác nhận đã đổi tầng */
    activeLeg: number;
    startedAt: number;
    qrFixes: number;
    metersSinceFix: number;
    lastFixSource: PositionSource;
    rerouted: number;
    arrived: boolean;
    arrivedAt?: number;
}

export function planRoute(model: VenueModel, from: FloorPoint, to: Place, options: RouteOptions = {}): PlannedRoute | { error: string } {
    const result = findRoute(model.walkways, from, to, options);
    if (isRouteError(result)) {
        const a = model.floorsById.get(from.floorId);
        const b = model.floorsById.get(to.floorId);
        if (a && b && a.buildingId !== b.buildingId && result.error.includes("chưa được nối")) {
            return { error: `Hai điểm ở hai toà nhà khác nhau (${a.buildingCode} và ${b.buildingCode}) và chưa có lối đi trong nhà nối hai toà. Hãy chọn điểm xuất phát trong ${b.buildingCode}.` };
        }
        return result;
    }
    const steps = buildDirections(result, { locations: model.locations, floorsById: model.floorsById, destination: to });
    return { ...result, steps };
}

export function startTrip(route: PlannedRoute, from: Position, to: Place, now = Date.now()): Trip {
    return {
        to, from, route, progress: 0, activeLeg: 0, startedAt: now, qrFixes: from.source === "qr" ? 1 : 0, metersSinceFix: 0,
        lastFixSource: from.source, rerouted: 0, arrived: false
    };
}

const ARRIVE_WITHIN = 2;

/** Tiến thêm "meters" dọc tuyến. Dừng ở cuối chặng, chờ khách xác nhận đổi tầng. */
export function advanceTrip(trip: Trip, meters: number, now = Date.now()): Trip {
    if (trip.arrived || meters <= 0) return trip;
    const leg = trip.route.legs[trip.activeLeg];
    if (!leg) return trip;
    const legEnd = legStart(trip.route, trip.activeLeg) + leg.distance;
    const progress = Math.min(legEnd, trip.progress + meters);
    const arrived = trip.activeLeg === trip.route.legs.length - 1 && progress >= legEnd - ARRIVE_WITHIN;
    return { ...trip, progress, metersSinceFix: trip.metersSinceFix + meters, arrived, arrivedAt: arrived ? now : undefined };
}

/** Đã tới cuối chặng hiện tại và còn chặng sau = đang chờ đổi tầng */
export function isAtFloorChange(trip: Trip): boolean {
    const leg = trip.route.legs[trip.activeLeg];
    if (!leg || trip.activeLeg >= trip.route.legs.length - 1) return false;
    return trip.progress >= legStart(trip.route, trip.activeLeg) + leg.distance - ARRIVE_WITHIN;
}

export function confirmFloorChange(trip: Trip): Trip {
    if (trip.activeLeg >= trip.route.legs.length - 1) return trip;
    const next = trip.activeLeg + 1;
    return { ...trip, activeLeg: next, progress: legStart(trip.route, next) };
}

/**
 * Vị trí chắc chắn mới trong lúc đang đi (quét QR / chọn trên bản đồ):
 * gần tuyến (≤ 15 m) thì nhảy tới chỗ đó trên tuyến; xa thì lập lại tuyến từ vị trí mới.
 */
export function fixTripPosition(model: VenueModel, trip: Trip, point: Position, options: RouteOptions = {}): Trip {
    const counted = point.source === "qr" ? 1 : 0;
    const snap = snapToRoute(trip.route, point);
    if (snap && snap.gap <= 15) {
        const at = pointAt(trip.route, snap.meters);
        return {
            ...trip, progress: snap.meters, activeLeg: at?.legIndex ?? trip.activeLeg, metersSinceFix: 0, lastFixSource: point.source,
            qrFixes: trip.qrFixes + counted, arrived: false
        };
    }
    const planned = planRoute(model, point, trip.to, options);
    if ("error" in planned) return trip;
    return {
        ...trip, from: point, route: planned, progress: 0, activeLeg: 0, metersSinceFix: 0, lastFixSource: point.source,
        qrFixes: trip.qrFixes + counted, rerouted: trip.rerouted + 1, arrived: false
    };
}

export interface TripView {
    here: PointOnRoute | null;
    stepIndex: number;
    step: Step | undefined;
    next: Step | undefined;
    /** Còn bao nhiêu mét tới động tác kế tiếp */
    toNext: number;
    remaining: number;
    remainingSeconds: number;
    atFloorChange: boolean;
}

/** Các số liệu màn hình cần, tính từ trạng thái chuyến đi */
export function viewTrip(trip: Trip): TripView {
    const steps = trip.route.steps;
    const atFloorChange = isAtFloorChange(trip);
    // Đang đứng ở chân thang: bước hiện tại là bước đổi tầng của chặng này
    const floorStep = atFloorChange ? steps.findIndex(s => s.legIndex === trip.activeLeg && s.kind.startsWith("floor")) : -1;
    const stepIndex = floorStep >= 0 ? floorStep : currentStepIndex(steps, trip.progress, trip.activeLeg);
    const step = steps[stepIndex];
    const next = steps[stepIndex + 1];
    const remaining = Math.max(0, trip.route.distance - trip.progress);
    return {
        here: pointAt(trip.route, trip.progress),
        stepIndex, step, next,
        toNext: next ? Math.max(0, next.at - trip.progress) : 0,
        remaining,
        remainingSeconds: trip.route.distance > 0 ? (trip.route.seconds * remaining) / trip.route.distance : 0,
        atFloorChange
    };
}
