import walkways from "../data/walkways";
import { projection } from "./mapProjection";

const FLOOR_CHANGE_METERS = 30;   // taking the elevator/escalator "costs" like walking 30 m
const WALK_SPEED = 1.2;           // meters per second, walking with luggage
const FLOOR_CHANGE_SECONDS = 45;

// Real distance in meters between two points of the same floor.
// Pixels can't be used directly: the drawing is stretched in depth (see projection.js).
function meters(a, b) {
    return projection.toLatLng(a.x, a.y).distanceTo(projection.toLatLng(b.x, b.y));
}

// Built once when the app starts: node id -> node, node id -> [{ id, cost }]
const nodeById = {};
const neighbors = {};
walkways.nodes.forEach(node => {
    nodeById[node.id] = node;
    neighbors[node.id] = [];
});
walkways.edges.forEach(([a, b]) => {
    const cost = nodeById[a].floor === nodeById[b].floor ? meters(nodeById[a], nodeById[b]) : FLOOR_CHANGE_METERS;
    neighbors[a].push({ id: b, cost });
    neighbors[b].push({ id: a, cost });
});

// A location is not a node, so we enter/leave the network at the closest node on the same floor
function findNearestNode(point) {
    let nearest = null;
    let nearestDistance = Infinity;
    walkways.nodes
        .filter(node => node.floor === point.floor)
        .forEach(node => {
            const distance = meters(point, node);
            if (distance < nearestDistance) {
                nearest = node;
                nearestDistance = distance;
            }
        });
    return nearest;
}

// Dijkstra's shortest path:
// 1. Every node starts with distance Infinity, except the start (0).
// 2. Repeatedly take the unvisited node with the smallest distance and "relax" its neighbors:
//    if going through it is shorter than what the neighbor has, update the neighbor
//    and remember where we came from (previous).
// 3. When we reach the end node, follow "previous" backwards to get the path.
function shortestPath(startId, endId) {
    const distance = {};
    const previous = {};
    const unvisited = new Set(Object.keys(nodeById));
    unvisited.forEach(id => { distance[id] = Infinity; });
    distance[startId] = 0;

    while (unvisited.size > 0) {
        let current = null;
        unvisited.forEach(id => {
            if (current === null || distance[id] < distance[current]) current = id;
        });

        if (distance[current] === Infinity) return null;   // the rest can't be reached
        if (current === endId) break;
        unvisited.delete(current);

        neighbors[current].forEach(({ id, cost }) => {
            if (distance[current] + cost < distance[id]) {
                distance[id] = distance[current] + cost;
                previous[id] = current;
            }
        });
    }

    const path = [endId];
    while (path[0] !== startId) {
        path.unshift(previous[path[0]]);
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
            if (lastLeg) lastLeg.connector = lastLeg.points[lastLeg.points.length - 1].connector || "Thang máy";
            legs.push({ floor: point.floor, points: [point] });
        }
    });

    legs.forEach(leg => {
        leg.distance = 0;
        for (let i = 1; i < leg.points.length; i++) {
            leg.distance += meters(leg.points[i - 1], leg.points[i]);
        }
    });
    return legs;
}

// Main function: route between 2 locations.
// Returns { legs, distance (m), minutes } or null when no path exists.
export function findRoute(from, to) {
    const startNode = findNearestNode(from);
    const endNode = findNearestNode(to);
    if (!startNode || !endNode) return null;

    const nodeIds = shortestPath(startNode.id, endNode.id);
    if (!nodeIds) return null;

    const points = [
        { floor: from.floor, x: from.x, y: from.y },
        ...nodeIds.map(id => nodeById[id]),
        { floor: to.floor, x: to.x, y: to.y }
    ];
    const legs = splitByFloor(points);

    const distance = legs.reduce((sum, leg) => sum + leg.distance, 0);
    const seconds = distance / WALK_SPEED + (legs.length - 1) * FLOOR_CHANGE_SECONDS;

    return { legs, distance: Math.round(distance), minutes: Math.max(1, Math.ceil(seconds / 60)) };
}
