import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type * as Leaflet from "leaflet";
import { analyzeVenue, buildVenueModel, distance, type WalkwayEdgeDto, type WalkwayNetworkDto, type WalkwayNodeDto } from "@indoor-map/core";
import L from "../../lib/leaflet";
import { walkwayApi } from "../../console/api";
import { Button, Check, Select, Status, useAction, useFeedback } from "../../console/ui";
import EditorMap from "../EditorMap";
import FloorList from "../FloorList";
import { ClickLayer, PlacesLayer } from "../layers";
import { useWorkspace } from "../Workspace";

type Tool = "draw" | "select" | "erase";
const CONNECTORS = ["Thang máy", "Thang cuốn", "Thang bộ"];
const SNAP_METERS = 1.5;
let seq = 0;
/** Mã nút mới: <toà>-<tầng>-n<thời gian><số thứ tự> (gọi trong sự kiện, không gọi khi render) */
function makeNodeId(buildingCode: string | undefined, level: number | undefined): string {
    return `${buildingCode || "N"}-${level ?? 0}-n${Date.now().toString(36)}${(seq++).toString(36)}`;
}

const edgeKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

// Lối đi: vẽ nút & đoạn, đánh dấu thang và nối tầng. Sửa cục bộ rồi "Lưu lối đi" (thay toàn bộ mạng một lần).
export default function WalkwaysPage() {
    const { venueId, data, model, patch } = useWorkspace();
    const { confirm } = useFeedback();
    const { busy, run } = useAction();
    const [params, setParams] = useSearchParams();
    const floorId = Number(params.get("floor")) || model.defaultFloor?.id || model.floors[0]?.id || null;
    const floor = floorId ? model.floorsById.get(floorId) : undefined;
    const [network, setNetwork] = useState<WalkwayNetworkDto>(() => structuredClone(data.walkways));
    const [history, setHistory] = useState<WalkwayNetworkDto[]>([]);
    const [dirty, setDirty] = useState(false);
    const [tool, setTool] = useState<Tool>("draw");
    const [selected, setSelected] = useState<string | null>(null);
    const [showPlaces, setShowPlaces] = useState(true);
    const [linkFloor, setLinkFloor] = useState<number | "">("");

    useEffect(() => {
        if (!dirty) return undefined;
        const warn = (e: BeforeUnloadEvent) => e.preventDefault();
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, [dirty]);

    // Bản hiện tại để ghi lịch sử hoàn tác (không đặt side effect trong hàm cập nhật state)
    const networkRef = useRef(network);
    useEffect(() => {
        networkRef.current = network;
    }, [network]);
    const change = useCallback((fn: (n: WalkwayNetworkDto) => WalkwayNetworkDto) => {
        const current = networkRef.current;
        const next = fn(current);
        networkRef.current = next;
        setHistory(h => [...h.slice(-49), current]);
        setNetwork(next);
        setDirty(true);
    }, []);

    const undo = () => {
        const prev = history[history.length - 1];
        if (!prev) return;
        networkRef.current = prev;
        setNetwork(prev);
        setHistory(history.slice(0, -1));
    };

    const nodesById = useMemo(() => new Map(network.nodes.map(n => [n.id, n])), [network]);
    const edgeSet = useMemo(() => new Set(network.edges.map(e => edgeKey(e.from, e.to))), [network]);
    const draftModel = useMemo(() => buildVenueModel({ ...data, walkways: network }), [data, network]);
    const report = useMemo(() => analyzeVenue(draftModel), [draftModel]);

    const newNodeId = () => makeNodeId(floor?.buildingCode, floor?.level);

    const nearestNode = (ll: { lat: number; lng: number }) => {
        let best: WalkwayNodeDto | null = null;
        let bestD = SNAP_METERS;
        for (const n of network.nodes) {
            if (n.floorId !== floorId) continue;
            const d = distance(n, ll);
            if (d < bestD) {
                best = n;
                bestD = d;
            }
        }
        return best;
    };

    const clickNode = (id: string) => {
        if (tool === "erase") {
            change(n => ({ nodes: n.nodes.filter(x => x.id !== id), edges: n.edges.filter(e => e.from !== id && e.to !== id) }));
            if (selected === id) setSelected(null);
            return;
        }
        if (tool === "draw" && selected && selected !== id) {
            const key = edgeKey(selected, id);
            change(n => ({ ...n, edges: edgeSet.has(key) ? n.edges.filter(e => edgeKey(e.from, e.to) !== key) : [...n.edges, { from: selected, to: id }] }));
        }
        setSelected(id);
    };

    const onMapClick = (ll: Leaflet.LatLng) => {
        if (!floorId) return;
        if (tool !== "draw") {
            setSelected(null);
            return;
        }
        const snapped = nearestNode(ll);
        if (snapped) return clickNode(snapped.id);
        const node: WalkwayNodeDto = { id: newNodeId(), floorId, lat: Math.round(ll.lat * 1e7) / 1e7, lng: Math.round(ll.lng * 1e7) / 1e7 };
        const from = selected && nodesById.get(selected)?.floorId === floorId ? selected : null;
        change(n => ({ nodes: [...n.nodes, node], edges: from ? [...n.edges, { from, to: node.id }] : n.edges }));
        setSelected(node.id);
    };

    const clickEdge = (edge: WalkwayEdgeDto, ll: Leaflet.LatLng) => {
        if (tool === "erase") {
            change(n => ({ ...n, edges: n.edges.filter(e => edgeKey(e.from, e.to) !== edgeKey(edge.from, edge.to)) }));
            return;
        }
        if (tool === "draw" && floorId) {
            // Bấm vào giữa một đoạn: chèn nút mới vào đoạn đó (tách đôi)
            const node: WalkwayNodeDto = { id: newNodeId(), floorId, lat: ll.lat, lng: ll.lng };
            const from = selected && nodesById.get(selected)?.floorId === floorId ? selected : null;
            change(n => ({
                nodes: [...n.nodes, node],
                edges: [...n.edges.filter(e => edgeKey(e.from, e.to) !== edgeKey(edge.from, edge.to)), { from: edge.from, to: node.id }, { from: node.id, to: edge.to }, ...(from ? [{ from, to: node.id }] : [])]
            }));
            setSelected(node.id);
        }
    };

    const moveNode = (id: string, ll: Leaflet.LatLng) => change(n => ({ ...n, nodes: n.nodes.map(x => (x.id === id ? { ...x, lat: ll.lat, lng: ll.lng } : x)) }));
    const node = selected ? nodesById.get(selected) : undefined;
    const neighbors = node ? network.edges.filter(e => e.from === node.id || e.to === node.id).map(e => nodesById.get(e.from === node.id ? e.to : e.from)).filter((x): x is WalkwayNodeDto => Boolean(x)) : [];
    const otherFloorLinks = neighbors.filter(n => n.floorId !== node?.floorId);
    const sameBuildingFloors = floor ? model.floorsOf(floor.buildingId).filter(f => f.id !== floorId) : [];
    const linkCandidates = node && linkFloor ? network.nodes.filter(n => n.floorId === linkFloor).map(n => ({ n, d: distance(n, node) })).sort((a, b) => a.d - b.d).slice(0, 6) : [];

    const linkTo = (target: WalkwayNodeDto) => {
        if (!node) return;
        change(n => ({
            nodes: n.nodes.map(x => (x.id === target.id && !x.connector ? { ...x, connector: node.connector ?? "Thang máy" } : x)),
            edges: edgeSet.has(edgeKey(node.id, target.id)) ? n.edges : [...n.edges, { from: node.id, to: target.id }]
        }));
    };
    const createStacked = () => {
        if (!node || !linkFloor) return;
        const target = model.floorsById.get(linkFloor);
        const copy: WalkwayNodeDto = { id: makeNodeId(target?.buildingCode, target?.level), floorId: linkFloor, lat: node.lat, lng: node.lng, connector: node.connector ?? "Thang máy" };
        change(n => ({ nodes: [...n.nodes, copy], edges: [...n.edges, { from: node.id, to: copy.id }] }));
    };

    const save = async () => {
        const body: WalkwayNetworkDto = {
            nodes: network.nodes.map(({ id, floorId: f, lat, lng, connector }) => ({ id, floorId: f, lat, lng, ...(connector ? { connector } : {}) })),
            edges: network.edges.map(({ from, to }) => ({ from, to }))
        };
        const saved = await run(() => walkwayApi.replace(venueId, body), `Đã lưu ${body.nodes.length} nút, ${body.edges.length} đoạn`);
        if (saved) {
            patch("walkways", saved);
            setNetwork(structuredClone(saved));
            setHistory([]);
            setDirty(false);
        }
    };

    const discard = async () => {
        if (!(await confirm("Bỏ mọi thay đổi chưa lưu?", { danger: true, okLabel: "Bỏ thay đổi" }))) return;
        setNetwork(structuredClone(data.walkways));
        setHistory([]);
        setDirty(false);
        setSelected(null);
    };

    const floorNodes = network.nodes.filter(n => n.floorId === floorId);
    const strayOnFloor = floorNodes.filter(n => report.strayNodes.has(n.id)).length;
    const unreachableOnFloor = report.unreachable.filter(p => p.floorId === floorId).length + report.isolated.filter(p => p.floorId === floorId).length;
    const looseOnFloor = report.looseConnectors.filter(id => nodesById.get(id)?.floorId === floorId).length;

    if (!floor || !floorId) return <div className="cb-main"><div className="cb-empty"><div className="cb-h3">Chưa có tầng</div></div></div>;

    return (
        <div className="cb-work">
            <aside className="cb-side">
                <FloorList model={model} floorId={floorId} onSelect={id => { setParams({ floor: String(id) }); setSelected(null); setLinkFloor(""); }}
                    count={id => network.nodes.filter(n => n.floorId === id).length} />
                <div className="cb-side-section">
                    <span className="cb-label">Công cụ</span>
                    <div className="cb-stack" style={{ gap: 6 }}>
                        {([["draw", "bi-bezier2", "Vẽ: bấm chỗ trống tạo nút nối tiếp, bấm nút khác để nối/gỡ"], ["select", "bi-cursor", "Chọn & kéo nút để dời"], ["erase", "bi-eraser", "Xoá: bấm nút hoặc đoạn"]] as [Tool, string, string][]).map(([t, icon, label]) => (
                            <button key={t} type="button" className="cb-btn" aria-pressed={tool === t} style={{ justifyContent: "flex-start", height: "auto", minHeight: 36, padding: "6px 10px", whiteSpace: "normal", textAlign: "left", ...(tool === t ? { borderColor: "#2D5BE3", background: "#EEF2FB" } : {}) }} onClick={() => setTool(t)}>
                                <i className={`bi ${icon}`} aria-hidden="true" /> <span>{label}</span>
                            </button>
                        ))}
                    </div>
                    <Check label="Hiện điểm quan tâm" checked={showPlaces} onChange={setShowPlaces} />
                    <p className="cb-muted" style={{ fontSize: 12 }}>Bấm gần nút có sẵn (≤ {SNAP_METERS} m) sẽ dính vào nút đó. Bấm giữa một đoạn để chèn nút.</p>
                </div>
            </aside>

            <section className="cb-canvas" aria-label="Canvas lối đi">
                <EditorMap model={model} floorId={floorId}>
                    {map => (
                        <>
                            <ClickLayer map={map} onClick={onMapClick} cursor={tool === "draw"} />
                            {showPlaces && <PlacesLayer map={map} places={model.locations.filter(l => l.floorId === floorId)} typeOf={model.typeOf} selectedId={null} />}
                            <NetworkLayer map={map} network={network} floorId={floorId} selected={selected} stray={report.strayNodes} draggable={tool === "select"}
                                onNode={clickNode} onEdge={clickEdge} onMove={moveNode} />
                        </>
                    )}
                </EditorMap>
                <div className="cb-canvas-tools">
                    <span className="cb-mono" style={{ padding: "0 8px", alignSelf: "center" }}>{floorNodes.length} nút · {network.edges.filter(e => nodesById.get(e.from)?.floorId === floorId && nodesById.get(e.to)?.floorId === floorId).length} đoạn</span>
                    <span className="sep" />
                    <button type="button" onClick={undo} disabled={!history.length} title="Hoàn tác"><i className="bi bi-arrow-counterclockwise" aria-hidden="true" /> Hoàn tác</button>
                    <button type="button" onClick={() => void discard()} disabled={!dirty}>Bỏ thay đổi</button>
                    <button type="button" onClick={() => void save()} disabled={!dirty || busy} style={dirty ? { background: "#2D5BE3", color: "#fff" } : undefined}>{busy ? "Đang lưu…" : dirty ? "Lưu lối đi" : "Đã lưu"}</button>
                </div>
                <div className="cb-coord" style={{ display: "flex", gap: 12 }}>
                    <span><span style={{ display: "inline-block", width: 12, height: 3, background: "#2D5BE3", verticalAlign: "middle" }} /> lối đi</span>
                    <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 99, background: "#2D5BE3", verticalAlign: "middle" }} /> thang</span>
                    <span><span style={{ display: "inline-block", width: 12, height: 3, background: "#B42318", verticalAlign: "middle" }} /> mảnh rời</span>
                </div>
                {dirty && <div className="cb-hint" style={{ top: "auto", bottom: 56, background: "#B7791F" }}>Có thay đổi chưa lưu — bấm “Lưu lối đi” để khách thấy</div>}
                <div className="cb-checkbar">
                    <span className="cb-checkbar-title">Kiểm tra đồ thị · {floor.name}</span>
                    {strayOnFloor ? <Status kind="err">{strayOnFloor} nút thuộc mảnh rời (chưa nối vào mạng chính)</Status> : <Status kind="ok">Liền mạch</Status>}
                    {unreachableOnFloor ? <Status kind="warn">{unreachableOnFloor} điểm quan tâm chưa tới được</Status> : <Status kind="ok">Mọi điểm tới được</Status>}
                    {looseOnFloor ? <Status kind="warn">{looseOnFloor} thang chưa nối sang tầng khác</Status> : null}
                    <span className="cb-muted">Toàn địa điểm: {report.nodes} nút · {Math.round(report.meters)} m lối đi</span>
                    <Link to={`/builder/v/${venueId}/test`} style={{ marginLeft: "auto", fontWeight: 500 }}>Thử chỉ đường →</Link>
                </div>
            </section>

            <aside className="cb-side is-right">
                {node ? (
                    <div className="cb-pad cb-form">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                            <h2 className="cb-h3">Nút lối đi</h2>
                            <span className="cb-mono" style={{ color: "#6B7280", overflow: "hidden", textOverflow: "ellipsis" }}>{node.id}</span>
                        </div>
                        <Select label="Loại nút" value={node.connector ?? ""} onChange={e => change(n => ({ ...n, nodes: n.nodes.map(x => (x.id === node.id ? { ...x, connector: e.target.value || undefined } : x)) }))}>
                            <option value="">Lối đi thường</option>
                            {CONNECTORS.map(c => <option key={c} value={c}>{c} (nối tầng)</option>)}
                        </Select>
                        <div className="cb-kv cb-mono" style={{ fontSize: 12 }}>
                            <span>lat · lng</span><span>{node.lat.toFixed(6)} · {node.lng.toFixed(6)}</span>
                            <span>Nối với</span><span>{neighbors.length} nút</span>
                        </div>
                        {node.connector && (
                            <div className="cb-field">
                                <span className="cb-label">Nối tầng</span>
                                {otherFloorLinks.map(n => (
                                    <div key={n.id} className="cb-alert is-ok" style={{ padding: "6px 10px" }}>
                                        <i className="bi bi-arrow-down-up" aria-hidden="true" />
                                        <span>→ {model.floorsById.get(n.floorId)?.name} · <span className="cb-mono">{n.id}</span></span>
                                        <button type="button" className="cb-btn cb-btn-ghost is-small" onClick={() => change(x => ({ ...x, edges: x.edges.filter(e => edgeKey(e.from, e.to) !== edgeKey(node.id, n.id)) }))}>Gỡ</button>
                                    </div>
                                ))}
                                {!otherFloorLinks.length && <Status kind="warn">Chưa nối sang tầng nào</Status>}
                                <select className="cb-input" aria-label="Tầng cần nối" value={linkFloor} onChange={e => setLinkFloor(e.target.value ? Number(e.target.value) : "")}>
                                    <option value="">Chọn tầng để nối…</option>
                                    {sameBuildingFloors.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                </select>
                                {linkFloor !== "" && (
                                    <div className="cb-stack" style={{ gap: 6 }}>
                                        <Button small variant="primary" onClick={createStacked}>Tạo nút thang cùng vị trí ở tầng đó</Button>
                                        {linkCandidates.map(({ n, d }) => (
                                            <button key={n.id} type="button" className="cb-btn is-small" style={{ justifyContent: "space-between" }} onClick={() => linkTo(n)}>
                                                <span className="cb-mono">{n.id}</span><span>{n.connector ?? "lối đi"} · {d.toFixed(1)} m</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                        <div className="cb-actions">
                            <Button variant="danger" small onClick={() => { change(n => ({ nodes: n.nodes.filter(x => x.id !== node.id), edges: n.edges.filter(e => e.from !== node.id && e.to !== node.id) })); setSelected(null); }}>Xoá nút</Button>
                            <Button small onClick={() => setSelected(null)}>Bỏ chọn</Button>
                        </div>
                        <p className="cb-muted" style={{ fontSize: 12 }}>Với công cụ Vẽ, bấm chỗ trống để kéo dài lối đi từ nút này; bấm một nút khác để nối hoặc gỡ đoạn.</p>
                    </div>
                ) : (
                    <div className="cb-pad cb-stack">
                        <h2 className="cb-h3">Mạng lối đi</h2>
                        <p className="cb-muted">Lối đi là các đoạn thẳng nối các nút dọc hành lang. Khách được chỉ đường theo các đoạn này; địa điểm cách lối đi quá 60 m sẽ không tới được.</p>
                        <ol className="cb-muted" style={{ paddingLeft: 18, margin: 0, lineHeight: 1.7 }}>
                            <li>Chọn công cụ <b>Vẽ</b>, bấm dọc giữa hành lang.</li>
                            <li>Ở chân thang, chọn nút → <b>Loại nút</b> = Thang máy/cuốn/bộ.</li>
                            <li>Chọn tầng cần nối → tạo nút thang cùng vị trí.</li>
                            <li>Bấm <b>Lưu lối đi</b>, rồi <b>Thử chỉ đường</b>.</li>
                        </ol>
                        {strayOnFloor > 0 && <div className="cb-alert is-err"><i className="bi bi-x-circle" aria-hidden="true" /><span>Nút màu đỏ thuộc mảnh rời: nối chúng vào mạng chính để khách đi tới được.</span></div>}
                    </div>
                )}
            </aside>
        </div>
    );
}

function NetworkLayer({ map, network, floorId, selected, stray, draggable, onNode, onEdge, onMove }: {
    map: Leaflet.Map; network: WalkwayNetworkDto; floorId: number; selected: string | null; stray: Set<string>; draggable: boolean;
    onNode(id: string): void; onEdge(edge: WalkwayEdgeDto, ll: Leaflet.LatLng): void; onMove(id: string, ll: Leaflet.LatLng): void;
}) {
    const group = useRef<Leaflet.LayerGroup | null>(null);
    const cb = useRef({ onNode, onEdge, onMove });
    useEffect(() => {
        cb.current = { onNode, onEdge, onMove };
    }, [onNode, onEdge, onMove]);
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
        const byId = new Map(network.nodes.map(n => [n.id, n]));
        const linked = new Set<string>();
        for (const e of network.edges) {
            const a = byId.get(e.from);
            const b = byId.get(e.to);
            if (!a || !b) continue;
            if (a.floorId !== b.floorId) {
                linked.add(a.id);
                linked.add(b.id);
                continue;
            }
            if (a.floorId !== floorId) continue;
            const bad = stray.has(a.id) || stray.has(b.id);
            const line = L.polyline([[a.lat, a.lng], [b.lat, b.lng]], { color: bad ? "#B42318" : "#2D5BE3", weight: 4, opacity: 0.9, dashArray: bad ? "6 5" : undefined, bubblingMouseEvents: false });
            line.on("click", ev => cb.current.onEdge(e, ev.latlng));
            g.addLayer(line);
        }
        for (const n of network.nodes) {
            if (n.floorId !== floorId) continue;
            const isSel = n.id === selected;
            const color = stray.has(n.id) ? "#B42318" : "#2D5BE3";
            if (isSel) {
                const m = L.marker([n.lat, n.lng], {
                    icon: L.divIcon({ className: "", html: `<span class="cb-node is-selected"></span>`, iconSize: [18, 18], iconAnchor: [9, 9] }),
                    draggable, zIndexOffset: 2000, bubblingMouseEvents: false
                });
                m.on("click", () => cb.current.onNode(n.id));
                m.on("dragend", () => cb.current.onMove(n.id, m.getLatLng()));
                g.addLayer(m);
            } else {
                const dot = L.circleMarker([n.lat, n.lng], {
                    radius: n.connector ? 7 : 5, color, weight: n.connector ? 3 : 2, fillColor: n.connector ? (linked.has(n.id) ? color : "#F0B429") : "#fff", fillOpacity: 1, bubblingMouseEvents: false
                });
                dot.on("click", () => cb.current.onNode(n.id));
                if (n.connector) dot.bindTooltip(`${n.connector}${linked.has(n.id) ? "" : " · chưa nối tầng"}`);
                g.addLayer(dot);
            }
        }
    }, [network, floorId, selected, stray, draggable]);
    return null;
}
