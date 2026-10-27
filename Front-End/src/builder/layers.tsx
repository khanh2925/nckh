import { useEffect, useRef } from "react";
import type * as Leaflet from "leaflet";
import { plateText, type FloorProjection, type LatLng, type LocationTypeDto, type WalkwayNetworkDto, type ZoneDto } from "@indoor-map/core";
import L from "../lib/leaflet";

// Các lớp vẽ trên EditorMap. Mỗi lớp là một component không hiển thị gì ngoài Leaflet; nhận "map" từ EditorMap.

function useLayer(map: Leaflet.Map, zIndex?: number) {
    const ref = useRef<Leaflet.LayerGroup | null>(null);
    useEffect(() => {
        const group = L.layerGroup().addTo(map);
        ref.current = group;
        return () => {
            group.remove();
            ref.current = null;
        };
    }, [map]);
    void zIndex;
    return ref;
}

/** Gọi handler khi bấm vào chỗ trống trên bản đồ */
export function ClickLayer({ map, onClick, cursor }: { map: Leaflet.Map; onClick: ((latlng: Leaflet.LatLng) => void) | null; cursor?: boolean }) {
    const handler = useRef(onClick);
    useEffect(() => {
        handler.current = onClick;
    }, [onClick]);
    useEffect(() => {
        const fn = (e: Leaflet.LeafletMouseEvent) => handler.current?.(e.latlng);
        map.on("click", fn);
        return () => {
            map.off("click", fn);
        };
    }, [map]);
    useEffect(() => {
        map.getContainer().classList.toggle("is-picking", Boolean(cursor));
    }, [map, cursor]);
    return null;
}

export interface EditablePlace extends LatLng {
    id: number;
    name: string;
    type?: string;
    floorId: number;
}

export function PlacesLayer({ map, places, typeOf, selectedId, onSelect, onMove, draggable }: {
    map: Leaflet.Map;
    places: EditablePlace[];
    typeOf: (code?: string) => LocationTypeDto;
    selectedId: number | null;
    onSelect?: (id: number) => void;
    onMove?: (id: number, latlng: Leaflet.LatLng) => void;
    draggable?: boolean;
}) {
    const group = useLayer(map);
    const cb = useRef({ onSelect, onMove });
    useEffect(() => {
        cb.current = { onSelect, onMove };
    }, [onSelect, onMove]);
    useEffect(() => {
        const g = group.current;
        if (!g) return;
        g.clearLayers();
        for (const p of places) {
            const type = typeOf(p.type);
            const selected = p.id === selectedId;
            const plate = plateText({ type: p.type, name: p.name });
            const el = document.createElement("span");
            el.className = `cb-pin${selected ? " is-selected" : ""}`;
            el.style.background = type.color || "#5f6368";
            if (plate && p.type === "gate") {
                el.style.borderRadius = "4px";
                el.style.background = "#141826";
                el.style.color = "#F0B429";
                el.textContent = plate;
            } else {
                const i = document.createElement("i");
                i.className = `bi ${type.icon || "bi-geo-alt"}`;
                el.appendChild(i);
            }
            const size = selected ? 30 : 24;
            const marker = L.marker([p.lat, p.lng], {
                icon: L.divIcon({ className: "", html: el, iconSize: [size, size], iconAnchor: [size / 2, size / 2] }),
                title: p.name, draggable: Boolean(draggable && selected), zIndexOffset: selected ? 1000 : 0, bubblingMouseEvents: false
            });
            marker.on("click", () => cb.current.onSelect?.(p.id));
            marker.on("dragend", () => cb.current.onMove?.(p.id, marker.getLatLng()));
            g.addLayer(marker);
        }
    }, [group, places, typeOf, selectedId, draggable]);
    return null;
}

export function ZonesLayer({ map, zones, projection, selectedId, onSelect }: {
    map: Leaflet.Map; zones: ZoneDto[]; projection: FloorProjection | null; selectedId: number | null; onSelect?: (id: number) => void;
}) {
    const group = useLayer(map);
    const cb = useRef(onSelect);
    useEffect(() => {
        cb.current = onSelect;
    }, [onSelect]);
    useEffect(() => {
        const g = group.current;
        if (!g) return;
        g.clearLayers();
        if (!projection) return;
        for (const z of zones) {
            const latlngs = z.polygon.map(([x, y]) => {
                const p = projection.toLatLng(x, y);
                return L.latLng(p.lat, p.lng);
            });
            const selected = z.id === selectedId;
            const poly = L.polygon(latlngs, {
                color: z.color || "#2D5BE3", weight: selected ? 3 : 1.5, dashArray: selected ? undefined : "6 5", fillOpacity: selected ? 0.22 : 0.1, bubblingMouseEvents: false
            });
            poly.bindTooltip(z.name, { permanent: true, direction: "center", className: "cb-zone-label" });
            poly.on("click", () => cb.current?.(z.id));
            g.addLayer(poly);
        }
    }, [group, zones, projection, selectedId]);
    return null;
}

export function DraftPolygonLayer({ map, points, color = "#2D5BE3", onFirstClick }: { map: Leaflet.Map; points: LatLng[]; color?: string; onFirstClick?: () => void }) {
    const group = useLayer(map);
    const cb = useRef(onFirstClick);
    useEffect(() => {
        cb.current = onFirstClick;
    }, [onFirstClick]);
    useEffect(() => {
        const g = group.current;
        if (!g) return;
        g.clearLayers();
        if (points.length >= 2) g.addLayer(L.polygon(points.map(p => L.latLng(p.lat, p.lng)), { color, weight: 2, dashArray: "6 5", fillOpacity: 0.12, interactive: false }));
        points.forEach((p, i) => {
            const m = L.marker([p.lat, p.lng], { icon: L.divIcon({ className: "", html: '<span class="cb-vertex"></span>', iconSize: i === 0 ? [16, 16] : [11, 11], iconAnchor: i === 0 ? [8, 8] : [5.5, 5.5] }), bubblingMouseEvents: false });
            if (i === 0) m.on("click", () => cb.current?.());
            g.addLayer(m);
        });
    }, [group, points, color]);
    return null;
}

/** Lối đi chỉ để xem (mờ), dùng ở trang Điểm & vùng */
export function WalkwayPreviewLayer({ map, network, floorId }: { map: Leaflet.Map; network: WalkwayNetworkDto; floorId: number }) {
    const group = useLayer(map);
    useEffect(() => {
        const g = group.current;
        if (!g) return;
        g.clearLayers();
        const byId = new Map(network.nodes.map(n => [n.id, n]));
        for (const e of network.edges) {
            const a = byId.get(e.from);
            const b = byId.get(e.to);
            if (!a || !b || a.floorId !== floorId || b.floorId !== floorId) continue;
            g.addLayer(L.polyline([[a.lat, a.lng], [b.lat, b.lng]], { color: "#2D5BE3", weight: 2, opacity: 0.35, interactive: false }));
        }
    }, [group, network, floorId]);
    return null;
}
