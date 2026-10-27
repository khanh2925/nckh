import type { ControlPoint, LatLng, PlanDto } from "./types";

// Đặt bản vẽ mặt bằng (đơn vị pixel của bản vẽ) lên bản đồ thật (lat/lng). Toán thuần, không phụ thuộc Leaflet,
// để app React Native cũng dùng được.
//
// Biết 2 điểm mốc ("anchor" và "end") vừa ở pixel vừa ở lat/lng → (ux, uy) = 1 pixel theo trục x của bản vẽ
// đi được bao xa trên bản đồ (đã gồm tỉ lệ + góc xoay). 1 pixel theo trục y đi theo hướng vuông góc (uy, -ux),
// nhân depthScale vì bản vẽ có thể bị kéo giãn theo chiều sâu. Đây là phép biến đổi affine trong hệ Web Mercator.

const R = 6378137;
const MAX_LAT = 85.0511287798;

/** Web Mercator (EPSG:3857): lat/lng -> mét, y hướng LÊN (bắc) */
export function mercatorProject({ lat, lng }: LatLng): { x: number; y: number } {
    const clamped = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));
    const sin = Math.sin((clamped * Math.PI) / 180);
    return { x: (R * lng * Math.PI) / 180, y: (R * Math.log((1 + sin) / (1 - sin))) / 2 };
}

export function mercatorUnproject({ x, y }: { x: number; y: number }): LatLng {
    return { lat: ((2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * 180) / Math.PI, lng: (x * 180) / (Math.PI * R) };
}

export interface FloorProjection {
    toLatLng(x: number, y: number): LatLng;
    toImage(point: LatLng): { x: number; y: number };
    /** Khung bao lat/lng thẳng trục của bản vẽ: [tây-nam, đông-bắc] */
    bounds: [LatLng, LatLng];
    /** Cho SVG ngoài: viewBox và ma trận đặt bản vẽ gốc vào trong (1 đơn vị = 1 mét Mercator) */
    viewBox: string;
    transform: string;
}

export function hasProjection(plan?: PlanDto): plan is Required<Pick<PlanDto, "anchor" | "end" | "width" | "height">> & PlanDto {
    return Boolean(plan?.anchor && plan.end && plan.width && plan.height && plan.end.image[0] !== plan.anchor.image[0]);
}

export function createProjection(plan: PlanDto): FloorProjection | null {
    if (!hasProjection(plan)) return null;
    const { width, height, anchor, end } = plan;
    const depthScale = plan.depthScale ?? 1;
    const start = mercatorProject({ lat: anchor.latlng[0], lng: anchor.latlng[1] });
    const finish = mercatorProject({ lat: end.latlng[0], lng: end.latlng[1] });
    const span = end.image[0] - anchor.image[0];
    const ux = (finish.x - start.x) / span;
    const uy = (finish.y - start.y) / span;

    const imageToWorld = (x: number, y: number) => {
        const dx = x - anchor.image[0];
        const dy = y - anchor.image[1];
        return { x: start.x + dx * ux + dy * uy * depthScale, y: start.y + dx * uy - dy * ux * depthScale };
    };

    // Nghịch đảo imageToWorld: giải hệ 2 phương trình theo dx, dy
    const toImage = (point: LatLng) => {
        const p = mercatorProject(point);
        const dx = p.x - start.x;
        const dy = p.y - start.y;
        const square = ux * ux + uy * uy;
        return {
            x: anchor.image[0] + (dx * ux + dy * uy) / square,
            y: anchor.image[1] + (dx * uy - dy * ux) / (depthScale * square)
        };
    };

    const corners = ([[0, 0], [width, 0], [width, height], [0, height]] as const).map(([x, y]) => imageToWorld(x, y));
    const minX = Math.min(...corners.map(p => p.x));
    const maxX = Math.max(...corners.map(p => p.x));
    const minY = Math.min(...corners.map(p => p.y));
    const maxY = Math.max(...corners.map(p => p.y));
    const origin = imageToWorld(0, 0);

    return {
        toLatLng: (x, y) => mercatorUnproject(imageToWorld(x, y)),
        toImage,
        bounds: [mercatorUnproject({ x: minX, y: minY }), mercatorUnproject({ x: maxX, y: maxY })],
        viewBox: `0 0 ${maxX - minX} ${maxY - minY}`,
        // SVG có trục y hướng XUỐNG nên đảo dấu các hệ số theo y
        transform: `matrix(${ux} ${-uy} ${uy * depthScale} ${ux * depthScale} ${origin.x - minX} ${maxY - origin.y})`
    };
}

/**
 * Hai cặp điểm mốc bất kỳ (pixel ↔ lat/lng) -> anchor/end theo định dạng của API (end nằm cùng hàng pixel với anchor).
 * Tính phép đồng dạng (xoay + tỉ lệ) bằng số phức: q = (B−A)thế giới / (B−A)bản vẽ, trục y của bản vẽ đảo chiều.
 * depthScale để 1; người dùng chỉnh thêm nếu bản vẽ bị kéo giãn theo chiều sâu.
 */
export function anchorsFromTwoPoints(a: ControlPoint, b: ControlPoint): { anchor: ControlPoint; end: ControlPoint } | null {
    const aw = mercatorProject({ lat: a.latlng[0], lng: a.latlng[1] });
    const bw = mercatorProject({ lat: b.latlng[0], lng: b.latlng[1] });
    const vx = b.image[0] - a.image[0];
    const vy = -(b.image[1] - a.image[1]);
    const wx = bw.x - aw.x;
    const wy = bw.y - aw.y;
    const norm = vx * vx + vy * vy;
    if (norm < 1 || wx * wx + wy * wy === 0) return null;
    // q = w / v (số phức)
    const qx = (wx * vx + wy * vy) / norm;
    const qy = (wy * vx - wx * vy) / norm;
    const span = Math.max(Math.abs(vx), Math.abs(vy), 1);
    const endWorld = { x: aw.x + qx * span, y: aw.y + qy * span };
    const end = mercatorUnproject(endWorld);
    return {
        anchor: { image: [a.image[0], a.image[1]], latlng: [a.latlng[0], a.latlng[1]] },
        end: { image: [a.image[0] + span, a.image[1]], latlng: [end.lat, end.lng] }
    };
}

/** Thông số dễ hiểu của phép chiếu: góc xoay (độ, theo chiều kim đồng hồ so với hướng Bắc lên trên) và mét / pixel */
export function describeProjection(plan: PlanDto): { rotation: number; metersPerPixel: number } | null {
    if (!hasProjection(plan)) return null;
    const a = plan.anchor.latlng;
    const e = plan.end.latlng;
    const span = plan.end.image[0] - plan.anchor.image[0];
    const dLat = (e[0] - a[0]) * 110574;
    const dLng = (e[1] - a[1]) * 111320 * Math.cos((a[0] * Math.PI) / 180);
    const meters = Math.hypot(dLat, dLng);
    // trục x của bản vẽ chỉ hướng nào (0 = Đông): góc xoay bản vẽ = hướng trục x − 90°
    const xAxisBearing = (Math.atan2(dLng, dLat) * 180) / Math.PI;
    return { rotation: Math.round((xAxisBearing - 90) * 10) / 10, metersPerPixel: meters / Math.abs(span) };
}
