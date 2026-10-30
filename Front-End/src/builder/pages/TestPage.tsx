import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type * as Leaflet from "leaflet";
import { distance, formatMeters, planRoute, searchPlaces, type Place, type PlannedRoute, type StepKind } from "@indoor-map/core";
import {
    ArrowDownUp, ArrowRight, ArrowUp, ArrowUpDown, ArrowUpLeft, ArrowUpRight, ChevronsUp, CircleAlert, CornerUpLeft, CornerUpRight, Flag, ListChecks, Navigation,
    Route, Spline, TriangleAlert, type LucideIcon
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import L from "../../lib/leaflet";
import { HeaderActions } from "../../console/Shell";
import EditorMap from "../EditorMap";
import { floorLabel } from "../FloorList";
import { mapColors, signIcon } from "../layers";
import { useWorkspace } from "../Workspace";

const STEP_ICON: Record<StepKind, LucideIcon> = {
    depart: Navigation, straight: ArrowUp, left: CornerUpLeft, right: CornerUpRight, "slight-left": ArrowUpLeft, "slight-right": ArrowUpRight,
    uturn: CornerUpLeft, "floor-up": ChevronsUp, "floor-down": ArrowUpDown, arrive: Flag
};
const DETOUR = 1.8;

function PlacePicker({ label, value, onChange }: { label: string; value: Place | null; onChange(p: Place): void }) {
    const { model } = useWorkspace();
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const hits = useMemo(() => (query ? searchPlaces(model, query, { limit: 8 }) : []), [model, query]);
    const id = `pick-${label}`;
    return (
        <div className="relative grid gap-2">
            <Label htmlFor={id}>{label}</Label>
            <Input id={id} className="h-8" autoComplete="off" role="combobox" aria-expanded={open && hits.length > 0}
                value={open ? query : value ? `${value.name}, ${floorLabel(model, model.floorsById.get(value.floorId))}` : ""}
                placeholder="Gõ tên địa điểm" onFocus={() => { setOpen(true); setQuery(""); }} onBlur={() => window.setTimeout(() => setOpen(false), 150)} onChange={e => setQuery(e.target.value)} />
            {open && hits.length > 0 && (
                <ul role="listbox" className="absolute top-full right-0 left-0 z-50 mt-1 max-h-72 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
                    {hits.map(({ place }) => (
                        <li key={place.id}>
                            <button type="button" role="option" aria-selected={false} onMouseDown={() => { onChange(place); setOpen(false); }}
                                className="flex w-full flex-col items-start rounded-sm px-2 py-1.5 text-left hover:bg-accent hover:text-accent-foreground">
                                <span className="w-full truncate text-sm font-medium">{place.name}</span>
                                <span className="text-xs text-muted-foreground">{floorLabel(model, model.floorsById.get(place.floorId))}</span>
                            </button>
                        </li>
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

    const turnWarning = route?.steps.some(s => (s.kind === "left" || s.kind === "right") && !s.title.includes(" tại "));
    const c = mapColors();
    const single = tab === "single";
    const fallbackFloor = model.defaultFloor?.id ?? null;
    const mapFloor = single ? shownLeg?.floorId ?? from?.floorId ?? fallbackFloor : pairRoute?.legs[0]?.floorId ?? pair?.from.floorId ?? fallbackFloor;
    const fitKey = single ? `s-${from?.id}-${to?.id}-${legIndex}` : pair ? `b-${pair.from.id}-${pair.to.id}` : "b-none";
    const filters: [PairFilter, string, number][] = pairs
        ? [["bad", "Có lỗi", failed.length + detours.length], ["none", "Không có đường", failed.length], ["detour", "Đi vòng", detours.length], ["ok", "Đạt", passed.length], ["all", "Tất cả", pairs.length]]
        : [];

    return (
        <div className="flex min-h-0 flex-1">
            {!single && (
                <HeaderActions>
                    <Button disabled={model.locations.length < 2} onClick={runPairs}>{pairs ? "Chạy lại 50 cặp" : "Chạy 50 cặp"}</Button>
                </HeaderActions>
            )}

            {/* Trái: cách thử và điều kiện */}
            <aside aria-label="Cách thử" className="flex w-64 shrink-0 flex-col border-r bg-background">
                <div className="border-b p-3">
                    <Tabs value={tab} onValueChange={v => setTab(v as "single" | "batch")}>
                        <TabsList className="w-full" aria-label="Cách thử">
                            <TabsTrigger value="single">Một tuyến</TabsTrigger>
                            <TabsTrigger value="batch">Hàng loạt</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
                {single ? (
                    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
                        <PlacePicker label="Từ" value={from} onChange={p => { setFrom(p); setLeg(0); }} />
                        <PlacePicker label="Đến" value={to} onChange={p => { setTo(p); setLeg(0); }} />
                        <Button variant="outline" size="sm" className="w-full" disabled={!from || !to} onClick={() => { setFrom(to); setTo(from); setLeg(0); }}><ArrowDownUp />Đảo chiều</Button>
                        <div className="flex items-center justify-between gap-2">
                            <Label htmlFor="avoid-stairs" className="font-normal">Tránh thang cuốn, thang bộ</Label>
                            <Switch id="avoid-stairs" checked={avoidStairs} onCheckedChange={setAvoidStairs} />
                        </div>
                    </div>
                ) : (
                    <div className="min-h-0 flex-1 overflow-y-auto p-2">
                        <p className="px-2 pt-1 pb-2 text-xs font-medium text-muted-foreground">Lọc kết quả</p>
                        {pairs ? filters.map(([value, label, n]) => (
                            <button key={value} type="button" aria-pressed={filter === value} onClick={() => { setFilter(value); setPairIndex(0); }}
                                className={`flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm ${filter === value ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted"}`}>
                                <span className="min-w-0 flex-1 truncate">{label}</span>
                                <span className={`text-xs tabular-nums ${filter === value ? "" : "text-muted-foreground"}`}>{n}</span>
                            </button>
                        )) : <p className="px-2 py-2 text-sm text-muted-foreground">Chưa chạy.</p>}
                    </div>
                )}
                <div className="space-y-1 border-t p-3 text-xs text-muted-foreground">
                    {single
                        ? <p>{data.walkways.nodes.length.toLocaleString("vi-VN")} nút lối đi, chưa cần xuất bản</p>
                        : <p><span className="font-medium text-foreground">Đi vòng</span> là dài hơn 1,8 lần đường chim bay</p>}
                </div>
            </aside>

            {/* Giữa: tuyến trên mặt bằng */}
            <section aria-label="Tuyến trên mặt bằng" className="relative min-w-0 flex-1 bg-muted/40 [&_.cb-map]:absolute [&_.cb-map]:inset-0 [&_.cb-map]:min-h-0">
                <EditorMap model={model} floorId={mapFloor} fitKey={fitKey}>
                    {map => single
                        ? <RouteLayer key="single" map={map} route={route} legIndex={legIndex} from={from} to={to} />
                        : <RouteLayer key="batch" map={map} route={pairRoute} legIndex={0} from={pair?.from ?? null} to={pair?.to ?? null} straight />}
                </EditorMap>

                {single ? (
                    <div className="absolute top-3 left-3 z-[800] flex max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-lg border bg-background p-1 shadow-sm">
                        {route && route.legs.length > 1 ? (
                            <ToggleGroup type="single" size="sm" value={String(legIndex)} onValueChange={v => v && setLeg(Number(v))} aria-label="Chặng" className="overflow-x-auto">
                                {route.legs.map((l, i) => (
                                    <ToggleGroupItem key={i} value={String(i)} className="px-2.5 whitespace-nowrap data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                                        Chặng {i + 1}, {floorLabel(model, model.floorsById.get(l.floorId), " ")}
                                    </ToggleGroupItem>
                                ))}
                            </ToggleGroup>
                        ) : <span className="px-2 py-1 text-sm">{route ? floorLabel(model, model.floorsById.get(route.legs[0]!.floorId)) : "Chọn điểm đi và điểm đến"}</span>}
                    </div>
                ) : pair && (
                    <>
                        <div className="absolute top-3 left-3 z-[800] flex max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-lg border bg-background py-1 pr-1 pl-3 shadow-sm">
                            <PairTitle pair={pair} className="text-sm font-medium" />
                            <PairBadge pair={pair} />
                            <Button asChild variant="ghost" size="sm"><Link to={`/builder/v/${venueId}/walkways?floor=${pair.from.floorId}`}><Spline />Sửa lối đi</Link></Button>
                        </div>
                        <ul className="absolute bottom-4 left-4 z-[800] space-y-1.5 rounded-lg border bg-background px-3 py-2 text-xs shadow-sm">
                            {pair.meters != null && (
                                <li className="flex items-center gap-2">
                                    <span aria-hidden="true" className="h-1 w-5 rounded-full" style={{ background: c.signal, boxShadow: `0 0 0 1px ${c.graphite}` }} />Tuyến {pair.meters} m
                                </li>
                            )}
                            <li className="flex items-center gap-2"><span aria-hidden="true" className="w-5 border-t-2 border-dashed" style={{ borderColor: c.danger }} />Chim bay {Math.round(pair.straight)} m</li>
                        </ul>
                    </>
                )}
            </section>

            {/* Phải: chỉ dẫn từng bước, hoặc danh sách cặp */}
            <aside aria-label={single ? "Tuyến thử" : "Kết quả hàng loạt"} className="flex w-80 shrink-0 flex-col border-l bg-background">
                {single ? (
                    route ? (
                        <>
                            <div className="grid grid-cols-3 gap-2 border-b p-4">
                                <Num label="Dài" value={`${route.distance} m`} />
                                <Num label="Ước tính" value={`${Math.max(1, Math.round(route.seconds / 60))} phút`} />
                                <Num label="Đổi tầng" value={String(route.legs.length - 1)} />
                            </div>
                            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
                                <ol className="space-y-1">
                                    {route.steps.map((s, i) => {
                                        const Icon = STEP_ICON[s.kind];
                                        return (
                                            <li key={i} className="flex items-start gap-3 py-1.5">
                                                <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"><Icon className="size-4" /></span>
                                                <div className="min-w-0">
                                                    <p className="text-sm">{s.title}</p>
                                                    <p className="text-xs text-muted-foreground">{s.kind.startsWith("floor") ? s.detail : s.distance ? formatMeters(s.distance) : s.detail}</p>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ol>
                                {turnWarning && (
                                    <Alert>
                                        <TriangleAlert className="text-warning" />
                                        <AlertDescription>Có lượt rẽ không có mốc gần, khách chỉ thấy “Rẽ trái”. Thêm một điểm dễ thấy gần đó.</AlertDescription>
                                    </Alert>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col gap-4 p-4">
                            {result && "error" in result && (
                                <Alert variant="destructive">
                                    <CircleAlert />
                                    <AlertDescription>{result.error}</AlertDescription>
                                </Alert>
                            )}
                            {!result && <Idle icon={Route} title="Chưa có tuyến" text="Chọn điểm đi và điểm đến." />}
                        </div>
                    )
                ) : pairs ? (
                    <>
                        <div className="border-b p-4">
                            <h2 className="text-base font-semibold">{listed.length} cặp</h2>
                            {ranAt && <p className="mt-1 text-xs text-muted-foreground">Chạy lúc {ranAt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</p>}
                        </div>
                        <ul className="min-h-0 flex-1 overflow-y-auto p-2">
                            {listed.map((p, i) => (
                                <li key={`${p.from.id}-${p.to.id}-${i}`}>
                                    <button type="button" aria-pressed={p === pair} onClick={() => setPairIndex(i)}
                                        className={`flex w-full items-start gap-2 rounded-md px-2 py-2 text-left ${p === pair ? "bg-primary/10" : "hover:bg-muted"}`}>
                                        <span className="min-w-0 flex-1">
                                            <PairTitle pair={p} className={`text-sm ${p === pair ? "font-medium text-primary" : ""}`} />
                                            <span className="block truncate text-xs text-muted-foreground">{p.ok ? `${p.meters} m` : p.error}</span>
                                        </span>
                                        <PairStatus pair={p} />
                                    </button>
                                </li>
                            ))}
                            {!listed.length && <li className="px-2 py-4 text-sm text-muted-foreground">Không có cặp nào trong nhóm này.</li>}
                        </ul>
                    </>
                ) : (
                    <Idle icon={ListChecks} title="Chưa chạy" text="Chạy 50 cặp ngẫu nhiên để tìm chỗ lối đi bị đứt hoặc đi vòng." />
                )}
            </aside>
        </div>
    );
}

function Num({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-md bg-muted/50 px-2 py-1.5">
            <p className="text-base font-semibold tabular-nums">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
        </div>
    );
}

function Idle({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
    return (
        <div className="flex flex-col items-center gap-2 p-4 pt-14 text-center">
            <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Icon className="size-5" /></span>
            <p className="text-sm font-medium">{title}</p>
            <p className="text-sm text-muted-foreground">{text}</p>
        </div>
    );
}

function PairTitle({ pair, className = "" }: { pair: PairResult; className?: string }) {
    return (
        <span className={`flex min-w-0 items-center gap-1 ${className}`}>
            <span className="truncate">{pair.from.name}</span>
            <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" aria-label="đến" />
            <span className="truncate">{pair.to.name}</span>
        </span>
    );
}

const detourText = (p: PairResult) => `Đi vòng ${p.detour!.toFixed(1).replace(".", ",")}×`;

function PairBadge({ pair }: { pair: PairResult }) {
    if (!pair.ok) return <Badge className="bg-destructive/10 text-destructive">Không có đường</Badge>;
    if ((pair.detour ?? 1) > DETOUR) return <Badge className="bg-warning/10 text-warning">{detourText(pair)}</Badge>;
    return <Badge className="bg-success/10 text-success">Đạt</Badge>;
}

function PairStatus({ pair }: { pair: PairResult }) {
    if (!pair.ok) return <span className="shrink-0 text-xs font-medium text-destructive">Không có đường</span>;
    if ((pair.detour ?? 1) > DETOUR) return <span className="shrink-0 text-xs font-medium text-warning">{detourText(pair)}</span>;
    return <span className="shrink-0 text-xs text-muted-foreground">Đạt</span>;
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
