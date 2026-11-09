import { formatMeters, groupLabel, type Floor, type Place, type PlannedRoute, type Position, type StepKind, type VenueModel } from "@indoor-map/core";
import type { LucideName } from "../design/lucide";

// Chữ hiển thị cho khách: không dùng chuỗi "A · B" (dữ liệu gốc có dấu ·, đổi thành dấu phẩy), số thập phân dấu phẩy.

/** "Tầng 1 · Khu Khởi Hành" -> "Tầng 1, Khu Khởi Hành" */
export const clean = (text?: string | null): string => (text ?? "").replace(/\s*[·|]\s*/g, ", ").replace(/,\s*,/g, ",").trim();

export const decimal = (n: number, digits = 2): string => n.toFixed(digits).replace(".", ",");

export const minutesOf = (seconds: number): number => Math.max(1, Math.round(seconds / 60));

export const metersText = (m: number | null | undefined): string => formatMeters(m);

/** Nhãn ô chọn tầng: 0 -> "T" (Trệt), -1 -> "H1", 2 -> "2" */
export function floorShort(level: number): string {
    if (level === 0) return "T";
    if (level < 0) return `H${-level}`;
    return String(level);
}

/** "Tầng 1", "Trệt", "Hầm 1" (phần đầu tên tầng) */
export function floorLabel(floor?: Pick<Floor, "name" | "level"> | null): string {
    if (!floor) return "";
    const first = floor.name.split(/\s*[·|]\s*/)[0] ?? floor.name;
    if (floor.level === 0 || /tr[ệe]t/i.test(first)) return "Trệt";
    return first;
}

/** Dùng trong câu: "ở tầng Trệt", "ở Tầng 1" */
export function floorInSentence(floor?: Pick<Floor, "name" | "level"> | null): string {
    const label = floorLabel(floor);
    return label === "Trệt" ? "tầng Trệt" : label;
}

/** "Tầng 1, Khu Khởi Hành" */
export const floorFull = (floor?: Pick<Floor, "name"> | null): string => clean(floor?.name);

/** "Nhà ga T1" từ "Nhà ga T1 · Quốc nội" */
export const buildingShort = (name?: string | null): string => (name ?? "").split(/\s*[·|]\s*/)[0] ?? "";

/** "T1, Tầng 1, Khu Khởi Hành" (+ khu vực) */
export function placeWhere(model: VenueModel, place: Pick<Place, "floorId" | "area">): string {
    const floor = model.floorsById.get(place.floorId);
    const parts = [floor?.buildingCode, floorFull(floor), clean(place.area)].filter(Boolean);
    return parts.join(", ");
}

/** "QR T1-0-17, Trệt" / tên địa điểm / "Vị trí chọn trên bản đồ" */
export function positionLabel(model: VenueModel, position: Position | null | undefined): string {
    if (!position) return "";
    const floor = model.floorsById.get(position.floorId);
    const where = floorLabel(floor);
    if (position.source === "qr") return `QR ${position.nodeId ?? ""}${where ? `, ${where}` : ""}`.trim();
    if (position.source === "place") return `${position.label ?? "Địa điểm"}${where ? `, ${where}` : ""}`;
    if (position.source === "gps") return `Vị trí GPS${position.accuracy ? ` ±${Math.round(position.accuracy)} m` : ""}`;
    return `Vị trí chọn trên bản đồ${where ? `, ${where}` : ""}`;
}

interface GroupUi {
    label: string;
    icon: LucideName;
    unit: string;
}

const GROUPS: Record<string, GroupUi> = {
    gate: { label: "Cửa ra", icon: "plane", unit: "cửa" },
    procedure: { label: "Thủ tục", icon: "ticket", unit: "quầy" },
    food: { label: "Ăn uống", icon: "utensils", unit: "quán" },
    restroom: { label: "Nhà vệ sinh", icon: "toilet", unit: "khu" },
    service: { label: "Dịch vụ", icon: "store", unit: "điểm" },
    transport: { label: "Thang, lối lên xuống", icon: "arrow-up-down", unit: "điểm" },
    health: { label: "Y tế", icon: "plus", unit: "điểm" },
    study: { label: "Học tập", icon: "file-text", unit: "phòng" },
    office: { label: "Văn phòng", icon: "building", unit: "phòng" },
    leisure: { label: "Giải trí", icon: "sofa", unit: "điểm" },
    campus: { label: "Toà nhà, cổng", icon: "building", unit: "điểm" }
};

export function groupUi(code: string): GroupUi {
    return GROUPS[code] ?? { label: groupLabel(code), icon: "map-pin", unit: "điểm" };
}

const TYPE_ICONS: Record<string, LucideName> = {
    gate: "plane", checkin: "luggage", security: "shield-check", baggage: "luggage", ticket: "ticket", restaurant: "utensils", coffee: "coffee",
    shop: "shopping-bag", lounge: "sofa", atm: "store", information: "info", medical: "plus", smoking: "cigarette", restroom: "toilet",
    elevator: "arrow-up-down", escalator: "chevrons-up", staircase: "footprints", building: "building", campus_gate: "door-open"
};

/** Icon Lucide cho một loại địa điểm (dòng danh sách); không có thì theo nhóm */
export function typeIcon(model: VenueModel, code?: string): LucideName {
    if (code && TYPE_ICONS[code]) return TYPE_ICONS[code];
    return groupUi(model.typeOf(code).groupName ?? "").icon;
}

/** Số địa điểm theo nhóm (một tầng, hoặc cả địa điểm khi floorId = null), theo thứ tự nhóm của dữ liệu */
export function groupCounts(model: VenueModel, floorId: number | null): { code: string; count: number }[] {
    const counts = new Map<string, number>();
    for (const place of model.locations) {
        if (floorId != null && place.floorId !== floorId) continue;
        const g = model.typeOf(place.type).groupName;
        if (g) counts.set(g, (counts.get(g) ?? 0) + 1);
    }
    return model.groups.map(g => ({ code: g.code, count: counts.get(g.code) ?? 0 })).filter(g => g.count > 0);
}

const STEP_ICONS: Record<StepKind, LucideName> = {
    depart: "arrow-up", straight: "arrow-up", left: "corner-up-left", right: "corner-up-right", "slight-left": "arrow-up-left",
    "slight-right": "arrow-up-right", uturn: "undo-2", "floor-up": "arrow-up-down", "floor-down": "arrow-up-down", arrive: "flag"
};

export const stepIcon = (kind?: StepKind): LucideName => (kind ? STEP_ICONS[kind] : "arrow-up");

/** "1 thang máy" / "2 lần đổi tầng" / "Cùng tầng" từ các chặng của tuyến */
export function floorChangeText(route: PlannedRoute): { value: string; label: string } {
    const connectors = route.legs.slice(0, -1).map(l => l.connector ?? "Thang");
    if (!connectors.length) return { value: "0", label: "đổi tầng" };
    const same = connectors.every(c => c === connectors[0]);
    return { value: String(connectors.length), label: same ? (connectors[0] ?? "thang").toLowerCase() : "lần đổi tầng" };
}
