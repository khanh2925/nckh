import { closestPointOnSegment, distance, getLatLng } from "./geo";
import { floorLabel } from "./text";

const FLOOR_CHANGE_METERS = 30;   // taking the elevator/escalator "costs" like walking 30 m
const WALK_SPEED = 1.2;           // meters per second, walking with luggage
const FLOOR_CHANGE_SECONDS = 45;
const MAX_SNAP_METERS = 60;       // a point farther than this from every walkway can't be routed

// Keep only the nodes/edges of one terminal and list the neighbors of every node:
// node id -> [{ id, cost }]. Edges between 2 floors are elevators/escalators/stairs.
function buildGraph(walkways, terminal) {
    const nodeById = new Map();
    walkways.nodes
        .filter(node => node.terminal === terminal)
        .forEach(node => nodeById.set(node.id, node));

    const neighbors = new Map([...nodeById.keys()].map(id => [id, []]));
    const segments = [];   // same-floor edges, used to find where a point joins the network
    walkways.edges.forEach(({ from, to }) => {
        const a = nodeById.get(from);
        const b = nodeById.get(to);
        if (!a || !b) return;
        const cost = a.floor === b.floor ? distance(a, b) : FLOOR_CHANGE_METERS;
        neighbors.get(a.id).push({ id: b.id, cost });
        neighbors.get(b.id).push({ id: a.id, cost });
        if (a.floor === b.floor) segments.push([a, b]);
    });
    return { nodeById, neighbors, segments };
}

// The network may have separate "pieces" that are not joined (e.g. a corridor not drawn to the rest yet).
// Give every node the number of its piece: nodes reachable from each other get the same number.
function findPieces(graph) {
    const pieceOf = new Map();
    let piece = 0;
    graph.nodeById.forEach((node, id) => {
        if (pieceOf.has(id)) return;
        const stack = [id];
        pieceOf.set(id, piece);
        while (stack.length > 0) {
            graph.neighbors.get(stack.pop()).forEach(next => {
                if (!pieceOf.has(next.id)) {
                    pieceOf.set(next.id, piece);
                    stack.push(next.id);
                }
            });
        }
        piece++;
    });
    return pieceOf;
}

// Any point (a shop, or a spot picked on the map) is not a node.
// It joins the network at the closest spot of a walkway on its floor.
// Returns the closest entry of EVERY piece nearby: piece number -> { a, b, spot, gap }
function findEntries(graph, pieceOf, point) {
    const entries = new Map();
    graph.segments.forEach(([a, b]) => {
        if (a.floor !== point.floor) return;
        const spot = closestPointOnSegment(point, a, b);
        const gap = distance(point, spot);
        const piece = pieceOf.get(a.id);
        if (gap <= MAX_SNAP_METERS && (!entries.has(piece) || gap < entries.get(piece).gap)) {
            entries.set(piece, { a, b, spot, gap });
        }
    });
    return entries;
}

// Dijkstra's shortest path:
// 1. The start has distance 0, every other node is "unknown" (Infinity).
// 2. Repeatedly take the unfinished node with the smallest distance and "relax" its neighbors:
//    if going through it is shorter than what the neighbor has, update the neighbor
//    and remember where we came from (previous).
// 3. When we reach the end, follow "previous" backwards to get the path.
function shortestPath(neighborsOf, startId, endId) {
    const distanceTo = new Map([[startId, 0]]);
    const previous = new Map();
    const finished = new Set();

    for (;;) {
        let current = null;
        distanceTo.forEach((value, id) => {
            if (!finished.has(id) && (current === null || value < distanceTo.get(current))) current = id;
        });
        if (current === null) return null;   // nothing left to visit: the end can't be reached
        if (current === endId) break;
        finished.add(current);

        neighborsOf(current).forEach(({ id, cost }) => {
            const newDistance = distanceTo.get(current) + cost;
            if (newDistance < (distanceTo.get(id) ?? Infinity)) {
                distanceTo.set(id, newDistance);
                previous.set(id, current);
            }
        });
    }

    const path = [endId];
    while (path[0] !== startId) {
        path.unshift(previous.get(path[0]));
    }
    return path;
}

// Cut the list of points into "legs": one leg per floor you walk on.
// Each leg remembers the connector (elevator/escalator) used to leave it.
function splitByFloor(points) {
    const legs = [];
    points.forEach(point => {
        const lastLeg = legs[legs.length - 1];
        if (lastLeg && lastLeg.floor === point.floor) {
            lastLeg.points.push(point);
        } else {
            if (lastLeg) lastLeg.connector = lastLeg.points[lastLeg.points.length - 1].connector || point.connector || "Thang máy";
            legs.push({ floor: point.floor, points: [point] });
        }
    });

    legs.forEach(leg => {
        leg.distance = 0;
        for (let i = 1; i < leg.points.length; i++) {
            leg.distance += distance(leg.points[i - 1], leg.points[i]);
        }
    });
    return legs;
}

// Main function: route between 2 places. A place is a location or any point picked on the map:
// it only needs terminal, floor and lat/lng (or old x/y).
// Returns { legs, distance (m), minutes } or { error } when there is no path.
export function findRoute(walkways, from, to) {
    if (from.terminal !== to.terminal) {
        return { error: "Hai điểm ở hai nhà ga khác nhau. Hiện chỉ hỗ trợ chỉ đường trong cùng một nhà ga." };
    }

    const graph = buildGraph(walkways, from.terminal);
    const pieceOf = findPieces(graph);
    const start = { floor: from.floor, ...getLatLng(from) };
    const end = { floor: to.floor, ...getLatLng(to) };
    const startEntries = findEntries(graph, pieceOf, start);
    const endEntries = findEntries(graph, pieceOf, end);
    if (startEntries.size === 0 || endEntries.size === 0) {
        const missing = startEntries.size === 0 ? start : end;
        return { error: `Chưa có lối đi gần ${missing === start ? "điểm xuất phát" : "điểm đến"} (${floorLabel(missing.floor)}). Admin cần vẽ thêm lối đi ở đây.` };
    }

    // Both ends must join the SAME piece, otherwise there is no way between them.
    // If several pieces work, take the one with the shortest walk to reach it.
    let startEntry = null;
    let endEntry = null;
    startEntries.forEach((entry, piece) => {
        const other = endEntries.get(piece);
        if (other && (!startEntry || entry.gap + other.gap < startEntry.gap + endEntry.gap)) {
            startEntry = entry;
            endEntry = other;
        }
    });
    if (!startEntry) {
        return { error: "Không tìm được đường đi: lối đi giữa hai điểm chưa được nối với nhau." };
    }

    // Two temporary nodes: the spots where the start and the end join the network
    const START = "route-start";
    const END = "route-end";
    const extra = new Map([[START, []], [END, []]]);
    const link = (id, otherId, cost) => {
        extra.get(id).push({ id: otherId, cost });
        if (!extra.has(otherId)) extra.set(otherId, []);
        extra.get(otherId).push({ id, cost });
    };
    link(START, startEntry.a.id, distance(startEntry.spot, startEntry.a));
    link(START, startEntry.b.id, distance(startEntry.spot, startEntry.b));
    link(END, endEntry.a.id, distance(endEntry.spot, endEntry.a));
    link(END, endEntry.b.id, distance(endEntry.spot, endEntry.b));
    // Both on the same walkway segment: walk straight along it
    if (startEntry.a === endEntry.a && startEntry.b === endEntry.b) {
        link(START, END, distance(startEntry.spot, endEntry.spot));
    }
    const neighborsOf = (id) => [...(graph.neighbors.get(id) || []), ...(extra.get(id) || [])];

    const ids = shortestPath(neighborsOf, START, END);
    if (!ids) {
        return { error: "Không tìm được đường đi: lối đi giữa hai điểm chưa được nối với nhau." };
    }

    const points = ids.map(id => {
        if (id === START) return { floor: start.floor, lat: startEntry.spot.lat, lng: startEntry.spot.lng };
        if (id === END) return { floor: end.floor, lat: endEntry.spot.lat, lng: endEntry.spot.lng };
        return graph.nodeById.get(id);
    });
    const legs = splitByFloor([start, ...points, end]);

    const totalDistance = legs.reduce((sum, leg) => sum + leg.distance, 0);
    const seconds = totalDistance / WALK_SPEED + (legs.length - 1) * FLOOR_CHANGE_SECONDS;

    return { legs, distance: Math.round(totalDistance), minutes: Math.max(1, Math.ceil(seconds / 60)) };
}
