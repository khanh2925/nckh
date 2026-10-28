import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type * as Leaflet from "leaflet";
import { analyzeVenue, buildVenueModel, distance, type LatLng, type WalkwayEdgeDto, type WalkwayNetworkDto, type WalkwayNodeDto } from "@indoor-map/core";
import L from "../../lib/leaflet";
import { walkwayApi } from "../../console/api";
import { HeaderActions, HeaderStatus, SaveState } from "../../console/Shell";
import { Button, useAction, useFeedback } from "../../console/ui";
import Lc from "../../design/Lc";
import EditorMap from "../EditorMap";
import FloorList, { floorLabel, GuestLink } from "../FloorList";
import { ClickLayer, lucideSvg, mapColors, PlacesLayer, signIcon } from "../layers";
import { useWorkspace } from "../Workspace";
import "./workspace.css";

type Tool = "select" | "draw" | "link" | "connector" | "erase";
const TOOLS: [Tool, string, string][] = [
    ["select", "Chọn và kéo", "V"], ["draw", "Vẽ nút và cạnh", "N"], ["link", "Nối hai nút", "L"], ["connector", "Thang, nối tầng", "T"], ["erase", "Xoá nút, cắt cạnh", "C"]
];
const CONNECTORS = ["Thang máy", "Thang cuốn", "Thang bộ"];
const SNAP_METERS = 1.5;
let seq = 0;
/** Mã nút mới: <toà>-<tầng>-n<thời gian><số thứ tự> (gọi trong sự kiện, không gọi khi render) */
function makeNodeId(buildingCode: string | undefined, level: number | undefined): string {
    return `${buildingCode || "N"}-${level ?? 0}-n${Date.now().toString(36)}${(seq++).toString(36)}`;
}

const edgeKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/** Trạng thái mã QR lưu tạm trên trình duyệt (xem QrPage) */
function readQr(venueId: number): { selected: string[]; posted: string[]; printed: string[] } {
    try {
        const raw = JSON.parse(localStorage.getItem(`indoor-map.qr.${venueId}`) || "{}") as { selected?: string[]; posted?: string[]; printed?: string[] };
        return { selected: raw.selected ?? [], posted: raw.posted ?? [], printed: raw.printed ?? [] };
    } catch {
        return { selected: [], posted: [], printed: [] };
    }
}

// Lối đi: vẽ nút và cạnh, đánh dấu thang và nối tầng. Sửa trên bản sao cục bộ (hoàn tác, làm lại) rồi lưu cả mạng một lần.
export default function WalkwaysPage() {
    const { venueId, data, model, patch } = useWorkspace();
    const { confirm } = useFeedback();
    const { busy, run } = useAction();
    const [params, setParams] = useSearchParams();
    const floorId = Number(params.get("floor")) || model.defaultFloor?.id || model.floors[0]?.id || null;
    const floor = floorId ? model.floorsById.get(floorId) : undefined;
    const [network, setNetwork] = useState<WalkwayNetworkDto>(() => structuredClone(data.walkways));
    const [history, setHistory] = useState<WalkwayNetworkDto[]>([]);
    const [future, setFuture] = useState<WalkwayNetworkDto[]>([]);
    const [changes, setChanges] = useState(0);
    const [tool, setTool] = useState<Tool>("draw");
    const [selected, setSelected] = useState<string | null>(null);
    const [showPlaces, setShowPlaces] = useState(true);
    const [snap, setSnap] = useState(true);
    const [linkFloor, setLinkFloor] = useState<number | "">("");
    const [focus, setFocus] = useState<{ key: number; points: LatLng[] } | null>(null);
    const [qr] = useState(() => readQr(venueId));
    const dirty = changes > 0;

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
        setFuture([]);
        setNetwork(next);
        setChanges(c => c + 1);
    }, []);

    const undo = useCallback(() => {
        const prev = history[history.length - 1];
        if (!prev) return;
        setFuture(f => [networkRef.current, ...f]);
        networkRef.current = prev;
        setNetwork(prev);
        setHistory(history.slice(0, -1));
        setChanges(c => c - 1);
    }, [history]);
    const redo = useCallback(() => {
        const next = future[0];
        if (!next) return;
        setHistory(h => [...h, networkRef.current]);
        networkRef.current = next;
        setNetwork(next);
        setFuture(future.slice(1));
        setChanges(c => c + 1);
    }, [future]);

    const nodesById = useMemo(() => new Map(network.nodes.map(n => [n.id, n])), [network]);
    const edgeSet = useMemo(() => new Set(network.edges.map(e => edgeKey(e.from, e.to))), [network]);
    const draftModel = useMemo(() => buildVenueModel({ ...data, walkways: network }), [data, network]);
    const report = useMemo(() => analyzeVenue(draftModel), [draftModel]);
    const floorPlaces = useMemo(() => model.locations.filter(l => l.floorId === floorId), [model, floorId]);

    const newNodeId = () => makeNodeId(floor?.buildingCode, floor?.level);

    const nearestNode = (ll: LatLng) => {
        if (!snap) return null;
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

    const removeNode = (id: string) => {
        change(n => ({ nodes: n.nodes.filter(x => x.id !== id), edges: n.edges.filter(e => e.from !== id && e.to !== id) }));
        if (selected === id) setSelected(null);
    };

    const clickNode = (id: string) => {
        if (tool === "erase") return removeNode(id);
        if (tool === "connector") {
            change(n => ({ ...n, nodes: n.nodes.map(x => (x.id === id && !x.connector ? { ...x, connector: CONNECTORS[0] } : x)) }));
            setSelected(id);
            return;
        }
        if ((tool === "draw" || tool === "link") && selected && selected !== id) {
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
            // Bấm vào giữa một cạnh: chèn nút mới vào cạnh đó (tách đôi)
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
    const setConnector = (value: string | undefined) => node && change(n => ({ ...n, nodes: n.nodes.map(x => (x.id === node.id ? { ...x, connector: value } : x)) }));

    const linkTo = (target: WalkwayNodeDto) => {
        if (!node) return;
        change(n => ({
            nodes: n.nodes.map(x => (x.id === target.id && !x.connector ? { ...x, connector: node.connector ?? CONNECTORS[0] } : x)),
            edges: edgeSet.has(edgeKey(node.id, target.id)) ? n.edges : [...n.edges, { from: node.id, to: target.id }]
        }));
    };
    const createStacked = () => {
        if (!node || !linkFloor) return;
        const target = model.floorsById.get(linkFloor);
        const copy: WalkwayNodeDto = { id: makeNodeId(target?.buildingCode, target?.level), floorId: linkFloor, lat: node.lat, lng: node.lng, connector: node.connector ?? CONNECTORS[0] };
        change(n => ({ nodes: [...n.nodes, copy], edges: [...n.edges, { from: node.id, to: copy.id }] }));
    };

    const save = async () => {
        const body: WalkwayNetworkDto = {
            nodes: network.nodes.map(({ id, floorId: f, lat, lng, connector }) => ({ id, floorId: f, lat, lng, ...(connector ? { connector } : {}) })),
            edges: network.edges.map(({ from, to }) => ({ from, to }))
        };
        const saved = await run(() => walkwayApi.replace(venueId, body), `Đã lưu ${body.nodes.length} nút, ${body.edges.length} cạnh`);
        if (saved) {
            patch("walkways", saved);
            setNetwork(structuredClone(saved));
            setHistory([]);
            setFuture([]);
            setChanges(0);
        }
    };

    const discard = async () => {
        if (!(await confirm("Bỏ mọi thay đổi chưa lưu?", { danger: true, okLabel: "Bỏ thay đổi" }))) return;
        setNetwork(structuredClone(data.walkways));
        setHistory([]);
        setFuture([]);
        setChanges(0);
        setSelected(null);
    };

    const deleteSelected = async () => {
        if (!node) return;
        if (qr.selected.includes(node.id) && !(await confirm(`Xoá nút ${node.id}?`, {
            danger: true, okLabel: "Xoá nút", detail: `Nút này đang là mã QR${qr.posted.includes(node.id) ? " đã dán" : ""}. Khách quét tem sẽ không còn định vị được.`
        }))) return;
        removeNode(node.id);
    };

    // Phím tắt: V N L T C chọn công cụ, Ctrl+Z hoàn tác, Ctrl+Shift+Z làm lại
    const keys = useRef({ undo, redo });
    useEffect(() => {
        keys.current = { undo, redo };
    }, [undo, redo]);
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null;
            if (target && (target.isContentEditable || ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName))) return;
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
                e.preventDefault();
                if (e.shiftKey) keys.current.redo();
                else keys.current.undo();
                return;
            }
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            const hit = TOOLS.find(([, , k]) => k.toLowerCase() === e.key.toLowerCase());
            if (hit) setTool(hit[0]);
            else if (e.key === "Escape") setSelected(null);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    const floorNodes = network.nodes.filter(n => n.floorId === floorId);
    const floorEdges = network.edges.filter(e => nodesById.get(e.from)?.floorId === floorId && nodesById.get(e.to)?.floorId === floorId);
    const floorMeters = floorEdges.reduce((sum, e) => sum + distance(nodesById.get(e.from)!, nodesById.get(e.to)!), 0);
    const strayOnFloor = floorNodes.filter(n => report.strayNodes.has(n.id));
    const unreachableOnFloor = [...report.unreachable, ...report.isolated].filter(p => p.floorId === floorId);
    const connectorsOnFloor = floorNodes.filter(n => n.connector);
    const looseOnFloor = report.looseConnectors.filter(id => nodesById.get(id)?.floorId === floorId).length;
    const buildingFloors = floor ? model.floorsOf(floor.buildingId) : [];

    const header = (
        <>
            <HeaderStatus><SaveState state={busy ? "saving" : dirty ? "dirty" : "saved"} count={changes} /></HeaderStatus>
            <HeaderActions>
                <GuestLink venue={data.venue} />
                {dirty && <Button onClick={() => void discard()}>Bỏ thay đổi</Button>}
                <Button variant="primary" busy={busy} disabled={!dirty} title={dirty ? undefined : "Chưa có thay đổi"} onClick={() => void save()}>Lưu mạng lối đi</Button>
            </HeaderActions>
        </>
    );

    if (!floor || !floorId) {
        return (
            <div className="k-page">
                {header}
                <section className="k-card ws-empty">
                    <h2 className="k16">Chưa có tầng</h2>
                    <p className="k14 k-m">Thêm toà nhà và tầng trước, rồi vẽ lối đi trên mặt bằng.</p>
                    <div className="ws-mt8"><Button variant="primary" to={`/builder/v/${venueId}/buildings`}>Thêm toà nhà và tầng</Button></div>
                </section>
            </div>
        );
    }

    const selectFloor = (id: number) => {
        setParams({ floor: String(id) });
        setSelected(null);
        setLinkFloor("");
    };
    const qrState = node && qr.selected.includes(node.id) ? (qr.posted.includes(node.id) ? "Đã dán" : qr.printed.includes(node.id) ? "Đã in" : "Đã tạo") : null;

    return (
        <div className="ws-work">
            {header}
            <aside aria-label="Công cụ" className="ws-panel is-left">
                <section className="ws-grp">
                    <h2 className="k-sec">Toà nhà và tầng</h2>
                    {model.buildings.length > 1 && (
                        <select aria-label="Toà nhà" className="k-input" value={floor.buildingId} onChange={e => { const first = model.floorsOf(Number(e.target.value))[0]; if (first) selectFloor(first.id); }}>
                            {model.buildings.filter(b => model.floorsOf(b.id).length).map(b => <option key={b.id} value={b.id}>{b.code} {b.name}</option>)}
                        </select>
                    )}
                    <div><FloorList model={model} floorId={floorId} buildingId={floor.buildingId} onSelect={selectFloor} count={id => `${network.nodes.filter(n => n.floorId === id).length} nút`} /></div>
                </section>
                <section className="ws-grp">
                    <h2 className="k-sec">Công cụ</h2>
                    <div role="group" aria-label="Công cụ vẽ">
                        {TOOLS.map(([t, label, key]) => (
                            <button key={t} type="button" className="ws-tl" aria-pressed={tool === t} aria-keyshortcuts={key} onClick={() => setTool(t)}>
                                {label}<kbd className="k12 k-m">{key}</kbd>
                            </button>
                        ))}
                    </div>
                </section>
                <section className="ws-grp">
                    <h2 className="k-sec">Hiển thị</h2>
                    <div>
                        <label className="k-line k14" style={{ minHeight: 32 }}><input type="checkbox" className="k-check" checked={snap} onChange={e => setSnap(e.target.checked)} />Bắt dính nút ≤ 1,5 m</label>
                        <label className="k-line k14" style={{ minHeight: 32 }}><input type="checkbox" className="k-check" checked={showPlaces} onChange={e => setShowPlaces(e.target.checked)} />Điểm quan tâm</label>
                    </div>
                    <div className="ws-grp">
                        <span className="k-line k12 k-m"><span aria-hidden="true" className="ws-legend" style={{ height: 3, borderRadius: 999, background: "var(--graphite)" }} />Lối đi</span>
                        <span className="k-line k12 k-m"><span aria-hidden="true" className="ws-legend" style={{ borderTop: "2px dashed var(--danger)" }} />Mảnh rời</span>
                        <span className="k-line k12 k-m"><span aria-hidden="true" className="ws-legend" style={{ borderTop: "2px dotted var(--warn)" }} />Thang chưa nối tầng</span>
                    </div>
                </section>
                <div className="ws-stats">
                    <div><span className="k16">{floorNodes.length.toLocaleString("vi-VN")}</span><span className="k12 k-m">nút</span></div>
                    <div><span className="k16">{floorEdges.length.toLocaleString("vi-VN")}</span><span className="k12 k-m">cạnh</span></div>
                    <div><span className="k16">{Math.round(floorMeters).toLocaleString("vi-VN")}</span><span className="k12 k-m">mét</span></div>
                </div>
            </aside>

            <section className="ws-canvas" aria-label="Canvas lối đi">
                <EditorMap model={model} floorId={floorId}>
                    {map => (
                        <>
                            <ClickLayer map={map} onClick={onMapClick} cursor={tool === "draw"} />
                            {showPlaces && <PlacesLayer map={map} places={floorPlaces} typeOf={model.typeOf} selectedId={null} />}
                            <NetworkLayer map={map} network={network} floorId={floorId} selected={selected} stray={report.strayNodes} loose={report.looseConnectors} draggable={tool === "select"}
                                floorName={id => floorLabel(model, model.floorsById.get(id))} onNode={clickNode} onEdge={clickEdge} onMove={moveNode} />
                            <FocusLayer map={map} focus={focus} />
                        </>
                    )}
                </EditorMap>
                <div role="toolbar" aria-label="Hoàn tác" className="ws-float is-tl">
                    <button type="button" className="k-ib sm t" aria-label="Hoàn tác" title="Hoàn tác (Ctrl+Z)" disabled={!history.length} onClick={undo}><Lc name="undo-2" size={16} /></button>
                    <button type="button" className="k-ib sm t" aria-label="Làm lại" title="Làm lại (Ctrl+Shift+Z)" disabled={!future.length} onClick={redo}><Lc name="redo-2" size={16} /></button>
                </div>
                <div role="region" aria-label="Kiểm tra đồ thị" className="ws-float is-bar">
                    <span className="k-b">Kiểm tra</span>
                    {strayOnFloor.length ? (
                        <button type="button" className="k-btn t sm" onClick={() => setFocus({ key: Date.now(), points: strayOnFloor })}>
                            <span className="ws-badgepin is-danger" aria-hidden="true">1</span><span className="k-danger">{strayOnFloor.length} nút thuộc mảnh rời</span>
                        </button>
                    ) : <span className="k-line"><Lc name="check" size={16} color="var(--ok)" /><span className="k-ok">Liền mạch</span></span>}
                    {unreachableOnFloor.length ? (
                        <button type="button" className="k-btn t sm" onClick={() => setFocus({ key: Date.now(), points: unreachableOnFloor })}>
                            <span className="ws-badgepin is-warn" aria-hidden="true">2</span><span className="k-warn">{unreachableOnFloor.length} điểm chưa nối lối đi</span>
                        </button>
                    ) : <span className="k-line"><Lc name="check" size={16} color="var(--ok)" /><span className="k-ok">Mọi điểm tới được</span></span>}
                    {connectorsOnFloor.length > 0 && (looseOnFloor
                        ? <span className="k-line"><Lc name="triangle-alert" size={16} color="var(--warn)" /><span className="k-warn">{connectorsOnFloor.length - looseOnFloor}/{connectorsOnFloor.length} thang đã nối tầng</span></span>
                        : <span className="k-line"><Lc name="check" size={16} color="var(--ok)" /><span className="k-ok">{connectorsOnFloor.length}/{connectorsOnFloor.length} thang đã nối tầng</span></span>)}
                    <Link to={`/builder/v/${venueId}/test`} className="k-btn t sm ws-right">Thử chỉ đường</Link>
                </div>
            </section>

            <aside aria-label="Thuộc tính" className="ws-panel is-right">
                {node ? (
                    <>
                        <div className="ws-phead">
                            <h2 className="k16">{node.connector ?? "Nút lối đi"}</h2>
                            <span className="k12 k-m ws-ellipsis" title={node.id}>Nút {node.id}, {floorLabel(model, model.floorsById.get(node.floorId))}</span>
                        </div>
                        <div className="ws-pbody is-24">
                            <fieldset className="k-field ws-fs0">
                                <legend className="k-label">Loại nút</legend>
                                <div className="ws-seg" role="group" aria-label="Loại nút">
                                    <button type="button" className="k-chip" aria-pressed={!node.connector} onClick={() => setConnector(undefined)}>Lối đi thường</button>
                                    {CONNECTORS.map(c => <button key={c} type="button" className="k-chip" aria-pressed={node.connector === c} onClick={() => setConnector(c)}>{c}</button>)}
                                </div>
                            </fieldset>
                            {node.connector && (
                                <div className="k-field">
                                    <span className="k-label">Nối tầng</span>
                                    {otherFloorLinks.map(n => (
                                        <div key={n.id} className="k-line k14" style={{ minHeight: 40, padding: "0 4px 0 12px", borderRadius: 6, background: "var(--surface-2)" }}>
                                            <span className="ws-grow ws-ellipsis" title={n.id}>{floorLabel(model, model.floorsById.get(n.floorId), " ")}, {n.id}</span>
                                            <span className="k-badge k-ok"><Lc name="check" size={14} />Đã nối</span>
                                            <button type="button" className="k-btn t sm" onClick={() => change(x => ({ ...x, edges: x.edges.filter(e => edgeKey(e.from, e.to) !== edgeKey(node.id, n.id)) }))}>Gỡ</button>
                                        </div>
                                    ))}
                                    {!otherFloorLinks.length && <span className="k-badge k-warn"><Lc name="triangle-alert" size={14} />Chưa nối sang tầng nào</span>}
                                    <select className="k-input" aria-label="Tầng cần nối" value={linkFloor} onChange={e => setLinkFloor(e.target.value ? Number(e.target.value) : "")}>
                                        <option value="">Chọn nút tầng khác…</option>
                                        {sameBuildingFloors.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                                    </select>
                                    {linkFloor !== "" && (
                                        <div className="ws-grp">
                                            <button type="button" className="k-btn sm" onClick={createStacked}>Tạo nút thang cùng vị trí</button>
                                            {linkCandidates.map(({ n, d }) => (
                                                <button key={n.id} type="button" className="k-btn sm" style={{ justifyContent: "space-between" }} onClick={() => linkTo(n)}>
                                                    <span className="ws-ellipsis">{n.id}</span><span className="k12 k-m">{n.connector ?? "lối đi"}, {d.toFixed(1)} m</span>
                                                </button>
                                            ))}
                                            {!linkCandidates.length && <span className="k12 k-m">Tầng đó chưa có nút nào.</span>}
                                        </div>
                                    )}
                                </div>
                            )}
                            <div className="k-field">
                                <span className="k-label">Mã QR</span>
                                <div className="k-line k14" style={{ height: 40, padding: "0 4px 0 12px", borderRadius: 6, border: "1px solid var(--rule)" }}>
                                    <span className={`ws-grow ws-ellipsis${qrState ? " k-b" : " k-m"}`}>{qrState ? node.id : "Chưa có mã"}</span>
                                    {qrState && <span className="k12 k-m">{qrState}</span>}
                                    <Link to={`/builder/v/${venueId}/qr?floor=${node.floorId}`} className="k-btn t sm">Quản lý</Link>
                                </div>
                            </div>
                            <div>
                                <div className="k-row"><span className="k12 k-m" style={{ width: 64 }}>Toạ độ</span><span className="k14">{node.lat.toFixed(6)}, {node.lng.toFixed(6)}</span></div>
                                <div className="k-row"><span className="k12 k-m" style={{ width: 64 }}>Nối với</span><span className="k14">{neighbors.length} nút</span></div>
                            </div>
                        </div>
                        <div className="ws-pfoot">
                            <button type="button" className="k-btn d sm" style={{ paddingLeft: 0 }} onClick={() => void deleteSelected()}><Lc name="trash" size={16} />Xoá nút…</button>
                            <button type="button" className="k-btn t sm ws-right" onClick={() => setSelected(null)}>Bỏ chọn</button>
                        </div>
                    </>
                ) : (
                    <div className="ws-pidle">
                        <p className="k14 k-m">Bấm dọc giữa hành lang để vẽ lối đi. Chọn một nút để sửa loại thang và nối tầng.</p>
                        {buildingFloors.length > 1 && connectorsOnFloor.length === 0 && <p className="k12 k-m">Tầng này chưa có nút thang nào.</p>}
                    </div>
                )}
            </aside>
        </div>
    );
}

/** Phóng tới nhóm điểm cần xem (mảnh rời, điểm chưa nối) */
function FocusLayer({ map, focus }: { map: Leaflet.Map; focus: { key: number; points: LatLng[] } | null }) {
    useEffect(() => {
        if (!focus?.points.length) return;
        map.fitBounds(L.latLngBounds(focus.points.map(p => L.latLng(p.lat, p.lng))).pad(0.4), { maxZoom: 21 });
    }, [map, focus]);
    return null;
}

function NetworkLayer({ map, network, floorId, selected, stray, loose, draggable, floorName, onNode, onEdge, onMove }: {
    map: Leaflet.Map; network: WalkwayNetworkDto; floorId: number; selected: string | null; stray: Set<string>; loose: string[]; draggable: boolean;
    floorName(id: number): string; onNode(id: string): void; onEdge(edge: WalkwayEdgeDto, ll: Leaflet.LatLng): void; onMove(id: string, ll: Leaflet.LatLng): void;
}) {
    const group = useRef<Leaflet.LayerGroup | null>(null);
    const cb = useRef({ onNode, onEdge, onMove, floorName });
    useEffect(() => {
        cb.current = { onNode, onEdge, onMove, floorName };
    }, [onNode, onEdge, onMove, floorName]);
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
        const looseSet = new Set(loose);
        const byId = new Map(network.nodes.map(n => [n.id, n]));
        const otherFloor = new Map<string, number>();
        for (const e of network.edges) {
            const a = byId.get(e.from);
            const b = byId.get(e.to);
            if (!a || !b) continue;
            if (a.floorId !== b.floorId) {
                otherFloor.set(a.id, b.floorId);
                otherFloor.set(b.id, a.floorId);
                continue;
            }
            if (a.floorId !== floorId) continue;
            const bad = stray.has(a.id) || stray.has(b.id);
            const line = L.polyline([[a.lat, a.lng], [b.lat, b.lng]], { color: bad ? c.danger : c.graphite, weight: bad ? 2.5 : 3, lineCap: "round", dashArray: bad ? "5 4" : undefined, bubblingMouseEvents: false });
            line.on("click", ev => cb.current.onEdge(e, ev.latlng));
            g.addLayer(line);
        }
        for (const n of network.nodes) {
            if (n.floorId !== floorId) continue;
            const isSel = n.id === selected;
            let layer: Leaflet.Layer;
            if (n.connector) {
                const linkedTo = otherFloor.get(n.id);
                const label = linkedTo != null ? `${n.connector} nối ${cb.current.floorName(linkedTo)}` : `${n.connector} chưa nối tầng`;
                const m = L.marker([n.lat, n.lng], {
                    icon: signIcon({ inner: lucideSvg("arrow-up-down"), label: isSel ? label : undefined, color: looseSet.has(n.id) ? c.warn : c.graphite, selected: isSel, tag: isSel }),
                    draggable: draggable && isSel, zIndexOffset: isSel ? 2000 : 500, bubblingMouseEvents: false, title: label
                });
                m.on("dragend", () => cb.current.onMove(n.id, m.getLatLng()));
                layer = m;
            } else if (isSel) {
                const m = L.marker([n.lat, n.lng], {
                    icon: L.divIcon({ className: "", html: `<span class="cb-node is-selected"></span>`, iconSize: [16, 16], iconAnchor: [8, 8] }),
                    draggable, zIndexOffset: 2000, bubblingMouseEvents: false
                });
                m.on("dragend", () => cb.current.onMove(n.id, m.getLatLng()));
                layer = m;
            } else {
                layer = L.circleMarker([n.lat, n.lng], { radius: 4.5, color: stray.has(n.id) ? c.danger : c.graphite, weight: 2, fillColor: c.surface, fillOpacity: 1, bubblingMouseEvents: false });
            }
            layer.on("click", () => cb.current.onNode(n.id));
            g.addLayer(layer);
        }
        // Thang chưa nối tầng: vòng chấm vàng nâu quanh ô biển
        for (const id of loose) {
            const n = byId.get(id);
            if (n && n.floorId === floorId) g.addLayer(L.circleMarker([n.lat, n.lng], { radius: 16, color: c.warn, weight: 2, dashArray: "2 4", fill: false, interactive: false }));
        }
    }, [network, floorId, selected, stray, loose, draggable]);
    return null;
}
