import { useEffect, useRef } from "react";
import type * as Leaflet from "leaflet";
import { distance, type VenueModel, type WalkwayNodeDto } from "@indoor-map/core";
import L from "../../lib/leaflet";
import { mapColors } from "../layers";

// Mã QR định vị = id nút lối đi. Backend chưa có bảng mã QR nên danh sách mã và vòng đời tem
// (đã tạo, đã in, đã dán) lưu tạm localStorage["indoor-map.qr.<venueId>"] (xem KI-10).
export type QrStatus = "created" | "printed" | "pasted";
export interface QrState {
    selected: string[];
    posted: string[];
    printed: string[];
    /** Thời điểm (ms) đổi trạng thái, ghi trên trình duyệt này */
    times: Record<string, { created?: number; printed?: number; posted?: number }>;
}
// eslint-disable-next-line react-refresh/only-export-components
export const QR_STATUS_LABEL: Record<QrStatus, string> = { created: "Đã tạo", printed: "Đã in", pasted: "Đã dán" };

const key = (venueId: number) => `indoor-map.qr.${venueId}`;
// eslint-disable-next-line react-refresh/only-export-components
export function readQrState(venueId: number): QrState {
    try {
        const raw = JSON.parse(localStorage.getItem(key(venueId)) || "{}") as Partial<QrState>;
        return { selected: raw.selected ?? [], posted: raw.posted ?? [], printed: raw.printed ?? [], times: raw.times ?? {} };
    } catch {
        return { selected: [], posted: [], printed: [], times: {} };
    }
}
// eslint-disable-next-line react-refresh/only-export-components
export function writeQrState(venueId: number, state: QrState) {
    try {
        localStorage.setItem(key(venueId), JSON.stringify(state));
    } catch {
        // bỏ qua (chế độ riêng tư, hết chỗ)
    }
}
// eslint-disable-next-line react-refresh/only-export-components
export function qrStatus(state: QrState, id: string): QrStatus {
    return state.posted.includes(id) ? "pasted" : state.printed.includes(id) ? "printed" : "created";
}
/** Đặt trạng thái tem cho các mã (ghi thời điểm vào times); `at` lấy từ sự kiện, không gọi khi render */
// eslint-disable-next-line react-refresh/only-export-components
export function withQrStatus(state: QrState, ids: string[], status: QrStatus, at: number): QrState {
    const set = new Set(ids);
    const times = { ...state.times };
    ids.forEach(id => {
        times[id] = { ...times[id], ...(status === "printed" ? { printed: at } : status === "pasted" ? { posted: at } : {}) };
    });
    return {
        ...state,
        printed: status === "created" ? state.printed.filter(x => !set.has(x)) : [...new Set([...state.printed, ...ids])],
        posted: status === "pasted" ? [...new Set([...state.posted, ...ids])] : state.posted.filter(x => !set.has(x)),
        times
    };
}

/** Mô tả vị trí dán in trên thẻ: điểm quan tâm gần nhất, hoặc chân thang, hoặc giao lộ */
// eslint-disable-next-line react-refresh/only-export-components
export function qrPlaceText(model: VenueModel, n: WalkwayNodeDto): string {
    let best: { name: string; d: number } | null = null;
    for (const l of model.locations) if (l.floorId === n.floorId) {
        const d = distance(l, n);
        if (!best || d < best.d) best = { name: l.name, d };
    }
    return best && best.d < 25 ? `Gần ${best.name}` : n.connector ? `Chân ${n.connector.toLowerCase()}` : "Giao lộ hành lang";
}

/** Số ngắn hiện trên ô biển: phần sau dấu "-" cuối của mã */
const shortCode = (id: string) => id.split("-").pop()?.slice(0, 4) ?? id;

/** Nút lối đi trên bản đồ mã QR: chấm nhỏ = chưa là mã (bấm để tạo); ô biển = mã, kiểu ô theo trạng thái tem */
export function QrNodesLayer({ map, nodes, state, current, onPick }: {
    map: Leaflet.Map; nodes: WalkwayNodeDto[]; state: QrState; current: string | null; onPick(id: string): void;
}) {
    const group = useRef<Leaflet.LayerGroup | null>(null);
    const cb = useRef(onPick);
    useEffect(() => {
        cb.current = onPick;
    }, [onPick]);
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
        const c = mapColors();
        const selected = new Set(state.selected);
        for (const n of nodes) {
            if (selected.has(n.id)) {
                const cls = `ws-qr is-${qrStatus(state, n.id)}${n.id === current ? " is-sel" : ""}`;
                const m = L.marker([n.lat, n.lng], {
                    icon: L.divIcon({ className: "", html: `<span class="${cls}">${shortCode(n.id)}</span>`, iconSize: [24, 24], iconAnchor: [12, 12] }),
                    title: n.id, zIndexOffset: n.id === current ? 2000 : 1000
                });
                m.on("click", () => cb.current(n.id));
                g.addLayer(m);
            } else {
                const dot = L.circleMarker([n.lat, n.lng], { radius: n.connector ? 4.5 : 3, color: c.muted, weight: 1, fillColor: n.connector ? c.graphite : c.surface, fillOpacity: 1 });
                dot.bindTooltip(`${n.id}, bấm để tạo mã`);
                dot.on("click", () => cb.current(n.id));
                g.addLayer(dot);
            }
        }
    }, [nodes, state, current]);
    return null;
}
