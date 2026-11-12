import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import L from "../../lib/leaflet";
import "leaflet-rotate";
import { plateText, type FloorPoint, type LatLng, type LocationTypeDto, type Place, type Route, type VenueModel } from "@indoor-map/core";
import { api } from "../../lib/data";
import { buildPlanOverlay, parsePlanSvg, rasterAsSvg, themePlanSvg } from "../../lib/planSvg";
import { MAP, PLAN_PALETTE, lucideSvg } from "../mapTheme";

// Bản đồ một tầng, phẳng (không nghiêng): nền ngoài trời mờ + mặt bằng tô lại theo kiểu biển chỉ dẫn + vùng + ghim + tuyến + vị trí.
// Ghim = ô biển 24×24 bo 4 có pictogram; cửa ra = ô số nhạt; điểm đến = biển than chì số vàng có đuôi.
// Tuyến = nét vàng trên viền than chì. Vị trí của khách = chấm vàng viền than chì + quạt hướng nhìn.
// Leaflet vẽ trong <div>; React chỉ truyền dữ liệu, mỗi lớp vẽ lại khi dữ liệu của nó đổi.

/** "floor" = vừa khít tầng; điểm (+zoom) = bay tới đó; bounds = vừa khít các điểm */
/** follow: bám theo một điểm đang di chuyển; zoom chỉ áp dụng lần đầu, sau đó giữ mức zoom khách tự chỉnh */
export type MapFocus = "floor" | (LatLng & { zoom?: number; follow?: boolean }) | { bounds: LatLng[] } | null;

interface FloorMapProps {
    model: VenueModel;
    floorId: number;
    /** Địa điểm để vẽ (mặc định: mọi địa điểm của tầng) */
    places?: Place[];
    selectedId?: number | null;
    onSelect?: (place: Place) => void;
    route?: Route | null;
    activeLeg?: number;
    user?: FloorPoint | null;
    /** Bán kính sai số quanh vị trí (m) */
    accuracy?: number | null;
    /** Các giả thuyết vị trí của định vị nâng cao (chấm nhỏ), để thử nghiệm */
    particles?: LatLng[] | null;
    /** Hướng của khách, độ từ Bắc */
    heading?: number | null;
    /** Xoay bản đồ theo hướng đi */
    headingUp?: boolean;
    destination?: Place | null;
    /** Đổi giá trị là bản đồ bay tới đó */
    focus?: MapFocus;
    /** Khoảng trống (px) dành cho thanh nổi phía trên khi vừa khít: [trên, dưới] */
    fitPadding?: [number, number];
    onCenterChange?: (center: LatLng) => void;
    /** Bản đồ nhỏ, không tương tác */
    compact?: boolean;
    showMarkers?: boolean;
    className?: string;
}

// Nền đường phố OSM (CARTO không còn cho dùng không cần khoá API); CSS .wf-tiles-base làm xám nhạt
const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
// Nhìn xa (zoom < 19) chỉ hiện mốc định hướng (cửa ra, an ninh, thang máy, thông tin), không nhãn;
// gần hơn hiện thêm loại quan trọng kèm nhãn; rất gần hiện hết
const TOP_TYPES = new Set(["gate", "security", "information", "elevator", "building", "campus_gate"]);
// Bản đồ khuôn viên: tên toà nhà, cổng luôn hiện (khuôn viên rộng, thường xem ở mức thu nhỏ)
const NAMED_TYPES = new Set(["building", "campus_gate"]);
const KEY_TYPES = new Set([...TOP_TYPES, "restroom", "checkin", "escalator", "baggage"]);
const FAR_ZOOM = 19;
const NEAR_ZOOM = 20.25;
const OVERVIEW_ZOOM = 17;
// Ô biển nhạt (nền trắng, pictogram than chì) cho ăn uống, mua sắm, phòng chờ; còn lại ô than chì
const LIGHT_TYPES = new Set(["coffee", "restaurant", "shop", "lounge"]);

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

function pictogram(place: Pick<Place, "type" | "name">, type: LocationTypeDto, size = 14): string {
    if (place.type === "elevator") return lucideSvg("arrow-up-down", size, "currentColor", 2);
    return `<i class="bi ${escapeHtml(type.icon || "bi-geo-alt")}" style="font-size:${size}px"></i>`;
}

function placeIcon(place: Place, type: LocationTypeDto): Leaflet.DivIcon {
    const plate = plateText(place);
    const key = KEY_TYPES.has(place.type ?? "");
    const top = (TOP_TYPES.has(place.type ?? "") ? " is-top" : "") + (NAMED_TYPES.has(place.type ?? "") ? " is-named" : "");
    const label = `<span class="wf-lbl">${escapeHtml(place.name)}</span>`;
    if (place.type === "gate" && plate) {
        const width = Math.max(28, plate.length * 8 + 12);
        return L.divIcon({
            className: "", html: `<span class="wf-poi is-key is-top"><span class="wf-gate">${escapeHtml(plate)}</span></span>`,
            iconSize: [width, 24], iconAnchor: [width / 2, 12]
        });
    }
    const light = LIGHT_TYPES.has(place.type ?? "");
    return L.divIcon({
        className: "",
        html: `<span class="wf-poi${key ? " is-key" : ""}${top}"><span class="wf-pin${light ? " is-light" : ""}">${pictogram(place, type)}</span>${label}</span>`,
        iconSize: [24, 24], iconAnchor: [12, 12]
    });
}

/** Biển điểm đến / điểm đang chọn: nền than chì, số hoặc pictogram vàng, có đuôi chỉ xuống đúng chỗ */
function signIcon(place: Place, type: LocationTypeDto): Leaflet.DivIcon {
    const plate = plateText(place);
    const content = plate && place.type === "gate" ? escapeHtml(plate) : pictogram(place, type, 20);
    return L.divIcon({ className: "", html: `<span class="wf-sign"><b>${content}</b><i></i></span>`, iconSize: [52, 50], iconAnchor: [26, 50] });
}

function userIcon(screenHeading: number | null, ring: number): Leaflet.DivIcon {
    const box = Math.max(120, ring + 8);
    const cone = screenHeading != null ? `<span class="wf-user-cone" style="transform:rotate(${screenHeading}deg)"></span>` : "";
    const halo = `<span class="wf-user-halo" style="width:${ring}px;height:${ring}px;margin:${-ring / 2}px 0 0 ${-ring / 2}px"></span>`;
    return L.divIcon({
        className: "", html: `<span class="wf-user" style="width:${box}px;height:${box}px">${halo}${cone}<span class="wf-user-dot"></span></span>`,
        iconSize: [box, box], iconAnchor: [box / 2, box / 2]
    });
}

/** Hướng địa lý (0 = Bắc) -> góc trên màn hình (0 = lên). Đo bằng chính bản đồ nên đúng cả khi bản đồ đang xoay. */
function screenAngle(map: Leaflet.Map, at: LatLng, geoBearing: number): number {
    const rad = (geoBearing * Math.PI) / 180;
    const ahead = L.latLng(at.lat + Math.cos(rad) * 0.0001, at.lng + (Math.sin(rad) * 0.0001) / Math.cos((at.lat * Math.PI) / 180));
    const a = map.latLngToContainerPoint(L.latLng(at.lat, at.lng));
    const b = map.latLngToContainerPoint(ahead);
    return (Math.atan2(b.x - a.x, a.y - b.y) * 180) / Math.PI;
}

/** Bán kính sai số (m) -> đường kính quầng (px) ở mức zoom hiện tại */
function ringPixels(map: Leaflet.Map, at: LatLng, meters: number): number {
    const a = map.latLngToContainerPoint(L.latLng(at.lat, at.lng));
    const b = map.latLngToContainerPoint(L.latLng(at.lat + meters / 111_320, at.lng));
    return Math.max(32, Math.min(240, Math.round(Math.hypot(b.x - a.x, b.y - a.y) * 2)));
}

interface Layers {
    plan: Leaflet.LayerGroup;
    zones: Leaflet.LayerGroup;
    route: Leaflet.LayerGroup;
    markers: Leaflet.LayerGroup;
    dest: Leaflet.LayerGroup;
    particles: Leaflet.LayerGroup;
    user: Leaflet.LayerGroup;
}

export default function FloorMap({
    model, floorId, places, selectedId, onSelect, route, activeLeg = 0, user, accuracy = null, particles = null, heading = null, headingUp = false,
    destination, focus = null, fitPadding = [80, 40], onCenterChange, compact = false, showMarkers = true, className = ""
}: FloorMapProps) {
    const container = useRef<HTMLDivElement>(null);
    const mapRef = useRef<Leaflet.Map | null>(null);
    const layers = useRef<Layers | null>(null);
    const [ready, setReady] = useState(false);
    const [viewTick, setViewTick] = useState(0);
    const callbacks = useRef({ onSelect, onCenterChange });
    useEffect(() => {
        callbacks.current = { onSelect, onCenterChange };
    }, [onSelect, onCenterChange]);

    // 1. Tạo bản đồ một lần
    useEffect(() => {
        if (!container.current) return undefined;
        const map = L.map(container.current, {
            center: [model.venue.centerLat ?? 10.8, model.venue.centerLng ?? 106.6], zoom: 17,
            minZoom: 14, maxZoom: 22, zoomSnap: 0.25, zoomControl: false, attributionControl: !compact,
            rotate: true, bearing: 0, touchRotate: false, rotateControl: false, shiftKeyRotate: false,
            dragging: !compact, scrollWheelZoom: !compact, doubleClickZoom: !compact, touchZoom: !compact, keyboard: !compact,
            boxZoom: !compact
        });
        map.attributionControl?.setPrefix(false);
        L.tileLayer(TILE_URL, {
            maxZoom: 22, maxNativeZoom: 19, className: "wf-tiles-base",
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }).addTo(map);
        // Pane phải nằm trong rotatePane của leaflet-rotate để xoay cùng bản đồ
        const rotatePane = map.getPane("rotatePane");
        map.createPane("planPane", rotatePane).style.zIndex = "350";
        map.createPane("routePane", rotatePane).style.zIndex = "450";
        map.getPane("planPane")!.style.pointerEvents = "none";

        layers.current = {
            plan: L.layerGroup().addTo(map), zones: L.layerGroup().addTo(map), route: L.layerGroup().addTo(map),
            markers: L.layerGroup().addTo(map), dest: L.layerGroup().addTo(map), particles: L.layerGroup().addTo(map),
            user: L.layerGroup().addTo(map)
        };
        map.on("moveend", () => callbacks.current.onCenterChange?.(map.getCenter()));
        const zoomClass = () => {
            const z = map.getZoom();
            container.current?.classList.toggle("is-far", z < FAR_ZOOM);
            container.current?.classList.toggle("is-near", z >= NEAR_ZOOM);
            container.current?.classList.toggle("is-overview", z < OVERVIEW_ZOOM);
        };
        map.on("zoomend", zoomClass);
        zoomClass();
        map.on("rotate zoomend", () => setViewTick(t => t + 1));
        const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
        observer.observe(container.current);
        mapRef.current = map;
        setReady(true);
        return () => {
            observer.disconnect();
            map.stop();
            map.off();
            map.remove();
            mapRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const floor = model.floorsById.get(floorId);

    // 2. Bản vẽ mặt bằng, tô lại theo bảng màu phẳng
    useEffect(() => {
        const group = layers.current?.plan;
        if (!ready || !group) return undefined;
        group.clearLayers();
        const projection = floor?.projection;
        if (!floor?.plan || !projection) return undefined;
        let alive = true;
        const bounds = L.latLngBounds(projection.bounds.map(p => L.latLng(p.lat, p.lng)));
        // nền giấy che đường phố bên dưới toà nhà
        group.addLayer(L.rectangle(bounds.pad(0.04), { pane: "planPane", stroke: false, fillColor: MAP.paper, fillOpacity: 0.9, interactive: false }));
        const plan = floor.plan;
        void api.fetchPlanSvg(plan).then(text => {
            if (!alive) return;
            const parsed = text ? parsePlanSvg(text) : null;
            if (parsed) themePlanSvg(parsed, PLAN_PALETTE);
            const svg = parsed ?? (plan.imageUrl?.startsWith("data:image/") ? rasterAsSvg(plan.imageUrl, plan.width ?? 1, plan.height ?? 1) : null);
            if (svg) group.addLayer(L.svgOverlay(buildPlanOverlay(svg, plan, projection), bounds, { pane: "planPane", interactive: false }));
        });
        return () => {
            alive = false;
        };
    }, [ready, floor]);

    // 3. Vùng (zone): đa giác pixel -> lat/lng, nét mảnh
    useEffect(() => {
        const group = layers.current?.zones;
        if (!ready || !group) return;
        group.clearLayers();
        const projection = floor?.projection;
        if (!projection) return;
        model.zones.filter(z => z.floorId === floorId).forEach(zone => {
            const latlngs = zone.polygon.map(([x, y]) => {
                const p = projection.toLatLng(x, y);
                return L.latLng(p.lat, p.lng);
            });
            group.addLayer(L.polygon(latlngs, { color: zone.color || MAP.edge, weight: 1, opacity: 0.6, fillOpacity: 0.05, interactive: false, pane: "planPane" }));
        });
    }, [ready, floor, floorId, model]);

    // 4. Địa điểm (điểm đang chọn / điểm đến vẽ ở lớp biển riêng)
    useEffect(() => {
        const group = layers.current?.markers;
        if (!ready || !group) return;
        group.clearLayers();
        if (!showMarkers) return;
        const list = places ?? model.locations.filter(l => l.floorId === floorId);
        for (const place of list) {
            if (place.floorId !== floorId || place.id === selectedId || place.id === destination?.id) continue;
            const marker = L.marker([place.lat, place.lng], {
                icon: placeIcon(place, model.typeOf(place.type)),
                keyboard: !compact, interactive: !compact, title: place.name, alt: place.name, riseOnHover: true,
                zIndexOffset: KEY_TYPES.has(place.type ?? "") ? 100 : 0
            });
            if (!compact) marker.on("click", () => callbacks.current.onSelect?.(place));
            group.addLayer(marker);
        }
    }, [ready, places, floorId, selectedId, destination, model, compact, showMarkers]);

    // 5. Tuyến: chặng đang đi vàng viền than chì; chặng khác cùng tầng chấm than chì; ô thang ở chỗ đổi tầng
    useEffect(() => {
        const group = layers.current?.route;
        if (!ready || !group) return;
        group.clearLayers();
        if (!route) return;
        route.legs.forEach((leg, index) => {
            if (leg.floorId !== floorId) return;
            const latlngs = leg.points.map(p => L.latLng(p.lat, p.lng));
            const active = index === activeLeg;
            if (active) {
                group.addLayer(L.polyline(latlngs, { pane: "routePane", color: MAP.routeEdge, weight: 10, opacity: 1, lineJoin: "round", lineCap: "round", interactive: false }));
                group.addLayer(L.polyline(latlngs, { pane: "routePane", color: MAP.signal, weight: 5.5, opacity: 1, lineJoin: "round", lineCap: "round", interactive: false }));
            } else {
                group.addLayer(L.polyline(latlngs, { pane: "routePane", color: MAP.graphite, weight: 6, opacity: 0.9, dashArray: "1 11", lineCap: "round", lineJoin: "round", interactive: false }));
            }
            const end = leg.points[leg.points.length - 1];
            if (end && index < route.legs.length - 1) {
                const icon = leg.connector === "Thang cuốn" ? "chevrons-up" : leg.connector === "Thang bộ" ? "footprints" : "arrow-up-down";
                group.addLayer(L.marker([end.lat, end.lng], {
                    icon: L.divIcon({
                        className: "", html: `<span class="wf-pin is-conn" title="${escapeHtml(leg.connector ?? "")}">${lucideSvg(icon, 14, MAP.surface, 2)}</span>`,
                        iconSize: [24, 24], iconAnchor: [12, 12]
                    }),
                    interactive: false, zIndexOffset: 500
                }));
            }
        });
    }, [ready, route, activeLeg, floorId]);

    // 6. Điểm đến / điểm đang chọn: biển lớn
    useEffect(() => {
        const group = layers.current?.dest;
        if (!ready || !group) return;
        group.clearLayers();
        const selected = selectedId != null ? model.locationsById.get(selectedId) : undefined;
        [destination, selected].forEach(place => {
            if (!place || place.floorId !== floorId) return;
            group.addLayer(L.marker([place.lat, place.lng], { icon: signIcon(place, model.typeOf(place.type)), interactive: false, zIndexOffset: 2000, keyboard: false }));
        });
    }, [ready, destination, selectedId, floorId, model]);

    // 7. Xoay bản đồ theo hướng đi (leaflet-rotate: bearing âm = xoay nội dung ngược chiều kim đồng hồ). Bản đồ luôn phẳng.
    useEffect(() => {
        const map = mapRef.current;
        if (!ready || !map) return;
        map.setBearing(headingUp && heading != null ? -heading : 0);
    }, [ready, headingUp, heading]);

    // 8. Vị trí khách + quầng sai số + quạt hướng nhìn
    useEffect(() => {
        const group = layers.current?.user;
        const map = mapRef.current;
        if (!ready || !group || !map) return;
        group.clearLayers();
        if (!user || user.floorId !== floorId) return;
        const angle = heading != null ? screenAngle(map, user, heading) : null;
        const ring = accuracy != null ? ringPixels(map, user, accuracy) : 40;
        group.addLayer(L.marker([user.lat, user.lng], { icon: userIcon(angle, ring), interactive: false, zIndexOffset: 3000, keyboard: false }));
    }, [ready, user, heading, accuracy, floorId, viewTick]);

    // 8b. Giả thuyết của định vị nâng cao (khi bật trong Cài đặt)
    useEffect(() => {
        const group = layers.current?.particles;
        if (!ready || !group) return;
        group.clearLayers();
        for (const p of particles ?? []) {
            group.addLayer(L.circleMarker([p.lat, p.lng], { radius: 2, stroke: false, fillColor: MAP.particle, fillOpacity: 0.45, interactive: false }));
        }
    }, [ready, particles]);

    // 9. Bay tới chỗ cần xem
    const focusKey = focus === "floor"
        ? `floor:${floorId}`
        : focus && "bounds" in focus
            ? `b:${focus.bounds.map(p => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`).join(";")}`
            : focus ? `${focus.lat.toFixed(6)},${focus.lng.toFixed(6)},${focus.zoom ?? ""}` : null;
    const followed = useRef(false);
    useEffect(() => {
        const map = mapRef.current;
        if (!ready || !map || !focusKey || !focus) return;
        const padTL: [number, number] = [24, fitPadding[0]];
        const padBR: [number, number] = [compact ? 8 : 72, fitPadding[1]];
        if (focus === "floor") {
            // Vừa khít các địa điểm của tầng (bản vẽ InMapz có nhiều lề trắng); tầng chưa có địa điểm thì vừa bản vẽ
            const pts = model.locations.filter(l => l.floorId === floorId).map(l => L.latLng(l.lat, l.lng));
            const projection = floor?.projection;
            if (pts.length >= 3) map.fitBounds(L.latLngBounds(pts), { paddingTopLeft: padTL, paddingBottomRight: padBR, animate: false });
            else if (projection) map.fitBounds(L.latLngBounds(projection.bounds.map(p => L.latLng(p.lat, p.lng))), { padding: [8, 8], animate: false });
        } else if ("bounds" in focus) {
            if (focus.bounds.length) map.fitBounds(L.latLngBounds(focus.bounds.map(p => L.latLng(p.lat, p.lng))), { paddingTopLeft: padTL, paddingBottomRight: padBR, maxZoom: 21, animate: false });
        } else {
            const zoom = focus.follow && followed.current ? map.getZoom() : focus.zoom ?? Math.max(map.getZoom(), 19);
            followed.current = Boolean(focus.follow);
            map.setView([focus.lat, focus.lng], zoom, { animate: !compact });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ready, focusKey]);

    return <div ref={container} className={`wf-map${compact ? " is-compact" : ""} ${className}`} />;
}
