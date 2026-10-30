import { angleDiff, bearing, closestPointOnSegment, distance, sideOf, type Side } from "./geo";
import type { Route, RoutePoint } from "./routing";
import { formatMeters } from "./text";
import type { FloorDto, LatLng, LocationDto } from "./types";

// Biến tuyến đường thành chỉ dẫn từng bước dễ hiểu, bám theo mốc:
// "Đi thẳng 60 m · qua Highlands bên trái", "Rẽ trái tại Quầy thông tin", "Đi thang cuốn lên Tầng 2", "Đến Cửa 12".

export type StepKind =
    | "depart" | "straight" | "left" | "right" | "slight-left" | "slight-right" | "uturn" | "floor-up" | "floor-down" | "arrive";

export interface Step {
    kind: StepKind;
    title: string;
    detail: string;
    /** Đi bao nhiêu mét sau động tác của bước này, tới bước sau */
    distance: number;
    /** Quãng cộng dồn từ đầu tuyến tới chỗ bắt đầu bước */
    at: number;
    legIndex: number;
    point: LatLng;
    connector?: string;
    fromFloorId?: number;
    toFloorId?: number;
}

type Landmark = Pick<LocationDto, "id" | "name" | "type" | "floorId"> & LatLng;

const TURN_MIN = 32; // đổi hướng ít hơn thế coi như đi thẳng
const SHARP = 65;
const UTURN = 150;
const MIN_SEGMENT = 6; // đoạn ngắn hơn 6 m gộp vào đoạn bên cạnh (tránh "rẽ trái, rẽ phải" liên tục)
const MERGE_TURNS = 10; // hai lượt rẽ cùng phía gần hơn thế gộp làm một
// Không gian nhỏ (căn hộ, văn phòng): ngưỡng co lại theo độ dài chặng, để không nuốt mất lượt rẽ vào cửa.
// Chặng ≥ 50 m giữ nguyên ngưỡng gốc; chặng 13 m -> gộp đoạn < 1,6 m, gộp rẽ < 2,6 m.
const scaled = (legMeters: number, ratio: number, min: number, max: number) => Math.min(max, Math.max(min, legMeters * ratio));
const LANDMARK_RADIUS = 14;
// Loại địa điểm dễ thấy, hay dùng làm mốc. "other" và thang thì không.
const LANDMARK_TYPES = new Set([
    "coffee", "restaurant", "shop", "information", "restroom", "checkin", "gate", "security", "atm", "lounge", "baggage", "ticket", "medical",
    // loại chung cho toà nhà nhỏ, căn hộ, văn phòng
    "entrance", "room"
]);
// Phòng, cửa: chỉ dùng làm mốc rẽ ("rẽ phải tại Bếp"), không nói "đi qua" (trong nhà nhỏ, phòng nào cũng "đi qua")
const TURN_ONLY_TYPES = new Set(["entrance", "room"]);

const TURN_TITLE: Record<"left" | "right" | "slight-left" | "slight-right" | "uturn", string> = {
    left: "Rẽ trái", right: "Rẽ phải", "slight-left": "Chếch sang trái", "slight-right": "Chếch sang phải", uturn: "Quay lại"
};

function simplify(points: RoutePoint[], minSegment = MIN_SEGMENT): RoutePoint[] {
    if (points.length <= 2) return points.slice();
    const out: RoutePoint[] = [points[0]!];
    for (let i = 1; i < points.length - 1; i++) {
        const prev = out[out.length - 1]!;
        const cur = points[i]!;
        const next = points[i + 1]!;
        if (distance(prev, cur) < minSegment) continue;
        const turn = Math.abs(angleDiff(bearing(cur, next), bearing(prev, cur)));
        if (turn < TURN_MIN) continue;
        out.push(cur);
    }
    out.push(points[points.length - 1]!);
    return out;
}

function turnKind(delta: number): keyof typeof TURN_TITLE {
    const a = Math.abs(delta);
    if (a >= UTURN) return "uturn";
    if (a >= SHARP) return delta > 0 ? "right" : "left";
    return delta > 0 ? "slight-right" : "slight-left";
}

function nearestLandmark(locations: Landmark[], point: LatLng, floorId: number, exclude?: number): Landmark | null {
    let best: { loc: Landmark; d: number } | null = null;
    for (const loc of locations) {
        if (loc.floorId !== floorId || !LANDMARK_TYPES.has(loc.type ?? "") || loc.id === exclude) continue;
        const d = distance(point, loc);
        if (d <= LANDMARK_RADIUS && (!best || d < best.d)) best = { loc, d };
    }
    return best?.loc ?? null;
}

function passingLandmark(locations: Landmark[], a: LatLng, b: LatLng, floorId: number, exclude?: number): { loc: Landmark; side: Side } | null {
    let best: { loc: Landmark; d: number; side: Side } | null = null;
    for (const loc of locations) {
        if (loc.floorId !== floorId || !LANDMARK_TYPES.has(loc.type ?? "") || TURN_ONLY_TYPES.has(loc.type ?? "") || loc.id === exclude) continue;
        const spot = closestPointOnSegment(loc, a, b);
        if (spot.t < 0.15 || spot.t > 0.85) continue;
        const d = distance(loc, spot);
        if (d <= 10 && (!best || d < best.d)) best = { loc, d, side: sideOf(a, b, loc) };
    }
    return best;
}

const shortFloor = (floor?: FloorDto) => floor?.name.split(" · ")[0] ?? "tầng khác";

export interface DirectionsInput {
    locations?: Landmark[];
    floorsById?: Map<number, FloorDto>;
    destination?: Landmark | null;
}

export function buildDirections(route: Route, { locations = [], floorsById = new Map(), destination = null }: DirectionsInput = {}): Step[] {
    const steps: Step[] = [];
    let offset = 0;
    const destId = destination?.id;

    route.legs.forEach((leg, legIndex) => {
        const pts = simplify(leg.points, scaled(leg.distance, 0.12, 1.2, MIN_SEGMENT));
        const mergeTurns = scaled(leg.distance, 0.2, 2, MERGE_TURNS);
        const along = [0];
        for (let i = 1; i < pts.length; i++) along.push(along[i - 1]! + distance(pts[i - 1]!, pts[i]!));
        const total = along[along.length - 1]!;
        const scale = total > 0 ? leg.distance / total : 1;

        for (let i = 0; i < pts.length - 1; i++) {
            const a = pts[i]!;
            const b = pts[i + 1]!;
            const segLen = (along[i + 1]! - along[i]!) * scale;
            // Lượt rẽ ngay trước điểm đến (còn < 1 m) chỉ là nhiễu: để bước "Đến nơi" lo
            if (i > 0 && i === pts.length - 2 && segLen < 1) continue;
            const pass = passingLandmark(locations, a, b, leg.floorId, destId);
            const passText = pass ? `qua ${pass.loc.name} bên ${pass.side}` : "";
            if (i === 0) {
                steps.push({
                    kind: legIndex === 0 ? "depart" : "straight", legIndex, at: offset, distance: segLen, point: a,
                    title: `Đi thẳng ${formatMeters(segLen)}`,
                    detail: passText || (legIndex === 0 ? "theo hướng mũi tên trên bản đồ" : `ra khỏi thang · ${floorsById.get(leg.floorId)?.name ?? ""}`)
                });
            } else {
                let delta = angleDiff(bearing(a, b), bearing(pts[i - 1]!, a));
                let at = offset + along[i]! * scale;
                let distanceAfter = segLen;
                // Hai lượt rẽ cùng phía cách nhau chưa tới 10 m: gộp thành một ("chếch phải" + "chếch phải" = "rẽ phải").
                // Không gộp hai lượt rẽ hẳn (rẽ phải vào cửa rồi rẽ phải vào phòng): cộng lại thành "quay lại" là sai.
                const prev = steps[steps.length - 1] as (Step & { delta?: number }) | undefined;
                if (prev && prev.legIndex === legIndex && prev.delta != null && prev.distance < mergeTurns && Math.sign(prev.delta) === Math.sign(delta)
                    && (Math.abs(prev.delta) < SHARP || Math.abs(delta) < SHARP) && Math.abs(prev.delta + delta) < UTURN) {
                    steps.pop();
                    delta = prev.delta + delta;
                    at = prev.at;
                    distanceAfter = prev.distance + segLen;
                }
                const kind = turnKind(delta);
                const mark = nearestLandmark(locations, a, leg.floorId, destId);
                const lastMark = steps[steps.length - 1]?.title.split(" tại ")[1];
                const useMark = mark && mark.name !== lastMark ? mark : null;
                steps.push({
                    kind, legIndex, at, distance: distanceAfter, point: a, delta,
                    title: useMark ? `${TURN_TITLE[kind]} tại ${useMark.name}` : TURN_TITLE[kind],
                    detail: passText ? `rồi đi ${formatMeters(distanceAfter)}, ${passText}` : `rồi đi ${formatMeters(distanceAfter)}`
                } as Step & { delta: number });
            }
        }

        const last = pts[pts.length - 1]!;
        const nextLeg = route.legs[legIndex + 1];
        if (nextLeg) {
            const fromFloor = floorsById.get(leg.floorId);
            const toFloor = floorsById.get(nextLeg.floorId);
            const up = (toFloor?.level ?? 0) > (fromFloor?.level ?? 0);
            const connector = leg.connector ?? "Thang máy";
            steps.push({
                kind: up ? "floor-up" : "floor-down", legIndex, at: offset + leg.distance, distance: 0, point: last,
                connector, fromFloorId: leg.floorId, toFloorId: nextLeg.floorId,
                title: `Đi ${connector.toLowerCase()} ${up ? "lên" : "xuống"} ${shortFloor(toFloor)}`,
                detail: toFloor?.name ?? ""
            });
        } else {
            let detail = "";
            if (destination && pts.length >= 2) {
                detail = distance(last, destination) > 2 ? `ở bên ${sideOf(pts[pts.length - 2]!, last, destination)}` : "ngay trước mặt";
            }
            steps.push({
                kind: "arrive", legIndex, at: offset + leg.distance, distance: 0, point: last,
                title: destination ? `Đến ${destination.name}` : "Đến nơi", detail
            });
        }
        offset += leg.distance;
    });
    return steps.map(step => {
        const { delta: _delta, ...rest } = step as Step & { delta?: number };
        void _delta;
        return rest;
    });
}

/** Bước hiện tại theo quãng đã đi, chỉ xét các bước thuộc chặng ≤ activeLeg (chưa đổi tầng thì chưa sang chặng sau) */
export function currentStepIndex(steps: Step[], meters: number, activeLeg = Infinity): number {
    let index = 0;
    for (let i = 0; i < steps.length; i++) {
        const step = steps[i]!;
        if (step.legIndex > activeLeg) break;
        if (step.at <= meters + 0.5) index = i;
        else break;
    }
    return index;
}
