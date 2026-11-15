import { buildDirections, currentStepIndex, type Step } from "./directions";
import { findRoute, isRouteError, legStart, pointAt, snapToRoute, type PointOnRoute, type Route, type RouteOptions } from "./routing";
import type { FloorPoint } from "./types";
import type { Place, VenueModel } from "./venueModel";

// Trạng thái một chuyến đi đang chỉ đường, viết dạng hàm thuần (reducer) để web và React Native dùng chung.

export type PositionSource = "qr" | "pick" | "place" | "sim" | "gps" | "pdr";

export interface Position extends FloorPoint {
    source: PositionSource;
    /** Mã QR / tên địa điểm đã dùng để định vị */
    label?: string;
    nodeId?: string;
    /** Khi đứng tại một địa điểm (source = "place") */
    placeId?: number;
    at?: number;
    /** Sai số GPS (m), khi source = "gps" */
    accuracy?: number;
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

/** Lập tuyến mới từ chỗ khách đang đứng (đi sai đường), không bám lại tuyến cũ */
function rerouteFrom(model: VenueModel, trip: Trip, point: Position, options: RouteOptions): Trip {
    const planned = planRoute(model, point, trip.to, options);
    if ("error" in planned) return trip;
    return { ...trip, from: point, route: planned, progress: 0, activeLeg: 0, metersSinceFix: 0, lastFixSource: point.source, rerouted: trip.rerouted + 1, arrived: false };
}

/**
 * Cửa sổ bám tuyến quanh chỗ khách đang đứng (mét dọc tuyến, trong chặng đang đi): lùi tối đa back, tiến tối đa ahead.
 * Vị trí mới chỉ được chọn trong cửa sổ này, nên chấm không nhảy sang nhánh khác của tuyến (tuyến vòng chữ U, hành lang
 * song song) và nếu ước lượng vọt xa thì chấm đuổi theo từng đoạn ngắn thay vì nhảy một lần.
 */
/**
 * Chỗ trên tuyến cho một vị trí đo được: trong cửa sổ quanh chỗ đang đứng nếu vị trí nằm sát phần tuyến đó;
 * không thì lấy chỗ gần nhất trên cả tuyến nhưng kẹp vào cửa sổ (đuổi theo từng đoạn, không nhảy cóc).
 */
function metersInWindow(route: Route, point: FloorPoint, anywhere: { gap: number; meters: number }, win: { from: number; to: number }, accuracy: number): number {
    const near = snapToRoute(route, point, win);
    if (near && near.gap <= Math.max(3, accuracy * 1.5)) return near.meters;
    return Math.min(win.to, Math.max(win.from, anywhere.meters));
}

function routeWindow(trip: Trip, back: number, ahead: number): { from: number; to: number; start: number; end: number } | null {
    const leg = trip.route.legs[trip.activeLeg];
    if (!leg) return null;
    const start = legStart(trip.route, trip.activeLeg);
    const end = start + leg.distance;
    return { from: Math.max(start, trip.progress - back), to: Math.min(end, trip.progress + ahead), start, end };
}

/** GPS chỉ dùng được ngoài trời; sai số lớn hơn thế (trong nhà, sát toà cao) thì bỏ qua, để bước chân lo */
export const GPS_USABLE_ACCURACY = 20;

/** Mỗi lần GPS cập nhật, chấm tiến dọc tuyến tối đa chừng này (m), cộng thêm 2 lần sai số GPS */
export const GPS_MAX_ADVANCE = 15;

/**
 * Cập nhật vị trí từ GPS trong lúc đi (khuôn viên, ngoài trời).
 * Gần tuyến thì kéo vị trí tới chỗ đó trên tuyến, chỉ trong cửa sổ quanh chỗ đang đứng (không nhảy cóc, không lùi vì GPS rung);
 * lệch hẳn khỏi tuyến thì lập lại tuyến. GPS nhảy bất thường đã bị loại trước đó (PlausibilityGate).
 */
export function gpsTripUpdate(model: VenueModel, trip: Trip, point: Position, options: RouteOptions = {}, now = Date.now()): Trip {
    const accuracy = point.accuracy ?? GPS_USABLE_ACCURACY;
    if (trip.arrived || accuracy > GPS_USABLE_ACCURACY) return trip;
    const anywhere = snapToRoute(trip.route, point);
    if (!anywhere) return trip;
    if (anywhere.gap > Math.max(25, accuracy * 2)) return fixTripPosition(model, trip, point, options);
    const win = routeWindow(trip, accuracy * 2, GPS_MAX_ADVANCE + accuracy * 2);
    if (!win) return trip;
    const meters = Math.min(win.end, Math.max(win.start, metersInWindow(trip.route, point, anywhere, win, accuracy)));
    // GPS rung qua lại vài mét: chỉ lùi khi lùi rõ ràng (hơn sai số)
    const progress = meters < trip.progress && trip.progress - meters < accuracy ? trip.progress : meters;
    const arrived = trip.activeLeg === trip.route.legs.length - 1 && progress >= win.end - Math.max(ARRIVE_WITHIN, Math.min(accuracy, 6));
    return { ...trip, progress, metersSinceFix: 0, lastFixSource: "gps", arrived, arrivedAt: arrived ? now : undefined };
}

/** Lệch khỏi tuyến hơn thế (m) và bộ lọc đã đủ chắc thì coi là đi sai đường, lập lại tuyến */
export const PDR_OFF_ROUTE = 10;
/** Mỗi lần bộ lọc cập nhật (một bước chân), chấm tiến dọc tuyến tối đa chừng này (m), cộng thêm sai số của bộ lọc */
export const PDR_MAX_ADVANCE = 4;

/**
 * Cập nhật vị trí từ bộ lọc hạt (bước chân + hướng + lối đi) trong lúc đi; point.accuracy = bán kính sai số của bộ lọc.
 * Đặt vị trí lên tuyến nhưng chỉ trong cửa sổ quanh chỗ khách đang đứng: không nhảy sang nhánh khác của tuyến,
 * ước lượng vọt xa thì chấm đuổi theo từng đoạn ngắn, rung lùi nhỏ hơn sai số thì giữ nguyên.
 * Chỉ lập lại tuyến khi bộ lọc đã báo rẽ nhầm (options.offRoute: lệch hướng tuyến nhiều bước liền), đã chắc (±6 m)
 * và đang cách tuyến xa: một lần ước lượng lệch đơn lẻ không đủ.
 */
export function pdrTripUpdate(
    model: VenueModel, trip: Trip, point: Position, options: RouteOptions & { offRoute?: boolean } = {}, now = Date.now()
): Trip {
    if (trip.arrived) return trip;
    const leg = trip.route.legs[trip.activeLeg];
    if (!leg || point.floorId !== leg.floorId) return trip;
    const accuracy = Math.max(1, point.accuracy ?? 5);
    const { offRoute, ...routeOptions } = options;
    const anywhere = snapToRoute(trip.route, point);
    if (!anywhere) return trip;
    if (offRoute && accuracy <= 6 && anywhere.gap > Math.max(PDR_OFF_ROUTE, accuracy * 2.5)) {
        return rerouteFrom(model, trip, { ...point, source: "pdr", label: point.label ?? "Vị trí ước lượng" }, routeOptions);
    }
    const win = routeWindow(trip, Math.max(3, accuracy * 2), PDR_MAX_ADVANCE + accuracy);
    if (!win) return trip;
    const meters = Math.min(win.end, Math.max(win.start, metersInWindow(trip.route, point, anywhere, win, accuracy)));
    const progress = meters < trip.progress && trip.progress - meters < accuracy ? trip.progress : meters;
    const arrived = trip.activeLeg === trip.route.legs.length - 1 && progress >= win.end - Math.max(ARRIVE_WITHIN, Math.min(accuracy, 5));
    return {
        ...trip, progress, metersSinceFix: trip.metersSinceFix + Math.max(0, progress - trip.progress), arrived, arrivedAt: arrived ? now : undefined
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
