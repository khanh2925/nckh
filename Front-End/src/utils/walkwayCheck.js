import { buildGraph, findEntries, findPieces } from "./routing";
import { getLatLng } from "./geo";

// Admin "Lối đi" → "Kiểm tra": finds the problems that make directions fail, for one terminal.
// Uses the same graph, pieces and "join the network" rule as findRoute,
// so "reachable" here means exactly "directions can find a way to it".
//
// Returns {
//   mainPiece:   the piece most locations join (the "real" network); other pieces are cut off from it
//   locations:   { total, reachable }
//   unreachable: [{ location, reason: "noWalkway" | "isolated" }]
//                noWalkway = no walkway on its floor within 60 m, isolated = only near a cut-off piece
//   pieces:      cut-off pieces [{ id, size, floors, node }], biggest first (node = one point to jump to)
//   connectors:  elevator/escalator/stairs points not linked to any other floor [node]
//   pieceOf:     node id -> piece number (to colour the cut-off pieces on the map)
// }
export function checkWalkways(walkways, locations, terminal) {
    const graph = buildGraph(walkways, terminal);
    const pieceOf = findPieces(graph);
    const terminalLocations = locations.filter(location => location.terminal === terminal);

    // Which pieces each location can join
    const entriesOf = new Map();
    const locationsPerPiece = new Map();
    terminalLocations.forEach(location => {
        const pieces = [...findEntries(graph, pieceOf, { floor: location.floor, ...getLatLng(location) }).keys()];
        entriesOf.set(location.id, pieces);
        pieces.forEach(piece => locationsPerPiece.set(piece, (locationsPerPiece.get(piece) || 0) + 1));
    });

    // Group the nodes by piece
    const pieces = new Map();   // piece -> { id, size, floors, node }
    graph.nodeById.forEach((node, id) => {
        const piece = pieceOf.get(id);
        if (!pieces.has(piece)) pieces.set(piece, { id: piece, size: 0, floors: new Set(), node });
        const entry = pieces.get(piece);
        entry.size++;
        entry.floors.add(node.floor);
    });

    // Main piece: the one most locations join; on a tie, the one with more points
    let mainPiece = null;
    pieces.forEach(piece => {
        const score = [locationsPerPiece.get(piece.id) || 0, piece.size];
        const best = mainPiece && [locationsPerPiece.get(mainPiece.id) || 0, mainPiece.size];
        if (!best || score[0] > best[0] || (score[0] === best[0] && score[1] > best[1])) mainPiece = piece;
    });

    const unreachable = [];
    terminalLocations.forEach(location => {
        const joined = entriesOf.get(location.id);
        if (joined.length === 0) unreachable.push({ location, reason: "noWalkway" });
        else if (!joined.includes(mainPiece.id)) unreachable.push({ location, reason: "isolated" });
    });

    const connectors = [];
    graph.nodeById.forEach((node, id) => {
        if (!node.connector) return;
        const linksOtherFloor = graph.neighbors.get(id).some(next => graph.nodeById.get(next.id).floor !== node.floor);
        if (!linksOtherFloor) connectors.push(node);
    });

    return {
        mainPiece: mainPiece && { ...mainPiece, floors: [...mainPiece.floors].sort((a, b) => a - b) },
        locations: { total: terminalLocations.length, reachable: terminalLocations.length - unreachable.length },
        unreachable,
        pieces: [...pieces.values()]
            .filter(piece => piece !== mainPiece)
            .map(piece => ({ ...piece, floors: [...piece.floors].sort((a, b) => a - b) }))
            .sort((a, b) => b.size - a.size),
        connectors,
        pieceOf
    };
}
