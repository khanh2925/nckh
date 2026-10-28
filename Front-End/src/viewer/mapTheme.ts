import { LUCIDE, type LucideName } from "../design/lucide";
import type { PlanPalette } from "../lib/planSvg";

// Màu bản đồ dạng chuỗi hex: Leaflet và SVG mặt bằng cần màu cụ thể, không đọc được var(--...).
// Giá trị = token trong design/tokens.css (than chì #23272D, vàng tín hiệu #FFC629) đã trộn sẵn như tools/tokens.py.
export const MAP = {
    graphite: "#23272D",
    signal: "#FFC629",
    surface: "#FFFFFF",
    paper: "#F4F5F2",
    muted: "#5B6169",
    danger: "#B42318",
    /** --m-edge: than chì 34% */
    edge: "#B4B6B8",
    /** --m-hatch */
    hatch: "#CACCCB"
} as const;

/** Bảng màu mặt bằng theo kiểu biển chỉ dẫn (vmap_common.plan_paths) */
export const PLAN_PALETTE: PlanPalette = {
    floor: "#FFFFFF",
    wall: MAP.graphite,
    edge: MAP.edge,
    gate: "#F6F6F7",
    amenity: "#E7E7E8",
    lounge: "#FFFAEE",
    retail: "#FFF3D0",
    core: "#FFE8A9",
    service: "#DDDEDC",
    hatch: MAP.hatch
};

/** Icon Lucide dạng chuỗi SVG, cho phần tử DOM mà Leaflet tự tạo (divIcon) */
export function lucideSvg(name: LucideName, size = 16, color = "currentColor", stroke = 2): string {
    const inner = LUCIDE[name]
        .map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(" ")}/>`)
        .join("");
    return `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}
