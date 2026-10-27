import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import L from "../../lib/leaflet";
import "leaflet-rotate";
import { plateText, type FloorPoint, type LatLng, type LocationTypeDto, type Place, type Route, type VenueModel } from "@indoor-map/core";
import { api } from "../../lib/data";
import { buildPlanOverlay, parsePlanSvg } from "../../lib/planSvg";

// Bản đồ một tầng: nền bản đồ ngoài trời + bản vẽ mặt bằng + vùng + địa điểm + tuyến + vị trí khách.
// Leaflet vẽ trong <div>; React chỉ truyền dữ liệu, mỗi lớp vẽ lại khi dữ liệu của nó đổi.

export type MapFocus = "floor" | (LatLng & { zoom?: number }) | null;

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
    /** Hướng của khách, độ từ Bắc */
    heading?: number | null;
    /** Xoay bản đồ theo hướng đi */
    headingUp?: boolean;
    destination?: Place | null;
    /** Đổi giá trị là bản đồ bay tới đó */
    focus?: MapFocus;
    onCenterChange?: (center: LatLng) => void;
    /** Bản đồ nhỏ, không tương tác */
    compact?: boolean;
    showMarkers?: boolean;
    className?: string;
}

const TILE_URL = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const ROUTE_COLOR = "#2A54E8";
// Nhìn xa (zoom < 19) chỉ hiện loại quan trọng, đỡ rối; phóng gần hiện hết
const KEY_TYPES = new Set(["gate", "restroom", "checkin", "security", "information", "elevator", "escalator", "baggage"]);
const FAR_ZOOM = 19;

function placeIcon(place: Place, type: LocationTypeDto, selected: boolean): Leaflet.DivIcon {
    const el = document.createElement("span");
    const plate = plateText(place);
    const isGate = place.type === "gate" && plate != null;
    el.className = `wf-marker${isGate ? " is-gate" : ""}${selected ? " is-selected" : ""}${KEY_TYPES.has(place.type ?? "") || selected ? "" : " is-minor"}`;
    if (isGate) {
        el.textContent = plate;
    } else {
        el.style.background = type.color || "#5f6368";
        if (plate === "WC") el.textContent = "WC";
        else {
            const i = document.createElement("i");
            i.className = `bi ${type.icon || "bi-geo-alt"}`;
            el.appendChild(i);
        }
    }
    const width = isGate ? Math.max(28, plate.length * 8 + 12) : 26;
    const size: [number, number] = selected ? [width + 8, 34] : [width, 26];
    return L.divIcon({ className: "", html: el, iconSize: size, iconAnchor: [size[0] / 2, size[1] / 2] });
}

function userIcon(screenHeading: number | null): Leaflet.DivIcon {
    const el = document.createElement("span");
    el.className = "wf-user";
    if (screenHeading != null) {
        const cone = document.createElement("span");
        cone.className = "wf-user-cone";
        cone.style.transform = `rotate(${screenHeading}deg)`;
        el.appendChild(cone);
    }
    const dot = document.createElement("span");
    dot.className = "wf-user-dot";
    el.appendChild(dot);
    return L.divIcon({ className: "", html: el, iconSize: [64, 64], iconAnchor: [32, 32] });
}

function destinationIcon(place: Place): Leaflet.DivIcon {
    const el = document.createElement("span");
    el.className = "wf-dest";
    const plate = plateText(place);
    if (plate) el.textContent = plate;
    else {
        const i = document.createElement("i");
        i.className = "bi bi-flag-fill";
        el.appendChild(i);
    }
    return L.divIcon({ className: "", html: el, iconSize: [36, 36], iconAnchor: [18, 18] });
}

/** Hướng địa lý (0 = Bắc) -> góc trên màn hình (0 = lên). Đo bằng chính bản đồ nên đúng cả khi bản đồ đang xoay. */
function screenAngle(map: Leaflet.Map, at: LatLng, geoBearing: number): number {
    const rad = (geoBearing * Math.PI) / 180;
    const ahead = L.latLng(at.lat + Math.cos(rad) * 0.0001, at.lng + (Math.sin(rad) * 0.0001) / Math.cos((at.lat * Math.PI) / 180));
    const a = map.latLngToContainerPoint(L.latLng(at.lat, at.lng));
    const b = map.latLngToContainerPoint(ahead);
    return (Math.atan2(b.x - a.x, a.y - b.y) * 180) / Math.PI;
}

interface Layers {
    plan: Leaflet.LayerGroup;
    zones: Leaflet.LayerGroup;
    route: Leaflet.LayerGroup;
    markers: Leaflet.LayerGroup;
    dest: Leaflet.LayerGroup;
    user: Leaflet.LayerGroup;
}

export default function FloorMap({
    model, floorId, places, selectedId, onSelect, route, activeLeg = 0, user, heading = null, headingUp = false,
    destination, focus = null, onCenterChange, compact = false, showMarkers = true, className = ""
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
        L.tileLayer(TILE_URL, {
            maxZoom: 22, maxNativeZoom: 20, subdomains: "abcd",
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; CARTO'
        }).addTo(map);
        // Pane phải nằm trong rotatePane của leaflet-rotate để xoay cùng bản đồ
        const rotatePane = map.getPane("rotatePane");
        map.createPane("planPane", rotatePane).style.zIndex = "350";
        map.createPane("routePane", rotatePane).style.zIndex = "450";
        map.getPane("planPane")!.style.pointerEvents = "none";

        layers.current = {
            plan: L.layerGroup().addTo(map), zones: L.layerGroup().addTo(map), route: L.layerGroup().addTo(map),
            markers: L.layerGroup().addTo(map), dest: L.layerGroup().addTo(map), user: L.layerGroup().addTo(map)
        };
        map.on("moveend", () => callbacks.current.onCenterChange?.(map.getCenter()));
        const zoomClass = () => container.current?.classList.toggle("is-far", map.getZoom() < FAR_ZOOM);
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

    // 2. Bản vẽ mặt bằng
    useEffect(() => {
        const group = layers.current?.plan;
        if (!ready || !group) return undefined;
        group.clearLayers();
        const projection = floor?.projection;
        if (!floor?.plan || !projection) return undefined;
        let alive = true;
        const bounds = L.latLngBounds(projection.bounds.map(p => L.latLng(p.lat, p.lng)));
        // nền nhạt che đường phố bên dưới toà nhà
        group.addLayer(L.rectangle(bounds.pad(0.02), { pane: "planPane", stroke: false, fillColor: "#EEF0F4", fillOpacity: 0.85, interactive: false }));
        const plan = floor.plan;
        void api.fetchPlanSvg(plan).then(text => {
            if (!alive || !text) return;
            const svg = parsePlanSvg(text);
            if (svg) group.addLayer(L.svgOverlay(buildPlanOverlay(svg, plan, projection), bounds, { pane: "planPane", interactive: false }));
        });
        return () => {
            alive = false;
        };
    }, [ready, floor]);

    // 3. Vùng (zone): đa giác pixel -> lat/lng
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
            group.addLayer(L.polygon(latlngs, { color: zone.color || ROUTE_COLOR, weight: 1.5, fillOpacity: 0.08, interactive: false, pane: "planPane" }));
        });
    }, [ready, floor, floorId, model]);

    // 4. Địa điểm
    useEffect(() => {
        const group = layers.current?.markers;
        if (!ready || !group) return;
        group.clearLayers();
        if (!showMarkers) return;
        const list = places ?? model.locations.filter(l => l.floorId === floorId);
        for (const place of list) {
            if (place.floorId !== floorId) continue;
            const selected = place.id === selectedId;
            const marker = L.marker([place.lat, place.lng], {
                icon: placeIcon(place, model.typeOf(place.type), selected),
                keyboard: !compact, interactive: !compact, title: place.name, alt: place.name, zIndexOffset: selected ? 1000 : 0, riseOnHover: true
            });
            if (!compact) marker.on("click", () => callbacks.current.onSelect?.(place));
            group.addLayer(marker);
        }
    }, [ready, places, floorId, selectedId, model, compact, showMarkers]);

    // 5. Tuyến: chặng đang đi đậm, chặng khác cùng tầng nét đứt; ô vuông ở chỗ thang
    useEffect(() => {
        const group = layers.current?.route;
        if (!ready || !group) return;
        group.clearLayers();
        if (!route) return;
        route.legs.forEach((leg, index) => {
            if (leg.floorId !== floorId) return;
            const latlngs = leg.points.map(p => L.latLng(p.lat, p.lng));
            const active = index === activeLeg;
            group.addLayer(L.polyline(latlngs, { pane: "routePane", color: "#FBFBFD", weight: active ? 11 : 8, opacity: 1, lineJoin: "round", interactive: false }));
            group.addLayer(L.polyline(latlngs, {
                pane: "routePane", color: ROUTE_COLOR, weight: active ? 6 : 4, opacity: active ? 1 : 0.55, dashArray: active ? undefined : "6 8",
                lineJoin: "round", interactive: false
            }));
            const end = leg.points[leg.points.length - 1];
            if (end && index < route.legs.length - 1) {
                const letter = leg.connector === "Thang cuốn" ? "C" : leg.connector === "Thang bộ" ? "B" : "M";
                group.addLayer(L.marker([end.lat, end.lng], {
                    icon: L.divIcon({ className: "", html: `<span class="wf-connector" title="${leg.connector ?? ""}">${letter}</span>`, iconSize: [26, 26], iconAnchor: [13, 13] }),
                    interactive: false
                }));
            }
        });
    }, [ready, route, activeLeg, floorId]);

    // 6. Đích
    useEffect(() => {
        const group = layers.current?.dest;
        if (!ready || !group) return;
        group.clearLayers();
        if (destination && destination.floorId === floorId) {
            group.addLayer(L.marker([destination.lat, destination.lng], { icon: destinationIcon(destination), interactive: false, zIndexOffset: 2000 }));
        }
    }, [ready, destination, floorId]);

    // 7. Xoay bản đồ theo hướng đi (leaflet-rotate: bearing âm = xoay nội dung ngược chiều kim đồng hồ)
    useEffect(() => {
        const map = mapRef.current;
        if (!ready || !map) return;
        map.setBearing(headingUp && heading != null ? -heading : 0);
    }, [ready, headingUp, heading]);

    // 8. Vị trí khách + hình nón hướng nhìn
    useEffect(() => {
        const group = layers.current?.user;
        const map = mapRef.current;
        if (!ready || !group || !map) return;
        group.clearLayers();
        if (!user || user.floorId !== floorId) return;
        const angle = heading != null ? screenAngle(map, user, heading) : null;
        group.addLayer(L.marker([user.lat, user.lng], { icon: userIcon(angle), interactive: false, zIndexOffset: 3000, keyboard: false }));
    }, [ready, user, heading, floorId, viewTick]);

    // 9. Bay tới chỗ cần xem
    const focusKey = focus === "floor" ? `floor:${floorId}` : focus ? `${focus.lat.toFixed(6)},${focus.lng.toFixed(6)},${focus.zoom ?? ""}` : null;
    useEffect(() => {
        const map = mapRef.current;
        if (!ready || !map || !focusKey || !focus) return;
        if (focus === "floor") {
            // Vừa khít các địa điểm của tầng (bản vẽ InMapz có nhiều lề trắng); tầng chưa có địa điểm thì vừa bản vẽ
            const pts = model.locations.filter(l => l.floorId === floorId).map(l => L.latLng(l.lat, l.lng));
            const projection = floor?.projection;
            if (pts.length >= 3) map.fitBounds(L.latLngBounds(pts), { padding: [28, 28], animate: false });
            else if (projection) map.fitBounds(L.latLngBounds(projection.bounds.map(p => L.latLng(p.lat, p.lng))), { padding: [8, 8], animate: false });
        } else {
            map.setView([focus.lat, focus.lng], focus.zoom ?? Math.max(map.getZoom(), 19), { animate: !compact });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ready, focusKey]);

    return <div ref={container} className={`wf-map${compact ? " is-compact" : ""} ${className}`} />;
}
