import { closestPointOnSegment, distance } from "./geo";
import { buildGraph, findPieces, type WalkwayGraph } from "./routing";
import type { FloorPoint } from "./types";
import type { Place, VenueModel } from "./venueModel";

// Kiểm tra dữ liệu một địa điểm trước khi xuất bản (Builder): địa điểm nào không tới được, mảnh lối đi rời,
// thang chưa nối tầng, tầng chưa có mặt bằng. Dùng chung cho thanh "Kiểm tra dữ liệu" và màn Xuất bản.

export const REACH_METERS = 60; // khớp MAX_SNAP_METERS của routing

/** Khoảng cách (m) từ một điểm tới đoạn lối đi gần nhất cùng tầng; Infinity nếu tầng không có lối đi */
export function walkwayGap(graph: WalkwayGraph, point: FloorPoint): { gap: number; nodeId: string | null } {
    let best = { gap: Infinity, nodeId: null as string | null };
    for (const [a, b] of graph.segments) {
        if (a.floorId !== point.floorId) continue;
        const spot = closestPointOnSegment(point, a, b);
        const gap = distance(point, spot);
        if (gap < best.gap) best = { gap, nodeId: spot.t < 0.5 ? a.id : b.id };
    }
    return best;
}

export interface NetworkReport {
    nodes: number;
    edges: number;
    meters: number;
    /** Số mảnh rời nhau (1 = liền mạch) */
    pieces: number;
    /** Nút không thuộc mảnh lớn nhất của toà nhà */
    strayNodes: Set<string>;
    /** Địa điểm không có lối đi trong bán kính REACH_METERS */
    unreachable: Place[];
    /** Địa điểm có lối đi gần nhưng thuộc mảnh rời */
    isolated: Place[];
    /** Nút có connector nhưng không nối sang tầng khác */
    looseConnectors: string[];
    floorsWithoutPlan: number[];
    floorsWithoutWalkways: number[];
}

export function analyzeVenue(model: VenueModel): NetworkReport {
    const graph = buildGraph(model.walkways);
    const pieceOf = findPieces(graph);

    // Mảnh "chính" của mỗi toà nhà = mảnh có nhiều nút nhất
    const buildingOfFloor = new Map(model.floors.map(f => [f.id, f.buildingId]));
    const sizeByBuildingPiece = new Map<string, number>();
    for (const node of model.walkways.nodes) {
        const key = `${buildingOfFloor.get(node.floorId)}:${pieceOf.get(node.id)}`;
        sizeByBuildingPiece.set(key, (sizeByBuildingPiece.get(key) ?? 0) + 1);
    }
    const mainPiece = new Map<number, number>();
    for (const [key, size] of sizeByBuildingPiece) {
        const [b, p] = key.split(":").map(Number) as [number, number];
        const current = mainPiece.get(b);
        if (current == null || size > (sizeByBuildingPiece.get(`${b}:${current}`) ?? 0)) mainPiece.set(b, p);
    }
    const strayNodes = new Set(model.walkways.nodes
        .filter(n => pieceOf.get(n.id) !== mainPiece.get(buildingOfFloor.get(n.floorId) ?? -1))
        .map(n => n.id));

    const unreachable: Place[] = [];
    const isolated: Place[] = [];
    for (const place of model.locations) {
        const { gap, nodeId } = walkwayGap(graph, place);
        if (gap > REACH_METERS) unreachable.push(place);
        else if (nodeId && strayNodes.has(nodeId)) isolated.push(place);
    }

    const looseConnectors = model.walkways.nodes
        .filter(n => n.connector && !(graph.neighbors.get(n.id) ?? []).some(x => graph.nodeById.get(x.id)?.floorId !== n.floorId))
        .map(n => n.id);

    const floorsWithWalkways = new Set(model.walkways.nodes.map(n => n.floorId));
    const meters = graph.segments.reduce((sum, [a, b]) => sum + distance(a, b), 0);
    return {
        nodes: model.walkways.nodes.length,
        edges: model.walkways.edges.length,
        meters,
        pieces: new Set(pieceOf.values()).size,
        strayNodes,
        unreachable,
        isolated,
        looseConnectors,
        floorsWithoutPlan: model.floors.filter(f => !f.plan || !f.projection).map(f => f.id),
        floorsWithoutWalkways: model.floors.filter(f => !floorsWithWalkways.has(f.id)).map(f => f.id)
    };
}
