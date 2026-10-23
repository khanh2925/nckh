import { buildGraph, findEntries, findPieces } from "../utils/routing";
import { checkWalkways } from "../utils/walkwayCheck";
import { distance, getLatLng } from "../utils/geo";
import { getLocationType, locationTypes } from "../data/locationTypes";
import { normalizeText } from "../utils/text";

export const TERMINALS = ["T1", "T2", "T3"];
const FAR_FROM_WALKWAY_METERS = 20;   // farther than this, the route starts/ends with a long straight jump
const DUPLICATE_METERS = 3;

// Per terminal: how many locations, walkway points, and how many locations directions can reach
export function terminalSummaries(locations, walkways) {
    return TERMINALS.map(terminal => {
        const check = checkWalkways(walkways, locations, terminal);
        const floors = [...new Set(locations.filter(item => item.terminal === terminal).map(item => item.floor))].sort((a, b) => a - b);
        return {
            terminal,
            locations: check.locations.total,
            reachable: check.locations.reachable,
            walkwayPoints: walkways.nodes.filter(node => node.terminal === terminal).length,
            pieces: check.pieces.length,
            connectors: check.connectors.length,
            unreachable: check.unreachable,
            floors: floors.map(floor => {
                const onFloor = check.unreachable.filter(item => item.location.floor === floor).length;
                const total = locations.filter(item => item.terminal === terminal && item.floor === floor).length;
                return { floor, total, reachable: total - onFloor };
            })
        };
    });
}

// Rules for the location data. Each finds places to fix by hand in "Địa điểm".
const LOCATION_RULES = [
    {
        id: "gate-name",
        title: "Loại “Cửa ra máy bay” nhưng tên không phải số cửa",
        why: "Thường là cửa hàng bị chọn nhầm loại; trên bản đồ nó hiện như một cửa ra máy bay.",
        test: location => location.type === "gate" && !/^C[ửủ]a\s*\d/i.test(location.name)
    },
    {
        id: "restroom-type",
        title: "Tên là nhà vệ sinh nhưng loại khác",
        why: "Hành khách lọc “Nhà vệ sinh” sẽ không thấy chỗ này.",
        test: location => normalizeText(location.name).includes("ve sinh") && getLocationType(location.type).group !== "restroom"
    },
    {
        id: "typo-cua",
        title: "Tên bắt đầu bằng “Của”, có thể gõ nhầm “Cửa”",
        why: "Tìm “cửa 18” sẽ không ra.",
        test: location => /^Của\s/.test(location.name)
    },
    {
        id: "untyped",
        title: "Chưa phân loại (Địa điểm khác)",
        why: "Không thuộc nhóm lọc nào và hiện bằng biểu tượng chung.",
        test: location => !locationTypes[location.type] || location.type === "other"
    },
    {
        id: "no-latlng",
        title: "Chỉ có tọa độ pixel, thiếu kinh độ/vĩ độ",
        why: "Vị trí được suy ra từ bản vẽ cũ của T1, có thể lệch.",
        test: location => location.lat == null || location.lng == null
    }
];

// Groups of the same name on the same floor closer than DUPLICATE_METERS: likely entered twice
function findDuplicates(locations) {
    const found = [];
    const byKey = new Map();
    locations.forEach(location => {
        const key = `${location.terminal}|${location.floor}|${normalizeText(location.name)}`;
        if (!byKey.has(key)) byKey.set(key, []);
        byKey.get(key).push(location);
    });
    byKey.forEach(group => {
        for (let i = 0; i < group.length; i++) {
            for (let j = i + 1; j < group.length; j++) {
                if (distance(getLatLng(group[i]), getLatLng(group[j])) < DUPLICATE_METERS) found.push(group[j]);
            }
        }
    });
    return [...new Set(found)];
}

// Locations that can be routed to, but join the walkway far away (between 20 and 60 m)
function findFarFromWalkway(locations, walkways) {
    return TERMINALS.flatMap(terminal => {
        const graph = buildGraph(walkways, terminal);
        const pieceOf = findPieces(graph);
        return locations
            .filter(location => location.terminal === terminal)
            .map(location => {
                const entries = [...findEntries(graph, pieceOf, { floor: location.floor, ...getLatLng(location) }).values()];
                const gap = Math.min(...entries.map(entry => entry.gap));
                return { location, gap };
            })
            .filter(item => Number.isFinite(item.gap) && item.gap > FAR_FROM_WALKWAY_METERS)
            .map(item => ({ ...item.location, detail: `${Math.round(item.gap)} m tới lối đi gần nhất` }));
    });
}

// [{ id, title, why, items: [location (+ detail)] }], only rules that found something, biggest first
export function findLocationIssues(locations, walkways) {
    const issues = LOCATION_RULES.map(rule => ({ ...rule, items: locations.filter(rule.test) }));
    issues.push({
        id: "duplicate",
        title: "Có thể bị nhập trùng",
        why: `Cùng tên, cùng tầng, cách nhau dưới ${DUPLICATE_METERS} m.`,
        items: findDuplicates(locations)
    });
    issues.push({
        id: "far",
        title: `Cách lối đi trên ${FAR_FROM_WALKWAY_METERS} m`,
        why: "Đường chỉ ra phải đi thẳng một đoạn dài tới lối đi; nên vẽ thêm lối đi gần đó.",
        items: findFarFromWalkway(locations, walkways)
    });
    return issues.filter(issue => issue.items.length > 0).sort((a, b) => b.items.length - a.items.length);
}
