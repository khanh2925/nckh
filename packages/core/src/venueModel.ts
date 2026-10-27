import { distance } from "./geo";
import { createProjection, type FloorProjection } from "./projection";
import { normalizeText } from "./text";
import type {
    BuildingDto, FacilityDto, FloorDto, FloorPoint, LocationDto, LocationTypeDto, VenueDto, VenueMapDto, WalkwayNetworkDto,
    WalkwayNodeDto, ZoneDto
} from "./types";

/** Tên hiển thị của nhóm loại địa điểm (group_name trong CSDL là mã) */
const GROUP_LABELS: Record<string, string> = {
    gate: "Cửa ra", procedure: "Thủ tục", food: "Ăn uống", service: "Dịch vụ", restroom: "WC",
    transport: "Di chuyển", health: "Y tế", study: "Học tập", office: "Văn phòng", leisure: "Giải trí"
};
const GROUP_ORDER = ["gate", "procedure", "food", "restroom", "service", "transport"];

export function groupLabel(code?: string): string {
    if (!code) return "Khác";
    return GROUP_LABELS[code] ?? code.charAt(0).toUpperCase() + code.slice(1);
}

export interface Floor extends FloorDto {
    projection: FloorProjection | null;
    buildingCode: string;
}

/** Địa điểm đã chắc chắn có lat/lng, kèm chuỗi tìm kiếm không dấu */
export interface Place extends Omit<LocationDto, "lat" | "lng"> {
    lat: number;
    lng: number;
    search: string;
}

export interface VenueModel {
    venue: VenueDto;
    buildings: BuildingDto[];
    buildingsById: Map<number, BuildingDto>;
    floors: Floor[];
    floorsById: Map<number, Floor>;
    /** Tầng của một toà nhà, cao xuống thấp */
    floorsOf(buildingId: number): Floor[];
    typeOf(code?: string): LocationTypeDto;
    locations: Place[];
    locationsById: Map<number, Place>;
    groups: { code: string; label: string }[];
    zones: ZoneDto[];
    walkways: WalkwayNetworkDto;
    nodesById: Map<string, WalkwayNodeDto>;
    locationCount: Map<number, number>;
    defaultFloor: Floor | undefined;
    facilities: FacilityDto[];
}

const FALLBACK_TYPE: LocationTypeDto = { code: "other", name: "Địa điểm khác", icon: "bi-geo-alt", color: "#5f6368", groupName: "service" };

/** Gói GET /api/venues/{slug}/map -> các bảng tra cứu nhanh cho giao diện */
export function buildVenueModel(bundle: VenueMapDto): VenueModel {
    const buildings = [...bundle.buildings].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const buildingsById = new Map(buildings.map(b => [b.id, b]));
    const floors: Floor[] = bundle.floors.map(floor => ({
        ...floor,
        projection: floor.plan ? createProjection(floor.plan) : null,
        buildingCode: floor.buildingCode ?? buildingsById.get(floor.buildingId)?.code ?? ""
    }));
    const floorsById = new Map(floors.map(f => [f.id, f]));
    const floorsOf = (buildingId: number) => floors.filter(f => f.buildingId === buildingId).sort((a, b) => b.level - a.level);

    const typesByCode = new Map(bundle.types.map(t => [t.code, t]));
    const fallback = typesByCode.get("other") ?? FALLBACK_TYPE;
    const typeOf = (code?: string) => (code && typesByCode.get(code)) || fallback;

    // Địa điểm thiếu lat/lng nhưng có x/y pixel: tính từ phép chiếu của tầng
    const locations: Place[] = [];
    for (const loc of bundle.locations) {
        let lat = loc.lat;
        let lng = loc.lng;
        if (lat == null || lng == null) {
            const projection = floorsById.get(loc.floorId)?.projection;
            if (!projection || loc.x == null || loc.y == null) continue;
            ({ lat, lng } = projection.toLatLng(loc.x, loc.y));
        }
        locations.push({ ...loc, lat, lng, search: normalizeText(`${loc.name} ${typeOf(loc.type).name} ${loc.area ?? ""}`) });
    }
    const locationsById = new Map(locations.map(l => [l.id, l]));

    const rank = (code: string) => {
        const i = GROUP_ORDER.indexOf(code);
        return i === -1 ? 99 : i;
    };
    const groups = [...new Set(bundle.types.map(t => t.groupName).filter((g): g is string => Boolean(g)))]
        .sort((a, b) => rank(a) - rank(b))
        .map(code => ({ code, label: groupLabel(code) }));

    const walkways = bundle.walkways ?? { nodes: [], edges: [] };
    const nodesById = new Map(walkways.nodes.map(n => [n.id, n]));
    const locationCount = new Map<number, number>();
    for (const l of locations) locationCount.set(l.floorId, (locationCount.get(l.floorId) ?? 0) + 1);

    // Tầng mở mặc định: tầng nhiều địa điểm nhất của toà nhà đầu tiên có mặt bằng
    const firstBuilding = buildings.find(b => floors.some(f => f.buildingId === b.id && f.plan)) ?? buildings[0];
    const defaultFloor = firstBuilding
        ? [...floorsOf(firstBuilding.id)].sort((a, b) => (locationCount.get(b.id) ?? 0) - (locationCount.get(a.id) ?? 0))[0]
        : floors[0];

    return {
        venue: bundle.venue, buildings, buildingsById, floors, floorsById, floorsOf, typeOf, locations, locationsById, groups,
        zones: bundle.zones ?? [], walkways, nodesById, locationCount, defaultFloor, facilities: bundle.facilities ?? []
    };
}

export interface SearchHit {
    place: Place;
    /** Khoảng cách ước lượng (m) khi biết vị trí; đổi tầng cộng thêm 40 m */
    meters: number | null;
}

export interface SearchOptions {
    group?: string | null;
    floorId?: number | null;
    near?: FloorPoint | null;
    limit?: number;
}

/** Tìm kiếm không dấu. Biết vị trí thì xếp gần trước, không thì tên bắt đầu bằng từ khoá trước. */
export function searchPlaces(model: VenueModel, query: string, { group = null, floorId = null, near = null, limit = 60 }: SearchOptions = {}): SearchHit[] {
    // Mỗi từ gõ vào phải là ĐẦU của một từ trong tên/loại/khu vực: "cua 1" khớp "Cửa 12", "b" không khớp "Tuyến"
    const words = normalizeText(query).split(/\s+/).filter(Boolean);
    const hits: (SearchHit & { score: number })[] = [];
    for (const place of model.locations) {
        if (group && model.typeOf(place.type).groupName !== group) continue;
        if (floorId && place.floorId !== floorId) continue;
        const tokens = place.search.split(/[^a-z0-9]+/).filter(Boolean);
        if (!words.every(w => tokens.some(t => t.startsWith(w)))) continue;
        const nameTokens = normalizeText(place.name).split(/[^a-z0-9]+/).filter(Boolean);
        // điểm: số từ khớp ngay trong tên (cao hơn tốt hơn), tên ngắn hơn ưu tiên
        const inName = words.filter(w => nameTokens.some(t => t.startsWith(w))).length;
        const score = (words.length - inName) * 10 + nameTokens.length;
        const meters = near ? distance(near, place) + (near.floorId !== place.floorId ? 40 : 0) : null;
        hits.push({ place, meters, score });
    }
    hits.sort((a, b) =>
        a.meters != null && b.meters != null ? a.meters - b.meters : a.score - b.score || a.place.name.normalize("NFC").localeCompare(b.place.name.normalize("NFC"), "vi", { numeric: true }));
    return hits.slice(0, limit).map(({ place, meters }) => ({ place, meters }));
}

/** "T1 · Tầng 1 · Khu Khởi Hành" */
export function floorTitle(model: VenueModel, floorId: number): string {
    const floor = model.floorsById.get(floorId);
    if (!floor) return "";
    return `${floor.buildingCode} · ${floor.name}`;
}
