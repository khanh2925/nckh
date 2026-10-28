import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type * as Leaflet from "leaflet";
import { distance, formatMeters, planRoute, searchPlaces, type Place, type PlannedRoute, type StepKind } from "@indoor-map/core";
import L from "../../lib/leaflet";
import { HeaderActions } from "../../console/Shell";
import { Button } from "../../console/ui";
import Lc, { type LucideName } from "../../design/Lc";
import EditorMap from "../EditorMap";
import { floorLabel, GuestLink } from "../FloorList";
import { mapColors, signIcon } from "../layers";
import { useWorkspace } from "../Workspace";
import "./workspace.css";

const STEP_ICON: Record<StepKind, LucideName> = {
    depart: "navigation", straight: "arrow-up", left: "corner-up-left", right: "corner-up-right", "slight-left": "arrow-up-left", "slight-right": "arrow-up-right",
    uturn: "corner-up-left", "floor-up": "chevrons-up", "floor-down": "arrow-up-down", arrive: "flag"
};
const DETOUR = 1.8;

function PlacePicker({ label, value, onChange }: { label: string; value: Place | null; onChange(p: Place): void }) {
    const { model } = useWorkspace();
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const hits = useMemo(() => (query ? searchPlaces(model, query, { limit: 8 }) : []), [model, query]);
    const id = `pick-${label}`;
    return (
        <div className="k-field ws-picker">
            <label htmlFor={id}>{label}</label>
            <input id={id} className="k-input" autoComplete="off" role="combobox" aria-expanded={open && hits.length > 0}
                value={open ? query : value ? `${value.name}, ${floorLabel(model, model.floorsById.get(value.floorId))}` : ""}
                placeholder="Gõ tên địa điểm" onFocus={() => { setOpen(true); setQuery(""); }} onBlur={() => window.setTimeout(() => setOpen(false), 150)} onChange={e => setQuery(e.target.value)} />
            {open && hits.length > 0 && (
                <ul className="cb-dropdown" role="listbox">
                    {hits.map(({ place }) => (
                        <li key={place.id}><button type="button" role="option" aria-selected={false} onMouseDown={() => { onChange(place); setOpen(false); }}>
                            <b>{place.name}</b><small>{floorLabel(model, model.floorsById.get(place.floorId))}</small>
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
    straight: number;
    detour?: number;
    error?: string;
}
type PairFilter = "bad" | "none" | "detour" | "ok" | "all";

// Thử chỉ đường trên bản nháp (chưa cần xuất bản): thử một tuyến, hoặc chạy 50 cặp ngẫu nhiên để tìm chỗ lối đi bị đứt, đi vòng.
export default function TestPage() {
    const { venueId, data, model } = useWorkspace();
    const [tab, setTab] = useState<"single" | "batch">("single");
    const [from, setFrom] = useState<Place | null>(null);
    const [to, setTo] = useState<Place | null>(null);
    const [avoidStairs, setAvoidStairs] = useState(false);
    const [leg, setLeg] = useState(0);
    const [pairs, setPairs] = useState<PairResult[] | null>(null);
    const [ranAt, setRanAt] = useState<Date | null>(null);
    const [filter, setFilter] = useState<PairFilter>("bad");
    const [pairIndex, setPairIndex] = useState(0);

    const result = useMemo(() => (from && to ? planRoute(model, from, to, { avoidStairs }) : null), [model, from, to, avoidStairs]);
    const route: PlannedRoute | null = result && !("error" in result) ? result : null;
    const legIndex = Math.min(leg, (route?.legs.length ?? 1) - 1);
    const shownLeg = route?.legs[legIndex];

    const runPairs = () => {
        const list: PairResult[] = [];
        const places = model.locations;
        for (let i = 0; i < 50 && places.length > 1; i++) {
            const a = places[Math.floor(Math.random() * places.length)]!;
            const sameBuilding = places.filter(p => p.id !== a.id && model.floorsById.get(p.floorId)?.buildingId === model.floorsById.get(a.floorId)?.buildingId);
            const b = sameBuilding[Math.floor(Math.random() * sameBuilding.length)];
            if (!b) continue;
            const r = planRoute(model, a, b);
            const straight = distance(a, b);
            if ("error" in r) list.push({ from: a, to: b, ok: false, error: r.error, straight });
            else list.push({ from: a, to: b, ok: true, meters: r.distance, straight, detour: straight > 15 ? r.distance / straight : 1 });
        }
        setPairs(list);
        setRanAt(new Date());
        setPairIndex(0);
        const bad = list.some(p => !p.ok || (p.detour ?? 1) > DETOUR);
        setFilter(bad ? "bad" : "all");
    };

    const { failed, detours, passed, listed, pair, pairRoute } = useMemo(() => {
        const failed = pairs?.filter(p => !p.ok) ?? [];
        const detours = pairs?.filter(p => p.ok && (p.detour ?? 1) > DETOUR) ?? [];
        const passed = pairs?.filter(p => p.ok && (p.detour ?? 1) <= DETOUR) ?? [];
        const listed = filter === "bad" ? [...failed, ...detours] : filter === "none" ? failed : filter === "detour" ? detours : filter === "ok" ? passed : pairs ?? [];
        const pair = listed[Math.min(pairIndex, listed.length - 1)];
        const r = pair?.ok ? planRoute(model, pair.from, pair.to) : null;
        return { failed, detours, passed, listed, pair, pairRoute: r && !("error" in r) ? r : null };
    }, [model, pairs, filter, pairIndex]);

    const chip = (value: PairFilter, label: string, n: number) => (
        <button type="button" className="k-chip" aria-pressed={filter === value} onClick={() => { setFilter(value); setPairIndex(0); }}>{label} {n}</button>
    );
    const pairTitle = (p: PairResult) => <><span className="ws-ellipsis">{p.from.name}</span><Lc name="arrow-right" size={14} style={{ flexShrink: 0 }} /><span className="ws-ellipsis">{p.to.name}</span></>;
    const turnWarning = route?.steps.some(s => (s.kind === "left" || s.kind === "right") && !s.title.includes(" tại "));

    return (
        <div className="k-page ws-page-full" style={{ minHeight: 640 }}>
            <HeaderActions><GuestLink venue={data.venue} /></HeaderActions>
            <div className="k-title">
                <h1 className="k24">Thử chỉ đường</h1>
                <div className="k-acts">
                    {tab === "batch" && <Button variant="primary" disabled={model.locations.length < 2} onClick={runPairs}>{pairs ? "Chạy lại 50 cặp" : "Chạy 50 cặp"}</Button>}
                </div>
            </div>
            <div role="tablist" aria-label="Cách thử" className="k-tabs">
                <button type="button" role="tab" aria-selected={tab === "single"} className="k-tab" onClick={() => setTab("single")}>Thử một tuyến</button>
                <button type="button" role="tab" aria-selected={tab === "batch"} className="k-tab" onClick={() => setTab("batch")}>Kiểm tra hàng loạt</button>
            </div>

            {tab === "single" ? (
                <div className="ws-row ws-fill">
                    <section aria-label="Tuyến trên mặt bằng" className="k-card ws-card0 ws-grow" style={{ display: "flex" }}>
                        <div className="ws-cardhead is-24" style={{ borderBottom: 0 }}>
                            {route && route.legs.length > 1 ? (
                                <div role="group" aria-label="Chặng" className="k-line" style={{ flexWrap: "wrap" }}>
                                    {route.legs.map((l, i) => <button key={i} type="button" className="k-chip" aria-pressed={i === legIndex} onClick={() => setLeg(i)}>Chặng {i + 1}, {floorLabel(model, model.floorsById.get(l.floorId), " ")}</button>)}
                                </div>
                            ) : <span className="k14 k-m">{route ? floorLabel(model, model.floorsById.get(route.legs[0]!.floorId)) : "Chọn điểm đi và điểm đến"}</span>}
                            <span className="k12 k-m ws-right">{data.walkways.nodes.length.toLocaleString("vi-VN")} nút lối đi</span>
                        </div>
                        <div className="ws-mapwrap">
                            <EditorMap model={model} floorId={shownLeg?.floorId ?? from?.floorId ?? model.defaultFloor?.id ?? null} fitKey={`${from?.id}-${to?.id}-${legIndex}`}>
                                {map => <RouteLayer map={map} route={route} legIndex={legIndex} from={from} to={to} />}
                            </EditorMap>
                        </div>
                    </section>
                    <aside aria-label="Tuyến thử" className="k-card ws-card0" style={{ width: 360, flexShrink: 0, minHeight: 0, display: "flex" }}>
                        <div className="k-stack" style={{ padding: 24, borderBottom: "1px solid var(--rule)", flexShrink: 0 }}>
                            <PlacePicker label="Từ" value={from} onChange={p => { setFrom(p); setLeg(0); }} />
                            <PlacePicker label="Đến" value={to} onChange={p => { setTo(p); setLeg(0); }} />
                            <label className="k-line k14"><input type="checkbox" className="k-check" checked={avoidStairs} onChange={e => setAvoidStairs(e.target.checked)} />Tránh thang cuốn, thang bộ (xe lăn)</label>
                            <Button icon="arrow-down-up" disabled={!from || !to} onClick={() => { setFrom(to); setTo(from); setLeg(0); }}>Đảo chiều</Button>
                        </div>
                        <div className="ws-grow" style={{ minHeight: 0, overflowY: "auto", padding: "16px 24px" }}>
                            {result && "error" in result && <div className="k-note" role="alert"><Lc name="circle-alert" size={16} color="var(--danger)" /><div>{result.error}</div></div>}
                            {route ? (
                                <>
                                    <div className="k-grid3" style={{ paddingBottom: 16 }}>
                                        <Num k="Dài" v={`${route.distance} m`} />
                                        <Num k="Ước tính" v={`${Math.max(1, Math.round(route.seconds / 60))} phút`} />
                                        <Num k="Đổi tầng" v={String(route.legs.length - 1)} />
                                    </div>
                                    <ol className="ws-turns">
                                        {route.steps.map((s, i) => (
                                            <li key={i} className="k-row">
                                                <Lc name={STEP_ICON[s.kind]} size={16} />
                                                <div className="ws-col"><span className="k14">{s.title}</span><span className="k12 k-m">{s.kind.startsWith("floor") ? s.detail : s.distance ? formatMeters(s.distance) : s.detail}</span></div>
                                            </li>
                                        ))}
                                    </ol>
                                    {turnWarning && (
                                        <div className="k-note ws-mt8" role="note">
                                            <Lc name="triangle-alert" size={16} color="var(--warn)" />
                                            <div>Có lượt rẽ không có mốc nào gần, khách chỉ thấy “Rẽ trái”. Thêm một điểm dễ thấy gần đó.</div>
                                        </div>
                                    )}
                                </>
                            ) : !result && <p className="k14 k-m">Chọn hai điểm để xem tuyến trên bản nháp, chưa cần xuất bản.</p>}
                        </div>
                    </aside>
                </div>
            ) : (
                <div className="ws-col ws-fill" style={{ gap: 16 }}>
                    {pairs && (
                        <div role="group" aria-label="Lọc kết quả" className="k-line" style={{ flexWrap: "wrap" }}>
                            {chip("bad", "Có lỗi", failed.length + detours.length)}{chip("none", "Không có đường", failed.length)}{chip("detour", "Đi vòng", detours.length)}
                            {chip("ok", "Đạt", passed.length)}{chip("all", "Tất cả", pairs.length)}
                            <span className="k12 k-m ws-right"><b className="k-b" style={{ color: "var(--ink)" }}>Đi vòng</b> là dài hơn 1,8 lần đường chim bay</span>
                        </div>
                    )}
                    <div className="ws-row ws-fill">
                        <section aria-labelledby="pair-t" className="k-card ws-card0 ws-grow" style={{ display: "flex" }}>
                            <div className="ws-cardhead is-24" style={{ borderBottom: 0, gap: 16 }}>
                                <h2 id="pair-t" className="k16 k-line" style={{ minWidth: 0 }}>{pair ? pairTitle(pair) : "Kiểm tra hàng loạt"}</h2>
                                {pair && (pair.ok
                                    ? (pair.detour ?? 1) > DETOUR ? <span className="k-badge k-warn">Đi vòng {pair.detour!.toFixed(1).replace(".", ",")}×</span> : <span className="k-badge k-ok">Đạt</span>
                                    : <span className="k-badge k-danger">Không có đường</span>)}
                                <Link to={`/builder/v/${venueId}/walkways${pair ? `?floor=${pair.from.floorId}` : ""}`} className="k-btn sm ws-right">Sửa lối đi</Link>
                            </div>
                            <div className="ws-mapwrap">
                                <EditorMap model={model} floorId={pairRoute?.legs[0]?.floorId ?? pair?.from.floorId ?? model.defaultFloor?.id ?? null} fitKey={pair ? `${pair.from.id}-${pair.to.id}` : "none"}>
                                    {map => <RouteLayer map={map} route={pairRoute} legIndex={0} from={pair?.from ?? null} to={pair?.to ?? null} straight />}
                                </EditorMap>
                                {pair && (
                                    <div className="ws-float is-tl is-col">
                                        {pair.meters != null && <span className="k-line"><span aria-hidden="true" className="ws-legend" style={{ height: 4, borderRadius: 999, background: "var(--route)", boxShadow: "0 0 0 1px var(--graphite)" }} />Tuyến {pair.meters} m</span>}
                                        <span className="k-line"><span aria-hidden="true" className="ws-legend" style={{ borderTop: "2px dashed var(--danger)" }} />Chim bay {Math.round(pair.straight)} m</span>
                                    </div>
                                )}
                            </div>
                        </section>
                        <section aria-labelledby="list-t" className="k-card ws-card0" style={{ width: 360, flexShrink: 0, minHeight: 0, display: "flex" }}>
                            <div className="ws-cardhead is-24">
                                <h2 id="list-t" className="k16">{pairs ? `${listed.length} cặp` : "Chưa chạy"}</h2>
                                {ranAt && <span className="k12 k-m">chạy lúc {ranAt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</span>}
                            </div>
                            {pairs ? (
                                <ul className="ws-list ws-grow" style={{ overflowY: "auto", minHeight: 0 }}>
                                    {listed.map((p, i) => (
                                        <li key={`${p.from.id}-${p.to.id}-${i}`}>
                                            <button type="button" className="ws-pr" aria-pressed={p === pair} title="Xem trên bản đồ" onClick={() => setPairIndex(i)}>
                                                <span className="ws-grow ws-col">
                                                    <span className={`k-line${p === pair ? " k-b" : ""}`} style={{ gap: 4, minWidth: 0 }}>{pairTitle(p)}</span>
                                                    <span className="k12 k-m ws-ellipsis">{p.ok ? `${p.meters} m` : p.error}</span>
                                                </span>
                                                {p.ok
                                                    ? (p.detour ?? 1) > DETOUR ? <span className="k12 k-b k-warn is-nowrap">Đi vòng {p.detour!.toFixed(1).replace(".", ",")}×</span> : <span className="k12 k-m is-nowrap">Đạt</span>
                                                    : <span className="k12 k-b k-danger is-nowrap">Không có đường</span>}
                                            </button>
                                        </li>
                                    ))}
                                    {!listed.length && <li className="k14 k-m" style={{ padding: 24 }}>Không có cặp nào trong nhóm này.</li>}
                                </ul>
                            ) : (
                                <div className="ws-pidle" style={{ flex: 1 }}>
                                    <p className="k14 k-m">Chạy 50 cặp điểm ngẫu nhiên trong cùng toà nhà để tìm chỗ lối đi bị đứt hoặc đi vòng.</p>
                                </div>
                            )}
                        </section>
                    </div>
                </div>
            )}
        </div>
    );
}

function Num({ k, v }: { k: string; v: string }) {
    return <div className="ws-col"><span className="k12 k-m">{k}</span><span className="k16">{v}</span></div>;
}

/** Tuyến vàng viền than chì; điểm đi ô sáng, điểm đến ô biển than chì chữ vàng; straight = nét đứt đường chim bay */
function RouteLayer({ map, route, legIndex, from, to, straight }: { map: Leaflet.Map; route: PlannedRoute | null; legIndex: number; from: Place | null; to: Place | null; straight?: boolean }) {
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
        const c = mapColors();
        const leg = route?.legs[legIndex];
        if (leg) {
            const pts = leg.points.map(p => L.latLng(p.lat, p.lng));
            g.addLayer(L.polyline(pts, { color: c.graphite, weight: 9, lineCap: "round", lineJoin: "round", interactive: false }));
            g.addLayer(L.polyline(pts, { color: c.signal, weight: 5, lineCap: "round", lineJoin: "round", interactive: false }));
            map.fitBounds(L.latLngBounds(pts).pad(0.3), { animate: false, maxZoom: 21 });
        }
        if (straight && from && to && from.floorId === to.floorId) {
            g.addLayer(L.polyline([[from.lat, from.lng], [to.lat, to.lng]], { color: c.danger, weight: 2, dashArray: "6 5", interactive: false }));
            if (!leg) map.fitBounds(L.latLngBounds([[from.lat, from.lng], [to.lat, to.lng]]).pad(0.4), { animate: false, maxZoom: 21 });
        }
        if (from && (!leg || from.floorId === leg.floorId)) {
            g.addLayer(L.marker([from.lat, from.lng], { icon: signIcon({ inner: "A", label: from.name, light: true, showLabel: true }), interactive: false, zIndexOffset: 1000 }));
        }
        if (to && (!leg || to.floorId === leg.floorId)) {
            g.addLayer(L.marker([to.lat, to.lng], { icon: signIcon({ inner: "B", label: to.name, plate: true, showLabel: true }), interactive: false, zIndexOffset: 1000 }));
        }
    }, [map, route, legIndex, from, to, straight]);
    return null;
}
