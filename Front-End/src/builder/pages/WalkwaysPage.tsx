import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type * as Leaflet from "leaflet";
import { analyzeVenue, buildVenueModel, distance, type LatLng, type WalkwayEdgeDto, type WalkwayNetworkDto, type WalkwayNodeDto } from "@indoor-map/core";
import {
    ArrowUpDown, Check, CircleAlert, Eraser, Layers, Link2, MousePointer2, Redo2, Route, Spline, Trash2, TriangleAlert, Undo2, X, type LucideIcon
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import L from "../../lib/leaflet";
import { walkwayApi } from "../../console/api";
import { EmptyState } from "../../console/page";
import { HeaderActions, HeaderStatus, SaveState } from "../../console/Shell";
import { useAction, useFeedback } from "../../console/ui";
import EditorMap from "../EditorMap";
import { floorLabel } from "../FloorList";
import { ClickLayer, lucideSvg, mapColors, PlacesLayer, selectedNodeIcon, signIcon } from "../layers";
import { useWorkspace } from "../Workspace";

type Tool = "select" | "draw" | "link" | "connector" | "erase";
const TOOLS: [Tool, string, string, LucideIcon][] = [
    ["select", "Chọn và kéo", "V", MousePointer2], ["draw", "Vẽ nút và cạnh", "N", Spline], ["link", "Nối hai nút", "L", Link2],
    ["connector", "Thang, nối tầng", "T", ArrowUpDown], ["erase", "Xoá nút, cắt cạnh", "C", Eraser]
];
const HINTS: Partial<Record<Tool, string>> = {
    link: "Bấm hai nút để nối, bấm lại để gỡ cạnh",
    connector: "Bấm một nút để đánh dấu là thang",
    erase: "Bấm nút để xoá, bấm cạnh để cắt"
};

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
                {dirty && <Button variant="outline" onClick={() => void discard()}>Bỏ thay đổi</Button>}
                <Button disabled={!dirty || busy} title={dirty ? undefined : "Chưa có thay đổi"} onClick={() => void save()}>Lưu mạng lối đi</Button>
            </HeaderActions>
        </>
    );

    if (!floor || !floorId) {
        return (
            <div className="mx-auto w-full max-w-3xl px-6 py-6">
                {header}
                <EmptyState icon={<Layers />} title="Chưa có tầng" description="Thêm toà nhà và tầng trước, rồi vẽ lối đi trên mặt bằng."
                    action={<Button asChild><Link to={`/builder/v/${venueId}/buildings`}>Thêm toà nhà và tầng</Link></Button>} />
            </div>
        );
    }

    const selectFloor = (id: number) => {
        setParams({ floor: String(id) });
        setSelected(null);
        setLinkFloor("");
    };
    const qrState = node && qr.selected.includes(node.id) ? (qr.posted.includes(node.id) ? "Đã dán" : qr.printed.includes(node.id) ? "Đã in" : "Đã tạo") : null;
    const c = mapColors();
    const hint = HINTS[tool];

    return (
        <div className="flex min-h-0 flex-1">
            {header}
            {/* Trái: số liệu, kiểm tra đồ thị, hiển thị */}
            <aside aria-label="Kiểm tra đồ thị" className="flex w-64 shrink-0 flex-col border-r bg-background">
                <div className="grid grid-cols-3 gap-2 border-b p-3">
                    {([["nút", floorNodes.length], ["cạnh", floorEdges.length], ["mét", Math.round(floorMeters)]] as const).map(([label, n]) => (
                        <div key={label} className="rounded-md bg-muted/50 px-2 py-1.5">
                            <p className="text-base font-semibold tabular-nums">{n.toLocaleString("vi-VN")}</p>
                            <p className="text-xs text-muted-foreground">{label}</p>
                        </div>
                    ))}
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-2">
                    <p className="px-2 pt-1 pb-2 text-xs font-medium text-muted-foreground">Kiểm tra tầng này</p>
                    {strayOnFloor.length ? (
                        <CheckRow tone="destructive" label={`${strayOnFloor.length} nút thuộc mảnh rời`} onClick={() => setFocus({ key: Date.now(), points: strayOnFloor })} />
                    ) : <CheckRow tone="success" label="Liền mạch" />}
                    {unreachableOnFloor.length ? (
                        <CheckRow tone="warning" label={`${unreachableOnFloor.length} điểm chưa nối lối đi`} onClick={() => setFocus({ key: Date.now(), points: unreachableOnFloor })} />
                    ) : <CheckRow tone="success" label="Mọi điểm tới được" />}
                    {connectorsOnFloor.length > 0 && (looseOnFloor
                        ? <CheckRow tone="warning" label={`${connectorsOnFloor.length - looseOnFloor}/${connectorsOnFloor.length} thang đã nối tầng`} />
                        : <CheckRow tone="success" label={`${connectorsOnFloor.length}/${connectorsOnFloor.length} thang đã nối tầng`} />)}
                    {buildingFloors.length > 1 && connectorsOnFloor.length === 0 && <CheckRow tone="warning" label="Tầng này chưa có nút thang" />}
                    <Button asChild variant="ghost" size="sm" className="mt-1 w-full justify-start text-muted-foreground">
                        <Link to={`/builder/v/${venueId}/test`}><Route />Thử chỉ đường</Link>
                    </Button>
                </div>
                <div className="space-y-3 border-t p-3">
                    <p className="text-xs font-medium text-muted-foreground">Hiển thị</p>
                    <div className="flex items-center justify-between">
                        <Label htmlFor="ww-snap" className="font-normal">Bắt dính nút ≤ 1,5 m</Label>
                        <Switch id="ww-snap" checked={snap} onCheckedChange={setSnap} />
                    </div>
                    <div className="flex items-center justify-between">
                        <Label htmlFor="ww-places" className="font-normal">Điểm quan tâm</Label>
                        <Switch id="ww-places" checked={showPlaces} onCheckedChange={setShowPlaces} />
                    </div>
                    <ul className="space-y-1.5 pt-1 text-xs text-muted-foreground">
                        <li className="flex items-center gap-2"><span aria-hidden="true" className="h-0.5 w-5 rounded-full" style={{ background: c.graphite }} />Lối đi</li>
                        <li className="flex items-center gap-2"><span aria-hidden="true" className="w-5 border-t-2 border-dashed" style={{ borderColor: c.danger }} />Mảnh rời</li>
                        <li className="flex items-center gap-2"><span aria-hidden="true" className="w-5 border-t-2 border-dotted" style={{ borderColor: c.warn }} />Thang chưa nối tầng</li>
                    </ul>
                </div>
            </aside>

            {/* Giữa: mặt bằng */}
            <section aria-label="Canvas lối đi" className="relative min-w-0 flex-1 bg-muted/40 [&_.cb-map]:absolute [&_.cb-map]:inset-0 [&_.cb-map]:min-h-0">
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

                {/* chọn toà + tầng */}
                <div className="absolute top-3 left-3 z-[800] flex max-w-[calc(100%-7rem)] items-center gap-2 rounded-lg border bg-background p-1 shadow-sm">
                    {model.buildings.length > 1 && (
                        <Select value={String(floor.buildingId)} onValueChange={v => { const first = model.floorsOf(Number(v))[0]; if (first) selectFloor(first.id); }}>
                            <SelectTrigger size="sm" className="border-0 shadow-none" aria-label="Toà nhà"><SelectValue /></SelectTrigger>
                            <SelectContent>{model.buildings.filter(b => model.floorsOf(b.id).length).map(b => <SelectItem key={b.id} value={String(b.id)}>{b.code} {b.name}</SelectItem>)}</SelectContent>
                        </Select>
                    )}
                    <ToggleGroup type="single" size="sm" value={String(floorId)} onValueChange={v => v && selectFloor(Number(v))} aria-label="Tầng" className="overflow-x-auto">
                        {buildingFloors.map(f => (
                            <ToggleGroupItem key={f.id} value={String(f.id)} className="px-2.5 whitespace-nowrap data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">{f.name}</ToggleGroupItem>
                        ))}
                    </ToggleGroup>
                </div>

                {/* hoàn tác, làm lại */}
                <div role="toolbar" aria-label="Hoàn tác" className="absolute top-3 right-3 z-[800] flex items-center gap-1 rounded-lg border bg-background p-1 shadow-sm">
                    <ToolButton icon={Undo2} label="Hoàn tác (Ctrl+Z)" disabled={!history.length} onClick={undo} side="bottom" />
                    <ToolButton icon={Redo2} label="Làm lại (Ctrl+Shift+Z)" disabled={!future.length} onClick={redo} side="bottom" />
                </div>

                {hint && (
                    <div className="absolute top-16 left-1/2 z-[800] flex -translate-x-1/2 items-center gap-3 rounded-full bg-primary px-4 py-1.5 text-sm text-primary-foreground shadow-md">
                        {hint}
                        <Button size="sm" variant="ghost" className="h-6 rounded-full px-2 hover:bg-white/10 hover:text-primary-foreground" onClick={() => setTool("draw")}>Xong</Button>
                    </div>
                )}

                {/* thanh công cụ */}
                <div role="toolbar" aria-label="Công cụ vẽ" className="absolute bottom-4 left-1/2 z-[800] flex -translate-x-1/2 items-center gap-1 rounded-lg border bg-background p-1 shadow-md">
                    {TOOLS.map(([t, label, key, icon], i) => (
                        <span key={t} className="contents">
                            {i === 1 && <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-5" />}
                            <ToolButton icon={icon} label={`${label} (${key})`} shortcut={key} pressed={tool === t} onClick={() => setTool(t)} />
                        </span>
                    ))}
                </div>
            </section>

            {/* Phải: thuộc tính nút */}
            <aside aria-label="Thuộc tính" className="flex w-80 shrink-0 flex-col border-l bg-background">
                {node ? (
                    <>
                        <div className="flex items-start gap-2 border-b p-4">
                            <div className="min-w-0 flex-1">
                                <h2 className="text-base font-semibold">{node.connector ?? "Nút lối đi"}</h2>
                                <p className="mt-1 truncate text-xs text-muted-foreground" title={node.id}>{floorLabel(model, model.floorsById.get(node.floorId))}, {node.id}</p>
                            </div>
                            <Button type="button" variant="ghost" size="icon" className="size-8" aria-label="Bỏ chọn" onClick={() => setSelected(null)}><X /></Button>
                        </div>
                        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
                            <div className="grid gap-2">
                                <Label>Loại nút</Label>
                                <ToggleGroup type="single" variant="outline" size="sm" spacing={1} value={node.connector ?? "none"} aria-label="Loại nút"
                                    onValueChange={v => v && setConnector(v === "none" ? undefined : v)} className="grid w-full grid-cols-2">
                                    {[["none", "Lối đi thường"], ...CONNECTORS.map(x => [x, x])].map(([value, label]) => (
                                        <ToggleGroupItem key={value} value={value!} className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">{label}</ToggleGroupItem>
                                    ))}
                                </ToggleGroup>
                            </div>
                            {node.connector && (
                                <div className="grid gap-2">
                                    <Label>Nối tầng</Label>
                                    {otherFloorLinks.map(n => (
                                        <div key={n.id} className="flex items-center gap-2 rounded-md bg-muted/50 py-1 pr-1 pl-3 text-sm">
                                            <span className="min-w-0 flex-1 truncate" title={n.id}>{floorLabel(model, model.floorsById.get(n.floorId), " ")}</span>
                                            <Badge className="gap-1 bg-success/10 text-success"><Check />Đã nối</Badge>
                                            <Button type="button" variant="ghost" size="sm" className="h-7"
                                                onClick={() => change(x => ({ ...x, edges: x.edges.filter(e => edgeKey(e.from, e.to) !== edgeKey(node.id, n.id)) }))}>Gỡ</Button>
                                        </div>
                                    ))}
                                    {!otherFloorLinks.length && <Badge className="gap-1 bg-warning/10 text-warning"><TriangleAlert />Chưa nối sang tầng nào</Badge>}
                                    <Select value={linkFloor === "" ? "" : String(linkFloor)} onValueChange={v => setLinkFloor(v ? Number(v) : "")}>
                                        <SelectTrigger size="sm" className="w-full" aria-label="Tầng cần nối"><SelectValue placeholder="Chọn tầng cần nối" /></SelectTrigger>
                                        <SelectContent>{sameBuildingFloors.map(f => <SelectItem key={f.id} value={String(f.id)}>{f.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                    {linkFloor !== "" && (
                                        <div className="grid gap-1">
                                            <Button type="button" variant="outline" size="sm" onClick={createStacked}>Tạo nút thang cùng vị trí</Button>
                                            {linkCandidates.map(({ n, d }) => (
                                                <button key={n.id} type="button" onClick={() => linkTo(n)}
                                                    className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-muted">
                                                    <span className="min-w-0 flex-1 truncate">{n.id}</span>
                                                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{n.connector ?? "lối đi"}, {d.toFixed(1)} m</span>
                                                </button>
                                            ))}
                                            {!linkCandidates.length && <p className="px-2 text-xs text-muted-foreground">Tầng đó chưa có nút nào.</p>}
                                        </div>
                                    )}
                                </div>
                            )}
                            <div className="grid gap-2">
                                <Label>Mã QR</Label>
                                <div className="flex items-center gap-2 rounded-md border py-1 pr-1 pl-3 text-sm">
                                    <span className={`min-w-0 flex-1 truncate ${qrState ? "font-medium" : "text-muted-foreground"}`}>{qrState ? node.id : "Chưa có mã"}</span>
                                    {qrState && <span className="text-xs text-muted-foreground">{qrState}</span>}
                                    <Button asChild variant="ghost" size="sm" className="h-7"><Link to={`/builder/v/${venueId}/qr?floor=${node.floorId}`}>Quản lý</Link></Button>
                                </div>
                            </div>
                            <dl className="grid grid-cols-[4.5rem_1fr] gap-y-1 rounded-lg bg-muted/50 px-3 py-2 text-xs">
                                <dt className="text-muted-foreground">Toạ độ</dt><dd className="tabular-nums">{node.lat.toFixed(6)}, {node.lng.toFixed(6)}</dd>
                                <dt className="text-muted-foreground">Nối với</dt><dd className="tabular-nums">{neighbors.length} nút</dd>
                            </dl>
                        </div>
                        <div className="flex items-center gap-2 border-t p-3">
                            <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => void deleteSelected()}><Trash2 />Xoá nút</Button>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center gap-2 p-4 pt-14 text-center">
                        <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Spline className="size-5" /></span>
                        <p className="text-sm font-medium">Chưa chọn nút</p>
                        <p className="text-sm text-muted-foreground">Bấm dọc hành lang để vẽ, chọn một nút để sửa thang và nối tầng.</p>
                    </div>
                )}
            </aside>
        </div>
    );
}

const TONE = {
    success: { icon: Check, className: "text-success" },
    warning: { icon: TriangleAlert, className: "text-warning" },
    destructive: { icon: CircleAlert, className: "text-destructive" }
};

/** Một dòng kết quả kiểm tra đồ thị; có onClick thì bấm để phóng tới chỗ lỗi */
function CheckRow({ tone, label, onClick }: { tone: keyof typeof TONE; label: string; onClick?: () => void }) {
    const { icon: Icon, className } = TONE[tone];
    const body = <><Icon className={`size-4 shrink-0 ${className}`} /><span className="min-w-0 flex-1 truncate">{label}</span></>;
    if (!onClick) return <div className="flex h-8 items-center gap-2 px-2 text-sm">{body}</div>;
    return (
        <button type="button" title="Xem trên mặt bằng" onClick={onClick} className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-muted">{body}</button>
    );
}

function ToolButton({ icon: Icon, label, shortcut, pressed, disabled, side = "top", onClick }: {
    icon: LucideIcon; label: string; shortcut?: string; pressed?: boolean; disabled?: boolean; side?: "top" | "bottom"; onClick(): void;
}) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button type="button" variant={pressed ? "default" : "ghost"} size="icon" className="size-8" aria-label={label} aria-pressed={pressed} aria-keyshortcuts={shortcut}
                    disabled={disabled} onClick={onClick}><Icon /></Button>
            </TooltipTrigger>
            <TooltipContent side={side}>{label}</TooltipContent>
        </Tooltip>
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
                    icon: selectedNodeIcon(),
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
