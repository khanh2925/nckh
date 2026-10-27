import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type * as Leaflet from "leaflet";
import { distance, formatMeters, planRoute, searchPlaces, type Place, type PlannedRoute } from "@indoor-map/core";
import L from "../../lib/leaflet";
import { Button, Card, Check, Status, Table } from "../../console/ui";
import EditorMap from "../EditorMap";
import { useWorkspace } from "../Workspace";

// Thử chỉ đường trên bản nháp (chưa cần xuất bản) + chạy thử nhiều cặp ngẫu nhiên để tìm chỗ lối đi bị đứt.
function PlacePicker({ label, value, onChange }: { label: string; value: Place | null; onChange(p: Place): void }) {
    const { model } = useWorkspace();
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const hits = useMemo(() => (query ? searchPlaces(model, query, { limit: 8 }) : []), [model, query]);
    return (
        <div className="cb-field" style={{ position: "relative" }}>
            <label htmlFor={`pick-${label}`}>{label}</label>
            <input id={`pick-${label}`} className="cb-input" value={open ? query : value ? `${value.name} · ${model.floorsById.get(value.floorId)?.buildingCode} ${model.floorsById.get(value.floorId)?.name.split(" · ")[0]}` : ""}
                placeholder="Gõ tên địa điểm…" onFocus={() => { setOpen(true); setQuery(""); }} onBlur={() => window.setTimeout(() => setOpen(false), 150)} onChange={e => setQuery(e.target.value)} />
            {open && hits.length > 0 && (
                <ul className="cb-dropdown" role="listbox">
                    {hits.map(({ place }) => (
                        <li key={place.id}><button type="button" role="option" aria-selected={false} onMouseDown={() => { onChange(place); setOpen(false); }}>
                            <b>{place.name}</b><small>{model.floorsById.get(place.floorId)?.buildingCode} · {model.floorsById.get(place.floorId)?.name}</small>
                        </button></li>
                    ))}
                </ul>
            )}
        </div>
    );
}

interface PairResult {
    from: Place;
    to: Place;
    ok: boolean;
    meters?: number;
    detour?: number;
    error?: string;
}

export default function TestPage() {
    const { venueId, model } = useWorkspace();
    const [from, setFrom] = useState<Place | null>(null);
    const [to, setTo] = useState<Place | null>(null);
    const [avoidStairs, setAvoidStairs] = useState(false);
    const [leg, setLeg] = useState(0);
    const [pairs, setPairs] = useState<PairResult[] | null>(null);

    const result = useMemo(() => (from && to ? planRoute(model, from, to, { avoidStairs }) : null), [model, from, to, avoidStairs]);
    const route: PlannedRoute | null = result && !("error" in result) ? result : null;
    const shownLeg = route?.legs[Math.min(leg, route.legs.length - 1)];

    const runPairs = () => {
        const list: PairResult[] = [];
        const places = model.locations;
        for (let i = 0; i < 50 && places.length > 1; i++) {
            const a = places[Math.floor(Math.random() * places.length)]!;
            const sameBuilding = places.filter(p => p.id !== a.id && model.floorsById.get(p.floorId)?.buildingId === model.floorsById.get(a.floorId)?.buildingId);
            const b = sameBuilding[Math.floor(Math.random() * sameBuilding.length)];
            if (!b) continue;
            const r = planRoute(model, a, b);
            if ("error" in r) list.push({ from: a, to: b, ok: false, error: r.error });
            else {
                const straight = distance(a, b);
                list.push({ from: a, to: b, ok: true, meters: r.distance, detour: straight > 15 ? r.distance / straight : 1 });
            }
        }
        setPairs(list);
    };

    const failed = pairs?.filter(p => !p.ok) ?? [];
    const detours = pairs?.filter(p => p.ok && (p.detour ?? 1) > 1.8) ?? [];

    return (
        <div className="cb-work">
            <aside className="cb-side" style={{ flexBasis: 340, padding: 16, gap: 14, overflowY: "auto", maxHeight: "calc(100dvh - 56px)" }}>
                <h2 className="cb-h3">Thử chỉ đường</h2>
                <PlacePicker label="Từ" value={from} onChange={p => { setFrom(p); setLeg(0); }} />
                <PlacePicker label="Đến" value={to} onChange={p => { setTo(p); setLeg(0); }} />
                <Check label="Tránh thang cuốn / thang bộ (xe lăn)" checked={avoidStairs} onChange={setAvoidStairs} />
                <div className="cb-actions"><Button small onClick={() => { setFrom(to); setTo(from); }} disabled={!from || !to}>Đảo chiều</Button></div>
                {result && "error" in result && <div className="cb-alert is-err"><i className="bi bi-x-circle" aria-hidden="true" /><span>{result.error}</span></div>}
                {route && (
                    <>
                        <div className="cb-grid-3">
                            <div className="cb-card cb-kpi"><div className="cb-muted">Dài</div><div className="cb-kpi-value" style={{ fontSize: 20 }}>{route.distance} m</div></div>
                            <div className="cb-card cb-kpi"><div className="cb-muted">Thời gian</div><div className="cb-kpi-value" style={{ fontSize: 20 }}>{Math.max(1, Math.round(route.seconds / 60))}′</div></div>
                            <div className="cb-card cb-kpi"><div className="cb-muted">Đổi tầng</div><div className="cb-kpi-value" style={{ fontSize: 20 }}>{route.legs.length - 1}</div></div>
                        </div>
                        <span className="cb-label">Chỉ dẫn sinh ra (như khách thấy)</span>
                        <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                            {route.steps.map((s, i) => (
                                <li key={i} className="cb-card" style={{ display: "flex", gap: 10, padding: "8px 10px", fontSize: 13 }}>
                                    <span className="cb-mono" style={{ color: "#6B7280", minWidth: 42 }}>{s.kind.startsWith("floor") ? (s.kind === "floor-up" ? "↑ tầng" : "↓ tầng") : s.distance ? formatMeters(s.distance) : ""}</span>
                                    <span><b style={{ fontWeight: 500 }}>{s.title}</b><br /><small className="cb-muted">{s.detail}</small></span>
                                </li>
                            ))}
                        </ol>
                        {route.steps.some(s => (s.kind === "left" || s.kind === "right") && !s.title.includes(" tại ")) && (
                            <div className="cb-alert is-warn"><i className="bi bi-exclamation-triangle" aria-hidden="true" /><span>Có lượt rẽ không có mốc nào trong 14 m — khách chỉ thấy “Rẽ trái”. Thêm điểm quan tâm dễ thấy gần đó để chỉ dẫn rõ hơn.</span></div>
                        )}
                    </>
                )}
                {!from && <p className="cb-muted">Chọn 2 địa điểm để xem tuyến trên bản nháp (dữ liệu chưa cần xuất bản).</p>}
            </aside>
            <section className="cb-canvas">
                <div style={{ flex: 1, minHeight: 420, position: "relative", display: "flex" }}>
                    <EditorMap model={model} floorId={shownLeg?.floorId ?? from?.floorId ?? model.defaultFloor?.id ?? null} fitKey={`${from?.id}-${to?.id}-${leg}`}>
                        {map => <RouteLayer map={map} route={route} legIndex={Math.min(leg, (route?.legs.length ?? 1) - 1)} from={from} to={to} />}
                    </EditorMap>
                    {route && route.legs.length > 1 && (
                        <div className="cb-canvas-tools">
                            {route.legs.map((l, i) => (
                                <button key={i} type="button" aria-pressed={i === leg} onClick={() => setLeg(i)}>Chặng {i + 1} · {model.floorsById.get(l.floorId)?.name.split(" · ")[0]}</button>
                            ))}
                        </div>
                    )}
                </div>
                <div style={{ borderTop: "1px solid #E4E7EC", background: "#fff", padding: "14px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                        <h2 className="cb-h3">Kiểm tra nhiều cặp ngẫu nhiên (cùng toà nhà)</h2>
                        <div className="cb-actions"><Button variant="primary" onClick={runPairs}>Chạy 50 cặp ngẫu nhiên</Button><Link to={`/builder/v/${venueId}/walkways`}>Sửa lối đi →</Link></div>
                    </div>
                    {pairs && (
                        <>
                            <div className="cb-actions" style={{ gap: 18 }}>
                                <Status kind="ok">{pairs.length - failed.length} cặp có đường</Status>
                                {failed.length ? <Status kind="err">{failed.length} cặp không có đường</Status> : null}
                                {detours.length ? <Status kind="warn">{detours.length} cặp đi vòng &gt; 1,8× đường chim bay</Status> : null}
                            </div>
                            {(failed.length > 0 || detours.length > 0) && (
                                <Card pad={false}>
                                    <Table head={["Từ", "Đến", "Kết quả", ""]} minWidth={560}>
                                        {[...failed, ...detours].slice(0, 12).map((p, i) => (
                                            <tr key={i} style={!p.ok ? { background: "#FFF5F4" } : undefined}>
                                                <td>{p.from.name}</td><td>{p.to.name}</td>
                                                <td>{p.ok ? <Status kind="warn">đi vòng {p.detour?.toFixed(1)}× · {p.meters} m</Status> : <Status kind="err">{p.error}</Status>}</td>
                                                <td style={{ textAlign: "right" }}><button type="button" className="cb-btn cb-btn-ghost is-small" onClick={() => { setFrom(p.from); setTo(p.to); setLeg(0); }}>Xem</button></td>
                                            </tr>
                                        ))}
                                    </Table>
                                </Card>
                            )}
                        </>
                    )}
                </div>
            </section>
        </div>
    );
}

function RouteLayer({ map, route, legIndex, from, to }: { map: Leaflet.Map; route: PlannedRoute | null; legIndex: number; from: Place | null; to: Place | null }) {
    const group = useRef<Leaflet.LayerGroup | null>(null);
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
        const leg = route?.legs[legIndex];
        if (leg) {
            const pts = leg.points.map(p => L.latLng(p.lat, p.lng));
            g.addLayer(L.polyline(pts, { color: "#fff", weight: 9, interactive: false }));
            g.addLayer(L.polyline(pts, { color: "#2D5BE3", weight: 5, interactive: false }));
            map.fitBounds(L.latLngBounds(pts).pad(0.3), { animate: false, maxZoom: 21 });
        }
        for (const [p, label, color] of [[from, "A", "#1E7F4F"], [to, "B", "#1E2235"]] as const) {
            if (p && (!leg || p.floorId === leg.floorId)) {
                g.addLayer(L.marker([p.lat, p.lng], { icon: L.divIcon({ className: "", html: `<span class="cb-anchor" style="background:${color};color:${color}"><span>${label}</span></span>`, iconSize: [24, 24], iconAnchor: [12, 12] }), interactive: false }));
            }
        }
    }, [map, route, legIndex, from, to]);
    return null;
}
