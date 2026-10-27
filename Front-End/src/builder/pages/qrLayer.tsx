import { useEffect, useRef } from "react";
import type * as Leaflet from "leaflet";
import type { WalkwayNodeDto } from "@indoor-map/core";
import L from "../../lib/leaflet";

/** Nút lối đi để chọn làm mã QR: chấm nhỏ = có thể chọn; ô vuông xanh = đã chọn (đặc = đã dán) */
export function QrNodesLayer({ map, nodes, selected, posted, onToggle }: {
    map: Leaflet.Map; nodes: WalkwayNodeDto[]; selected: Set<string>; posted: Set<string>; onToggle(id: string): void;
}) {
    const group = useRef<Leaflet.LayerGroup | null>(null);
    const cb = useRef(onToggle);
    useEffect(() => {
        cb.current = onToggle;
    }, [onToggle]);
    useEffect(() => {
        const g = L.layerGroup().addTo(map);
        group.current = g;
        return () => {
            g.remove();
        };
    }, [map]);
    useEffect(() => {
        const g = group.current;
        if (!g) return;
        g.clearLayers();
        for (const n of nodes) {
            if (selected.has(n.id)) {
                const isPosted = posted.has(n.id);
                const m = L.marker([n.lat, n.lng], {
                    icon: L.divIcon({
                        className: "",
                        html: `<span style="display:flex;align-items:center;justify-content:center;width:22px;height:22px;border:2px solid #2D5BE3;border-radius:4px;background:${isPosted ? "#2D5BE3" : "#fff"};color:${isPosted ? "#fff" : "#2D5BE3"};font:700 9px 'JetBrains Mono',monospace">QR</span>`,
                        iconSize: [22, 22], iconAnchor: [11, 11]
                    }),
                    title: n.id, zIndexOffset: 1000
                });
                m.on("click", () => cb.current(n.id));
                g.addLayer(m);
            } else {
                const dot = L.circleMarker([n.lat, n.lng], { radius: n.connector ? 4.5 : 3, color: "#98A2B3", weight: 1, fillColor: n.connector ? "#2D5BE3" : "#fff", fillOpacity: 1 });
                dot.bindTooltip(n.id);
                dot.on("click", () => cb.current(n.id));
                g.addLayer(dot);
            }
        }
    }, [nodes, selected, posted]);
    return null;
}
