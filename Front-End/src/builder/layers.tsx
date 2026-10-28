import { useEffect, useRef } from "react";
import type * as Leaflet from "leaflet";
import { plateText, type FloorProjection, type LatLng, type LocationTypeDto, type WalkwayNetworkDto, type ZoneDto } from "@indoor-map/core";
import L from "../lib/leaflet";
import { LUCIDE, type LucideName } from "../design/lucide";
import "./pages/workspace.css";

// Các lớp vẽ trên EditorMap. Mỗi lớp là một component không hiển thị gì ngoài Leaflet; nhận "map" từ EditorMap.

/** Leaflet cần chuỗi màu thật: đọc token từ design/tokens.css (giá trị dự phòng = token gốc, đặt ở MỘT chỗ này) */
const TOKEN_FALLBACK = {
    graphite: "#23272D", signal: "#FFC629", surface: "#FFFFFF", danger: "#B42318", warn: "#8A5A12", ok: "#12704F", muted: "#5B6169"
};
export type MapColors = typeof TOKEN_FALLBACK;
// eslint-disable-next-line react-refresh/only-export-components
export function mapColors(): MapColors {
    const css = getComputedStyle(document.documentElement);
    const read = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
    return {
        graphite: read("--graphite", TOKEN_FALLBACK.graphite), signal: read("--signal", TOKEN_FALLBACK.signal), surface: read("--surface", TOKEN_FALLBACK.surface),
        danger: read("--danger", TOKEN_FALLBACK.danger), warn: read("--warn", TOKEN_FALLBACK.warn), ok: read("--ok", TOKEN_FALLBACK.ok), muted: read("--muted", TOKEN_FALLBACK.muted)
    };
}

/** Icon Lucide dạng chuỗi SVG (cho L.divIcon) */
// eslint-disable-next-line react-refresh/only-export-components
export function lucideSvg(name: LucideName, size = 12, stroke = 2): string {
    const body = LUCIDE[name].map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(" ")}/>`).join("");
    return `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

const escapeHtml = (text: string) => text.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Marker ô biển: icon/chữ + nhãn tên bên phải (nhãn hiện khi phóng gần hoặc đang chọn) */
// eslint-disable-next-line react-refresh/only-export-components
export function signIcon({ inner, label, color, ink, plate, light, selected, tag, showLabel, size = 22 }: {
    inner: string; label?: string; color?: string; ink?: string; plate?: boolean; light?: boolean; selected?: boolean; tag?: boolean; showLabel?: boolean; size?: number;
}): Leaflet.DivIcon {
    const css = [color && !plate ? `background:${escapeHtml(color)}` : "", ink ? `color:${escapeHtml(ink)}` : ""].filter(Boolean).join(";");
    const style = css ? ` style="${css}"` : "";
    const html = `<span class="ws-mk${selected ? " is-selected" : ""}${tag ? " is-tag" : ""}${showLabel ? " is-lbl" : ""}"><span class="ws-pin${plate ? " is-plate" : ""}${light ? " is-light" : ""}"${style}>${inner}</span>`
        + (label ? `<span class="ws-lbl">${escapeHtml(label)}</span>` : "") + "</span>";
    return L.divIcon({ className: "", html, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
}

function useLayer(map: Leaflet.Map) {
    const ref = useRef<Leaflet.LayerGroup | null>(null);
    useEffect(() => {
        const group = L.layerGroup().addTo(map);
        ref.current = group;
        return () => {
            group.remove();
            ref.current = null;
        };
    }, [map]);
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

/** Nhận một mục kéo từ panel (dataTransfer "text/plain") thả xuống bản đồ */
export function DropLayer({ map, onDrop }: { map: Leaflet.Map; onDrop: (value: string, latlng: Leaflet.LatLng) => void }) {
    const handler = useRef(onDrop);
    useEffect(() => {
        handler.current = onDrop;
    }, [onDrop]);
    useEffect(() => {
        const box = map.getContainer();
        const over = (e: DragEvent) => {
            if (!e.dataTransfer?.types.includes("text/plain")) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
        };
        const drop = (e: DragEvent) => {
            const value = e.dataTransfer?.getData("text/plain");
            if (!value) return;
            e.preventDefault();
            handler.current(value, map.mouseEventToLatLng(e as unknown as MouseEvent));
        };
        box.addEventListener("dragover", over);
        box.addEventListener("drop", drop);
        return () => {
            box.removeEventListener("dragover", over);
            box.removeEventListener("drop", drop);
        };
    }, [map]);
    return null;
}

export interface EditablePlace extends LatLng {
    id: number;
    name: string;
    type?: string;
    floorId: number;
}

// eslint-disable-next-line react-refresh/only-export-components
export function placeIcon(p: Pick<EditablePlace, "name" | "type">, type: LocationTypeDto, selected = false) {
    const plate = p.type === "gate" ? plateText({ type: p.type, name: p.name }) : null;
    const inner = plate ? escapeHtml(plate) : `<i class="bi ${escapeHtml(type.icon || "bi-geo-alt")}" aria-hidden="true"></i>`;
    return signIcon({ inner, label: p.name, color: type.color || mapColors().muted, plate: Boolean(plate), selected });
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
    const clickable = Boolean(onSelect);
    const cb = useRef({ onSelect, onMove });
    useEffect(() => {
        cb.current = { onSelect, onMove };
    }, [onSelect, onMove]);
    useEffect(() => {
        const g = group.current;
        if (!g) return;
        g.clearLayers();
        for (const p of places) {
            const selected = p.id === selectedId;
            const marker = L.marker([p.lat, p.lng], {
                icon: placeIcon(p, typeOf(p.type), selected), title: p.name, draggable: Boolean(draggable && selected),
                zIndexOffset: selected ? 1000 : 0, bubblingMouseEvents: false, interactive: clickable || selected
            });
            marker.on("click", () => cb.current.onSelect?.(p.id));
            marker.on("dragend", () => cb.current.onMove?.(p.id, marker.getLatLng()));
            g.addLayer(marker);
        }
    }, [group, places, typeOf, selectedId, draggable, clickable]);
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
        const c = mapColors();
        for (const z of zones) {
            const latlngs = z.polygon.map(([x, y]) => {
                const p = projection.toLatLng(x, y);
                return L.latLng(p.lat, p.lng);
            });
            const selected = z.id === selectedId;
            // Viền than chì nét đứt như bản thiết kế; màu vùng (dữ liệu) chỉ làm nền nhạt
            const poly = L.polygon(latlngs, {
                color: c.graphite, weight: selected ? 2.5 : 1.5, dashArray: selected ? undefined : "5 4",
                fillColor: z.color || c.graphite, fillOpacity: selected ? 0.18 : 0.08, bubblingMouseEvents: false
            });
            poly.bindTooltip(z.name, { permanent: true, direction: "center", className: "cb-zone-label" });
            poly.on("click", () => cb.current?.(z.id));
            g.addLayer(poly);
        }
    }, [group, zones, projection, selectedId]);
    return null;
}

export function DraftPolygonLayer({ map, points, onFirstClick }: { map: Leaflet.Map; points: LatLng[]; onFirstClick?: () => void }) {
    const group = useLayer(map);
    const cb = useRef(onFirstClick);
    useEffect(() => {
        cb.current = onFirstClick;
    }, [onFirstClick]);
    useEffect(() => {
        const g = group.current;
        if (!g) return;
        g.clearLayers();
        const c = mapColors();
        if (points.length >= 2) g.addLayer(L.polygon(points.map(p => L.latLng(p.lat, p.lng)), { color: c.graphite, weight: 2, dashArray: "5 4", fillColor: c.graphite, fillOpacity: 0.08, interactive: false }));
        points.forEach((p, i) => {
            const m = L.marker([p.lat, p.lng], { icon: L.divIcon({ className: "", html: '<span class="cb-vertex"></span>', iconSize: i === 0 ? [16, 16] : [11, 11], iconAnchor: i === 0 ? [8, 8] : [5.5, 5.5] }), bubblingMouseEvents: false });
            if (i === 0) m.on("click", () => cb.current?.());
            g.addLayer(m);
        });
    }, [group, points]);
    return null;
}

/** Lối đi chỉ để xem (mờ), dùng ở trang Điểm và vùng */
export function WalkwayPreviewLayer({ map, network, floorId }: { map: Leaflet.Map; network: WalkwayNetworkDto; floorId: number }) {
    const group = useLayer(map);
    useEffect(() => {
        const g = group.current;
        if (!g) return;
        g.clearLayers();
        const c = mapColors();
        const byId = new Map(network.nodes.map(n => [n.id, n]));
        for (const e of network.edges) {
            const a = byId.get(e.from);
            const b = byId.get(e.to);
            if (!a || !b || a.floorId !== floorId || b.floorId !== floorId) continue;
            g.addLayer(L.polyline([[a.lat, a.lng], [b.lat, b.lng]], { color: c.graphite, weight: 2, opacity: 0.35, interactive: false }));
        }
    }, [group, network, floorId]);
    return null;
}
