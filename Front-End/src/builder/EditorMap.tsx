import { useEffect, useRef, useState, type ReactNode } from "react";
import type * as Leaflet from "leaflet";
import type { VenueModel } from "@indoor-map/core";
import L from "../lib/leaflet";
import { api } from "../lib/data";
import { buildPlanOverlay, parsePlanSvg, rasterAsSvg } from "../lib/planSvg";

// Bản đồ nền cho trình biên tập: nền ngoài trời + bản vẽ mặt bằng của tầng đang chọn.
// Các lớp biên tập (điểm, vùng, lối đi...) là component con nhận "map" và tự vẽ bằng useEffect.
interface EditorMapProps {
    model: VenueModel;
    floorId: number | null;
    children?: (map: Leaflet.Map) => ReactNode;
    /** Đổi giá trị là bản đồ vừa khít lại tầng */
    fitKey?: string | number;
    className?: string;
    showPlan?: boolean;
    onMouseMove?: (latlng: Leaflet.LatLng) => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export function floorBounds(model: VenueModel, floorId: number | null): Leaflet.LatLngBounds | null {
    if (floorId == null) return null;
    const floor = model.floorsById.get(floorId);
    const pts = model.locations.filter(l => l.floorId === floorId).map(l => L.latLng(l.lat, l.lng));
    model.walkways.nodes.forEach(n => n.floorId === floorId && pts.push(L.latLng(n.lat, n.lng)));
    if (pts.length >= 3) return L.latLngBounds(pts).pad(0.08);
    if (floor?.projection) return L.latLngBounds(floor.projection.bounds.map(p => L.latLng(p.lat, p.lng)));
    const building = floor ? model.buildingsById.get(floor.buildingId) : undefined;
    if (building?.centerLat != null && building.centerLng != null) return L.latLng(building.centerLat, building.centerLng).toBounds(200);
    if (model.venue.centerLat != null && model.venue.centerLng != null) return L.latLng(model.venue.centerLat, model.venue.centerLng).toBounds(400);
    return null;
}

export default function EditorMap({ model, floorId, children, fitKey, className = "", showPlan = true, onMouseMove }: EditorMapProps) {
    const box = useRef<HTMLDivElement>(null);
    const [map, setMap] = useState<Leaflet.Map | null>(null);
    const planLayer = useRef<Leaflet.LayerGroup | null>(null);
    const moveRef = useRef(onMouseMove);
    useEffect(() => {
        moveRef.current = onMouseMove;
    }, [onMouseMove]);

    useEffect(() => {
        if (!box.current) return undefined;
        const m = L.map(box.current, { zoomControl: false, center: [model.venue.centerLat ?? 10.8, model.venue.centerLng ?? 106.66], zoom: 17, maxZoom: 23, zoomSnap: 0.25, rotateControl: false, doubleClickZoom: false });
        L.control.zoom({ position: "bottomright" }).addTo(m);
        L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
            maxZoom: 23, maxNativeZoom: 20, subdomains: "abcd", attribution: "&copy; OpenStreetMap &copy; CARTO"
        }).addTo(m);
        const rotatePane = m.getPane("rotatePane");
        m.createPane("planPane", rotatePane).style.zIndex = "350";
        m.getPane("planPane")!.style.pointerEvents = "none";
        planLayer.current = L.layerGroup().addTo(m);
        m.on("mousemove", e => moveRef.current?.(e.latlng));
        const observer = new ResizeObserver(() => m.invalidateSize({ pan: false }));
        observer.observe(box.current);
        setMap(m);
        return () => {
            observer.disconnect();
            m.stop();
            m.off();
            m.remove();
            setMap(null);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const floor = floorId != null ? model.floorsById.get(floorId) : undefined;
    const plan = floor?.plan;
    const projection = floor?.projection;
    useEffect(() => {
        const group = planLayer.current;
        if (!map || !group) return undefined;
        group.clearLayers();
        if (!showPlan || !plan || !projection) return undefined;
        let alive = true;
        const bounds = L.latLngBounds(projection.bounds.map(p => L.latLng(p.lat, p.lng)));
        group.addLayer(L.rectangle(bounds, { pane: "planPane", stroke: false, fillColor: "#FFFFFF", fillOpacity: 0.85, interactive: false }));
        void api.fetchPlanSvg(plan).then(text => {
            if (!alive) return;
            let svg: SVGSVGElement | null = null;
            if (text) svg = parsePlanSvg(text);
            else if (plan.imageUrl) svg = rasterAsSvg(plan.imageUrl, plan.width ?? 1, plan.height ?? 1);
            if (svg) group.addLayer(L.svgOverlay(buildPlanOverlay(svg, plan, projection), bounds, { pane: "planPane", interactive: false }));
        });
        return () => {
            alive = false;
        };
    }, [map, plan, projection, showPlan]);

    const fitBy = `${floorId}:${fitKey ?? ""}`;
    useEffect(() => {
        if (!map) return;
        const bounds = floorBounds(model, floorId);
        if (bounds) map.fitBounds(bounds, { animate: false });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map, fitBy]);

    return (
        <>
            <div ref={box} className={`cb-map ${className}`} />
            {map && children?.(map)}
        </>
    );
}
