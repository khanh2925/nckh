import { closestPointOnSegment, distance } from "./geo";
import type { FloorPoint, WalkwayNetworkDto, WalkwayNodeDto } from "./types";

export const WALK_SPEED = 1.2; // m/s, đi bộ có hành lý
const CONNECTOR_SECONDS: Record<string, number> = { "Thang máy": 60, "Thang cuốn": 40, "Thang bộ": 45 };
const FLOOR_CHANGE_COST = 30; // đổi tầng "tốn" như đi bộ 30 m, để không đổi tầng khi không cần
const MAX_SNAP_METERS = 60; // điểm cách mọi lối đi xa hơn thế thì không chỉ đường được
const STEP_FREE = new Set(["Thang máy"]); // dùng được cho xe lăn / xe đẩy

export interface RouteOptions {
    /** Chỉ đổi tầng bằng thang máy */
    avoidStairs?: boolean;
}

/** Một điểm trên tuyến: nút lối đi hoặc điểm nhập mạng tạm thời */
export interface RoutePoint extends FloorPoint {
    id?: string;
    connector?: string;
}

export interface RouteLeg {
    floorId: number;
    points: RoutePoint[];
    /** Độ dài chặng (m) */
    distance: number;
    /** Quãng cộng dồn tới từng điểm trong chặng */
    cumulative: number[];
    /** Thang dùng để rời tầng (không có ở chặng cuối) */
    connector?: string;
}

export interface Route {
    legs: RouteLeg[];
    distance: number;
    seconds: number;
    from: FloorPoint;
    to: FloorPoint;
}

export type RouteResult = Route | { error: string };

export const isRouteError = (r: RouteResult | null | undefined): r is { error: string } => Boolean(r && "error" in r);

interface Neighbor {
    id: string;
    cost: number;
}

export interface WalkwayGraph {
    nodeById: Map<string, WalkwayNodeDto>;
    neighbors: Map<string, Neighbor[]>;
    segments: [WalkwayNodeDto, WalkwayNodeDto][];
}

/** Đồ thị: id nút -> [{ id, cost }]. Cạnh giữa 2 tầng là thang máy / thang cuốn / thang bộ. */
export function buildGraph(walkways: WalkwayNetworkDto, { avoidStairs = false }: RouteOptions = {}): WalkwayGraph {
    const nodeById = new Map(walkways.nodes.map(node => [node.id, node]));
    const neighbors = new Map<string, Neighbor[]>([...nodeById.keys()].map(id => [id, []]));
    const segments: [WalkwayNodeDto, WalkwayNodeDto][] = [];
    for (const { from, to } of walkways.edges) {
        const a = nodeById.get(from);
        const b = nodeById.get(to);
        if (!a || !b) continue;
        const sameFloor = a.floorId === b.floorId;
        if (!sameFloor && avoidStairs && !STEP_FREE.has(a.connector || b.connector || "Thang máy")) continue;
        const cost = sameFloor ? distance(a, b) : FLOOR_CHANGE_COST;
        neighbors.get(a.id)!.push({ id: b.id, cost });
        neighbors.get(b.id)!.push({ id: a.id, cost });
        if (sameFloor) segments.push([a, b]);
    }
    return { nodeById, neighbors, segments };
}

/** Mạng lối đi có thể có nhiều "mảnh" rời nhau. Đánh số mảnh cho từng nút (cũng dùng cho Builder kiểm tra dữ liệu). */
export function findPieces(graph: WalkwayGraph): Map<string, number> {
    const pieceOf = new Map<string, number>();
    let piece = 0;
    for (const id of graph.nodeById.keys()) {
        if (pieceOf.has(id)) continue;
        const stack = [id];
        pieceOf.set(id, piece);
        while (stack.length > 0) {
            for (const next of graph.neighbors.get(stack.pop()!) ?? []) {
                if (!pieceOf.has(next.id)) {
                    pieceOf.set(next.id, piece);
                    stack.push(next.id);
                }
            }
        }
        piece++;
    }
    return pieceOf;
}

interface Entry {
    a: WalkwayNodeDto;
    b: WalkwayNodeDto;
    spot: { lat: number; lng: number };
    gap: number;
}

// Một địa điểm không phải là nút: nó nhập vào mạng tại chỗ gần nhất của một lối đi cùng tầng.
// Trả về chỗ nhập gần nhất của MỖI mảnh.
function findEntries(graph: WalkwayGraph, pieceOf: Map<string, number>, point: FloorPoint): Map<number, Entry> {
    const entries = new Map<number, Entry>();
    for (const [a, b] of graph.segments) {
        if (a.floorId !== point.floorId) continue;
        const spot = closestPointOnSegment(point, a, b);
        const gap = distance(point, spot);
        const piece = pieceOf.get(a.id)!;
        const current = entries.get(piece);
        if (gap <= MAX_SNAP_METERS && (!current || gap < current.gap)) entries.set(piece, { a, b, spot, gap });
    }
    return entries;
}

// Dijkstra với hàng đợi ưu tiên (heap nhị phân)
function shortestPath(neighborsOf: (id: string) => Neighbor[], startId: string, endId: string): string[] | null {
    const distanceTo = new Map<string, number>([[startId, 0]]);
    const previous = new Map<string, string>();
    const heap: [number, string][] = [[0, startId]];
    const swap = (i: number, j: number) => {
        const t = heap[i]!;
        heap[i] = heap[j]!;
        heap[j] = t;
    };
    const push = (item: [number, string]) => {
        heap.push(item);
        let i = heap.length - 1;
        while (i > 0) {
            const parent = (i - 1) >> 1;
            if (heap[parent]![0] <= heap[i]![0]) break;
            swap(parent, i);
            i = parent;
        }
    };
    const pop = (): [number, string] => {
        const top = heap[0]!;
        const last = heap.pop()!;
        if (heap.length > 0) {
            heap[0] = last;
            let i = 0;
            for (;;) {
                const l = 2 * i + 1;
                const r = l + 1;
                let smallest = i;
                if (l < heap.length && heap[l]![0] < heap[smallest]![0]) smallest = l;
                if (r < heap.length && heap[r]![0] < heap[smallest]![0]) smallest = r;
                if (smallest === i) break;
                swap(smallest, i);
                i = smallest;
            }
        }
        return top;
    };

    while (heap.length > 0) {
        const [cost, current] = pop();
        if (cost > (distanceTo.get(current) ?? Infinity)) continue;
        if (current === endId) break;
        for (const { id, cost: step } of neighborsOf(current)) {
            const next = cost + step;
            if (next < (distanceTo.get(id) ?? Infinity)) {
                distanceTo.set(id, next);
                previous.set(id, current);
                push([next, id]);
            }
        }
    }
    if (!distanceTo.has(endId)) return null;
    const path = [endId];
    while (path[0] !== startId) path.unshift(previous.get(path[0]!)!);
    return path;
}

// Cắt danh sách điểm thành các "chặng": mỗi chặng đi trên một tầng
function splitByFloor(points: RoutePoint[]): RouteLeg[] {
    const legs: RouteLeg[] = [];
    for (const point of points) {
        const last = legs[legs.length - 1];
        if (last && last.floorId === point.floorId) {
            last.points.push(point);
        } else {
            if (last) last.connector = last.points[last.points.length - 1]!.connector || point.connector || "Thang máy";
            legs.push({ floorId: point.floorId, points: [point], distance: 0, cumulative: [0] });
        }
    }
    for (const leg of legs) {
        for (let i = 1; i < leg.points.length; i++) {
            leg.distance += distance(leg.points[i - 1]!, leg.points[i]!);
            leg.cumulative.push(leg.distance);
        }
    }
    return legs;
}

/** Chỉ đường giữa 2 điểm. */
export function findRoute(walkways: WalkwayNetworkDto, from: FloorPoint, to: FloorPoint, options: RouteOptions = {}): RouteResult {
    const graph = buildGraph(walkways, options);
    const pieceOf = findPieces(graph);
    const start: RoutePoint = { floorId: from.floorId, lat: from.lat, lng: from.lng };
    const end: RoutePoint = { floorId: to.floorId, lat: to.lat, lng: to.lng };
    const startEntries = findEntries(graph, pieceOf, start);
    const endEntries = findEntries(graph, pieceOf, end);
    if (startEntries.size === 0) return { error: "Chưa có lối đi gần điểm xuất phát. Chủ địa điểm cần vẽ thêm lối đi ở đây." };
    if (endEntries.size === 0) return { error: "Chưa có lối đi gần điểm đến. Chủ địa điểm cần vẽ thêm lối đi ở đây." };

    // Hai đầu phải nhập vào CÙNG một mảnh; nhiều mảnh hợp lệ thì lấy mảnh có tổng quãng nhập ngắn nhất
    let startEntry: Entry | null = null;
    let endEntry: Entry | null = null;
    for (const [piece, entry] of startEntries) {
        const other = endEntries.get(piece);
        if (other && (!startEntry || !endEntry || entry.gap + other.gap < startEntry.gap + endEntry.gap)) {
            startEntry = entry;
            endEntry = other;
        }
    }
    if (!startEntry || !endEntry) {
        return {
            error: options.avoidStairs
                ? "Không có tuyến chỉ dùng thang máy giữa hai điểm này. Thử tắt “Tránh thang cuốn & thang bộ” trong Cài đặt."
                : "Không tìm được đường: lối đi giữa hai điểm chưa được nối với nhau."
        };
    }

    const START = "@start";
    const END = "@end";
    const extra = new Map<string, Neighbor[]>([[START, []], [END, []]]);
    const link = (id: string, otherId: string, cost: number) => {
        extra.get(id)!.push({ id: otherId, cost });
        if (!extra.has(otherId)) extra.set(otherId, []);
        extra.get(otherId)!.push({ id, cost });
    };
    link(START, startEntry.a.id, distance(startEntry.spot, startEntry.a));
    link(START, startEntry.b.id, distance(startEntry.spot, startEntry.b));
    link(END, endEntry.a.id, distance(endEntry.spot, endEntry.a));
    link(END, endEntry.b.id, distance(endEntry.spot, endEntry.b));
    if (startEntry.a === endEntry.a && startEntry.b === endEntry.b) link(START, END, distance(startEntry.spot, endEntry.spot));

    const neighborsOf = (id: string): Neighbor[] => {
        const base = graph.neighbors.get(id) ?? [];
        const more = extra.get(id);
        return more ? base.concat(more) : base;
    };
    const ids = shortestPath(neighborsOf, START, END);
    if (!ids) return { error: "Không tìm được đường: lối đi giữa hai điểm chưa được nối với nhau." };

    const se = startEntry;
    const ee = endEntry;
    const points: RoutePoint[] = ids.map(id => {
        if (id === START) return { floorId: start.floorId, lat: se.spot.lat, lng: se.spot.lng };
        if (id === END) return { floorId: end.floorId, lat: ee.spot.lat, lng: ee.spot.lng };
        return graph.nodeById.get(id)!;
    });
    // Bỏ điểm trùng liên tiếp (chỗ nhập trùng nút)
    const all = [start, ...points, end];
    const cleaned = all.filter((p, i) => i === 0 || p.floorId !== all[i - 1]!.floorId || distance(p, all[i - 1]!) > 0.3);
    const legs = splitByFloor(cleaned);

    const walk = legs.reduce((sum, leg) => sum + leg.distance, 0);
    const seconds = walk / WALK_SPEED + legs.slice(0, -1).reduce((sum, leg) => sum + (CONNECTOR_SECONDS[leg.connector ?? ""] ?? 45), 0);
    return { legs, distance: Math.round(walk), seconds, from: start, to: end };
}

/** Quãng cộng dồn tới đầu chặng index */
export function legStart(route: Route, index: number): number {
    return route.legs.slice(0, index).reduce((sum, leg) => sum + leg.distance, 0);
}

export interface PointOnRoute extends FloorPoint {
    legIndex: number;
    /** quãng đã đi trong chặng */
    along: number;
}

/** Điểm trên tuyến ở quãng đường "meters" (cộng dồn qua các chặng) */
export function pointAt(route: Route, meters: number): PointOnRoute | null {
    let rest = Math.max(0, meters);
    for (let i = 0; i < route.legs.length; i++) {
        const leg = route.legs[i]!;
        if (rest <= leg.distance || i === route.legs.length - 1) {
            const m = Math.min(rest, leg.distance);
            const k = leg.cumulative.findIndex(c => c >= m);
            const first = leg.points[0]!;
            if (k <= 0) return { floorId: leg.floorId, lat: first.lat, lng: first.lng, legIndex: i, along: m };
            const a = leg.points[k - 1]!;
            const b = leg.points[k]!;
            const span = leg.cumulative[k]! - leg.cumulative[k - 1]! || 1;
            const t = (m - leg.cumulative[k - 1]!) / span;
            return { floorId: leg.floorId, lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t, legIndex: i, along: m };
        }
        rest -= leg.distance;
    }
    return null;
}

/** Chiếu một điểm lên tuyến: quãng dọc tuyến và khoảng lệch (m). null nếu tuyến không đi qua tầng đó. */
export function snapToRoute(route: Route, point: FloorPoint): { gap: number; meters: number } | null {
    let best: { gap: number; meters: number } | null = null;
    let offset = 0;
    for (const leg of route.legs) {
        if (leg.floorId === point.floorId) {
            for (let k = 1; k < leg.points.length; k++) {
                const spot = closestPointOnSegment(point, leg.points[k - 1]!, leg.points[k]!);
                const gap = distance(point, spot);
                if (!best || gap < best.gap) {
                    const along = leg.cumulative[k - 1]! + (leg.cumulative[k]! - leg.cumulative[k - 1]!) * spot.t;
                    best = { gap, meters: offset + along };
                }
            }
        }
        offset += leg.distance;
    }
    return best;
}

// Hàng đợi ưu tiên (heap nhị phân) theo chi phí
class MinHeap {
    private items: [number, string][] = [];
    get size(): number {
        return this.items.length;
    }
    push(item: [number, string]): void {
        const h = this.items;
        h.push(item);
        let i = h.length - 1;
        while (i > 0) {
            const parent = (i - 1) >> 1;
            if (h[parent]![0] <= h[i]![0]) break;
            [h[parent], h[i]] = [h[i]!, h[parent]!];
            i = parent;
        }
    }
    pop(): [number, string] {
        const h = this.items;
        const top = h[0]!;
        const last = h.pop()!;
        if (h.length > 0) {
            h[0] = last;
            let i = 0;
            for (;;) {
                const l = 2 * i + 1;
                const r = l + 1;
                let smallest = i;
                if (l < h.length && h[l]![0] < h[smallest]![0]) smallest = l;
                if (r < h.length && h[r]![0] < h[smallest]![0]) smallest = r;
                if (smallest === i) break;
                [h[smallest], h[i]] = [h[i]!, h[smallest]!];
                i = smallest;
            }
        }
        return top;
    }
}

// Dijkstra từ nhiều nguồn, không dừng sớm: khoảng cách tới MỌI nút (cho bài toán chọn nơi phục vụ của quy trình)
function shortestAll(neighborsOf: (id: string) => Neighbor[], sources: Map<string, number>): Map<string, number> {
    const best = new Map(sources);
    const heap = new MinHeap();
    for (const [id, cost] of sources) heap.push([cost, id]);
    while (heap.size > 0) {
        const [cost, current] = heap.pop();
        if (cost > (best.get(current) ?? Infinity)) continue;
        for (const { id, cost: step } of neighborsOf(current)) {
            const next = cost + step;
            if (next < (best.get(id) ?? Infinity)) {
                best.set(id, next);
                heap.push([next, id]);
            }
        }
    }
    return best;
}

/**
 * Bảng tra quãng đường (m, cộng phí đổi tầng như findRoute) từ một điểm tới nhiều điểm, dùng lại một đồ thị.
 * Mỗi lần gọi chạy MỘT Dijkstra một-nguồn; điểm không tới được trả về Infinity.
 */
export function createDistanceOracle(walkways: WalkwayNetworkDto, options: RouteOptions = {}): (from: FloorPoint, targets: FloorPoint[]) => number[] {
    const graph = buildGraph(walkways, options);
    const pieceOf = findPieces(graph);
    const entriesCache = new Map<string, Map<number, Entry>>();
    const entriesOf = (p: FloorPoint) => {
        const key = `${p.floorId}:${p.lat}:${p.lng}`;
        let found = entriesCache.get(key);
        if (!found) {
            found = findEntries(graph, pieceOf, p);
            entriesCache.set(key, found);
        }
        return found;
    };
    return (from, targets) => {
        const starts = entriesOf(from);
        const sources = new Map<string, number>();
        for (const e of starts.values()) {
            for (const node of [e.a, e.b]) {
                const cost = e.gap + distance(e.spot, node);
                if (cost < (sources.get(node.id) ?? Infinity)) sources.set(node.id, cost);
            }
        }
        const dist = sources.size > 0 ? shortestAll(id => graph.neighbors.get(id) ?? [], sources) : new Map<string, number>();
        return targets.map(target => {
            let best = Infinity;
            for (const [piece, e] of entriesOf(target)) {
                const via = Math.min((dist.get(e.a.id) ?? Infinity) + distance(e.spot, e.a), (dist.get(e.b.id) ?? Infinity) + distance(e.spot, e.b));
                best = Math.min(best, via + e.gap);
                // cùng một đoạn lối đi: đi thẳng trên đoạn đó
                const s = starts.get(piece);
                if (s && s.a === e.a && s.b === e.b) best = Math.min(best, s.gap + distance(s.spot, e.spot) + e.gap);
            }
            return best;
        });
    };
}
