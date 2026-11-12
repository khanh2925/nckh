import { LUCIDE, type LucideName } from "../design/lucide";
import type { PlanPalette } from "../lib/planSvg";

// Màu bản đồ dạng chuỗi hex: Leaflet và SVG mặt bằng cần màu cụ thể, không đọc được var(--...).
// Giá trị = token trong design/tokens.css (neutral-900 #171717, xanh dương blue-600 #155DFC), cùng theme với Builder/Admin.
export const MAP = {
    graphite: "#171717",
    signal: "#155DFC",
    /** viền tuyến: xanh đậm blue-900 */
    routeEdge: "#1E3A8A",
    surface: "#FFFFFF",
    paper: "#FAFAFA",
    muted: "#737373",
    danger: "#DC2626",
    /** --m-edge: chữ đậm 34% */
    edge: "#B3B3B3",
    /** --m-hatch */
    hatch: "#CCCCCC",
    /** chấm giả thuyết của định vị nâng cao (màu chủ đạo, mờ) */
    particle: "#155DFC"
} as const;

/** Bảng màu mặt bằng: nền trắng, tường đậm, khu tiện ích/thương mại tô xanh nhạt theo màu chủ đạo */
export const PLAN_PALETTE: PlanPalette = {
    floor: "#FFFFFF",
    wall: MAP.graphite,
    edge: MAP.edge,
    gate: "#F6F6F7",
    amenity: "#E7E7E8",
    lounge: "#F0F6FF",
    retail: "#E3EEFF",
    core: "#C7DBFF",
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
