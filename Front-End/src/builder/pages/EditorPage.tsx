import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { analyzeVenue, normalizeText, type LatLng, type LocationDto, type ZoneDto } from "@indoor-map/core";
import { locationApi, planApi } from "../../console/api";
import { Download, Layers, MapPinPlus, MousePointer2, Pentagon, Plus, Search, Trash2, TriangleAlert, X, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState } from "../../console/page";
import { HeaderStatus, SaveState } from "../../console/Shell";
import { COLORS, useAction, useFeedback } from "../../console/ui";
import EditorMap from "../EditorMap";
import { floorLabel } from "../FloorList";
import { ClickLayer, DraftPolygonLayer, DropLayer, PlacesLayer, WalkwayPreviewLayer, ZonesLayer } from "../layers";
import { useWorkspace } from "../Workspace";

type Tool = "select" | "point" | "zone";
type PlaceDraft = Partial<LocationDto> & { floorId: number; lat: number; lng: number };
type ZoneDraft = Partial<ZoneDto> & { floorId: number };
type Selection =
    | { kind: "place"; draft: PlaceDraft; original: string | null }
    | { kind: "zone"; draft: ZoneDraft; original: string | null }
    | null;

const snapshot = (value: unknown) => JSON.stringify(value);

// Điểm và vùng: panel trái thêm vào bản đồ (kéo loại điểm, vẽ vùng), canvas mặt bằng, panel phải thuộc tính.
export default function EditorPage() {
    const { venueId, data, model, patch } = useWorkspace();
    const { confirm } = useFeedback();
    const { busy, run } = useAction();
    const [params, setParams] = useSearchParams();
    const floorId = Number(params.get("floor")) || model.defaultFloor?.id || model.floors[0]?.id || null;
    const floor = floorId ? model.floorsById.get(floorId) : undefined;
    const projection = floor?.projection ?? null;
    const [tool, setTool] = useState<Tool>("select");
    const [pendingType, setPendingType] = useState<string | null>(null);
    const [selection, setSelection] = useState<Selection>(null);
    const [zonePoints, setZonePoints] = useState<LatLng[]>([]);
    const [show, setShow] = useState({ places: true, zones: true, walkways: false });
    const [typeFilter, setTypeFilter] = useState("");
    const [query, setQuery] = useState("");
    const [cursor, setCursor] = useState<LatLng | null>(null);
    const [newFacility, setNewFacility] = useState("");
    const report = useMemo(() => analyzeVenue(model), [model]);

    const places = useMemo(
        () => model.locations.filter(l => l.floorId === floorId && (!typeFilter || l.type === typeFilter)),
        [model, floorId, typeFilter]
    );
    const editing = selection?.kind === "place" ? selection.draft : null;
    const zoneDraft = selection?.kind === "zone" ? selection.draft : null;
    const dirty = selection ? selection.original === null || snapshot(selection.draft) !== selection.original : false;
    const shownPlaces = useMemo(() => {
        if (!editing) return places;
        const others = places.filter(p => p.id !== editing.id);
        return [...others, { ...editing, id: editing.id ?? -1, name: editing.name || "Điểm mới" } as (typeof places)[number]];
    }, [places, editing]);

    const typeCounts = useMemo(() => {
        const map = new Map<string, number>();
        model.locations.forEach(l => l.floorId === floorId && map.set(l.type ?? "other", (map.get(l.type ?? "other") ?? 0) + 1));
        return map;
    }, [model, floorId]);
    const types = useMemo(() => {
        const q = normalizeText(query);
        return [...data.types].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)).filter(t => !q || normalizeText(t.name).includes(q) || t.code.includes(q));
    }, [data.types, query]);

    const leaveSelection = async () => {
        if (!dirty) return true;
        return confirm("Bỏ thay đổi chưa lưu?", { detail: "Thuộc tính vừa sửa của mục đang chọn sẽ mất.", okLabel: "Bỏ thay đổi", danger: true });
    };

    const selectFloor = async (id: number) => {
        if (!(await leaveSelection())) return;
        setParams({ floor: String(id) });
        setSelection(null);
        setZonePoints([]);
    };

    const withPixels = (lat: number, lng: number) => {
        const xy = projection?.toImage({ lat, lng });
        return { lat, lng, ...(xy ? { x: Math.round(xy.x * 10) / 10, y: Math.round(xy.y * 10) / 10 } : {}) };
    };

    const startPlace = (ll: LatLng, type: string) => {
        if (!floorId) return;
        setSelection({ kind: "place", draft: { floorId, name: "", type, ...withPixels(ll.lat, ll.lng) }, original: null });
        setTool("select");
        setPendingType(null);
    };

    const onMapClick = (ll: LatLng) => {
        if (!floorId) return;
        if (tool === "point") startPlace(ll, pendingType ?? "other");
        else if (tool === "zone") setZonePoints(pts => [...pts, { lat: ll.lat, lng: ll.lng }]);
        else if (!dirty) setSelection(null);
    };

    const selectPlace = async (id: number) => {
        if (editing?.id === id) return;
        if (!(await leaveSelection())) return;
        const loc = data.locations.find(l => l.id === id);
        const place = model.locationsById.get(id);
        if (!loc || !place) return;
        const draft = { ...loc, lat: place.lat, lng: place.lng, floorId: place.floorId };
        setSelection({ kind: "place", draft, original: snapshot(draft) });
    };

    const selectZone = async (id: number) => {
        if (!(await leaveSelection())) return;
        const z = data.zones.find(x => x.id === id);
        if (z) setSelection({ kind: "zone", draft: { ...z }, original: snapshot(z) });
    };

    const movePlace = (_id: number, ll: LatLng) => {
        setSelection(s => (s?.kind === "place" ? { ...s, draft: { ...s.draft, ...withPixels(ll.lat, ll.lng) } } : s));
    };

    const finishZone = () => {
        if (!floorId || zonePoints.length < 3 || !projection) return;
        const polygon = zonePoints.map(p => {
            const xy = projection.toImage(p);
            return [Math.round(xy.x * 10) / 10, Math.round(xy.y * 10) / 10] as [number, number];
        });
        setSelection({ kind: "zone", draft: { floorId, name: "", color: COLORS[1], polygon }, original: null });
        setZonePoints([]);
        setTool("select");
    };

    const savePlace = async () => {
        if (!editing) return;
        const body: Partial<LocationDto> = {
            floorId: editing.floorId, name: editing.name?.trim(), type: editing.type, lat: editing.lat, lng: editing.lng, x: editing.x, y: editing.y,
            area: editing.area?.trim() || undefined, description: editing.description?.trim() || undefined, openingHours: editing.openingHours?.trim() || undefined,
            phone: editing.phone?.trim() || undefined, website: editing.website?.trim() || undefined, imageUrl: editing.imageUrl?.trim() || undefined,
            facilities: editing.facilities
        };
        const saved = await run(() => (editing.id ? locationApi.update(venueId, editing.id, body) : locationApi.create(venueId, body)), editing.id ? "Đã lưu điểm" : "Đã thêm điểm");
        if (!saved) return;
        patch("locations", editing.id ? data.locations.map(l => (l.id === saved.id ? saved : l)) : [...data.locations, saved]);
        const draft = { ...saved, lat: saved.lat ?? editing.lat, lng: saved.lng ?? editing.lng, floorId: saved.floorId };
        setSelection({ kind: "place", draft, original: snapshot(draft) });
    };

    const removePlace = async () => {
        if (!editing?.id) return setSelection(null);
        if (!(await confirm(`Xoá “${editing.name}”?`, { danger: true, okLabel: "Xoá điểm" }))) return;
        if (await run(() => locationApi.remove(venueId, editing.id!), "Đã xoá điểm") !== null) {
            patch("locations", data.locations.filter(l => l.id !== editing.id));
            setSelection(null);
        }
    };

    const saveZone = async () => {
        if (!zoneDraft) return;
        const body = { floorId: zoneDraft.floorId, name: zoneDraft.name?.trim(), color: zoneDraft.color, polygon: zoneDraft.polygon };
        const saved = await run(() => (zoneDraft.id ? planApi.updateZone(venueId, zoneDraft.id, body) : planApi.createZone(venueId, body)), "Đã lưu vùng");
        if (!saved) return;
        patch("zones", zoneDraft.id ? data.zones.map(z => (z.id === saved.id ? saved : z)) : [...data.zones, saved]);
        setSelection({ kind: "zone", draft: saved, original: snapshot(saved) });
    };
    const removeZone = async () => {
        if (!zoneDraft?.id) return setSelection(null);
        if (!(await confirm(`Xoá vùng “${zoneDraft.name}”?`, { danger: true, okLabel: "Xoá vùng" }))) return;
        if (await run(() => planApi.removeZone(venueId, zoneDraft.id!), "Đã xoá vùng") !== null) {
            patch("zones", data.zones.filter(z => z.id !== zoneDraft.id));
            setSelection(null);
        }
    };

    const setDraft = (value: Partial<LocationDto>) => setSelection(s => (s?.kind === "place" ? { ...s, draft: { ...s.draft, ...value } } : s));
    const setZone = (value: Partial<ZoneDto>) => setSelection(s => (s?.kind === "zone" ? { ...s, draft: { ...s.draft, ...value } } : s));
    const floorUnreachable = report.unreachable.filter(p => p.floorId === floorId);
    const floorIsolated = report.isolated.filter(p => p.floorId === floorId).length;
    const floorPlaces = model.locations.filter(l => l.floorId === floorId).length;
    const floorTypes = useMemo(() => [...new Set(model.locations.filter(l => l.floorId === floorId).map(l => l.type ?? "other"))], [model, floorId]);
    const cursorXY = cursor && projection ? projection.toImage(cursor) : null;
    const canSave = dirty && (editing ? Boolean(editing.name?.trim()) : zoneDraft ? Boolean(zoneDraft.name?.trim()) : false);
    const save = () => void (editing ? savePlace() : saveZone());
    const base = `/builder/v/${venueId}`;

    const armTool = (next: Tool, type: string | null = null) => {
        setTool(next);
        setPendingType(type);
        setZonePoints([]);
    };

    const status = <HeaderStatus><SaveState state={busy ? "saving" : dirty ? "dirty" : "saved"} /></HeaderStatus>;

    if (!floor || !floorId) {
        return (
            <div className="mx-auto w-full max-w-3xl px-6 py-6">
                {status}
                <EmptyState icon={<Layers />} title="Chưa có tầng" description="Thêm toà nhà và tầng trước, rồi đặt điểm lên mặt bằng."
                    action={<Button asChild><Link to={`${base}/buildings`}>Thêm toà nhà và tầng</Link></Button>} />
            </div>
        );
    }

    const typeName = editing ? model.typeOf(editing.type).name : "";
    const facilities = editing ? [...new Set([...data.facilities.map(f => f.name), ...(editing.facilities ?? [])])] : [];
    const building = model.buildings.find(b => b.id === floor.buildingId);
    const close = () => void leaveSelection().then(ok => ok && setSelection(null));

    return (
        <div className="flex min-h-0 flex-1">
            {status}
            {/* Trái: thêm vào bản đồ */}
            <aside aria-label="Thêm vào bản đồ" className="flex w-64 shrink-0 flex-col border-r bg-background">
                <div className="border-b p-3">
                    <div className="relative">
                        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input aria-label="Tìm loại điểm" placeholder="Tìm loại điểm" value={query} onChange={e => setQuery(e.target.value)} className="h-8 pl-8" />
                    </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-2">
                    <p className="px-2 pt-1 pb-2 text-xs font-medium text-muted-foreground">Loại điểm, kéo vào mặt bằng</p>
                    {types.map(t => {
                        const armed = tool === "point" && pendingType === t.code;
                        return (
                            <button key={t.code} type="button" draggable aria-pressed={armed} title="Kéo vào mặt bằng, hoặc bấm rồi bấm vào mặt bằng"
                                onDragStart={e => { e.dataTransfer.setData("text/plain", t.code); e.dataTransfer.effectAllowed = "copy"; }}
                                onClick={() => (armed ? armTool("select") : armTool("point", t.code))}
                                className={`flex h-8 w-full cursor-grab items-center gap-2 rounded-md px-2 text-left text-sm ${armed ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
                                <span aria-hidden="true" className="flex size-5 shrink-0 items-center justify-center rounded text-[11px] text-white" style={{ background: t.color || "#71717a" }}>
                                    <i className={`bi ${t.icon || "bi-geo-alt"}`} />
                                </span>
                                <span className="min-w-0 flex-1 truncate">{t.name}</span>
                                {typeCounts.get(t.code) ? <span className={`text-xs tabular-nums ${armed ? "" : "text-muted-foreground"}`}>{typeCounts.get(t.code)}</span> : null}
                            </button>
                        );
                    })}
                    {!types.length && <p className="px-2 py-4 text-sm text-muted-foreground">Không có loại nào khớp.</p>}
                    <Button asChild variant="ghost" size="sm" className="mt-1 w-full justify-start text-muted-foreground"><Link to={`${base}/types`}><Plus />Thêm loại</Link></Button>
                </div>
                <div className="space-y-3 border-t p-3">
                    <p className="text-xs font-medium text-muted-foreground">Hiển thị</p>
                    {([["places", "Điểm quan tâm"], ["zones", "Vùng"], ["walkways", "Lối đi (chỉ xem)"]] as const).map(([key, label]) => (
                        <div key={key} className="flex items-center justify-between">
                            <Label htmlFor={`show-${key}`} className="font-normal">{label}</Label>
                            <Switch id={`show-${key}`} checked={show[key]} onCheckedChange={v => setShow(s => ({ ...s, [key]: v }))} />
                        </div>
                    ))}
                    <Select value={typeFilter || "all"} onValueChange={v => setTypeFilter(v === "all" ? "" : v)}>
                        <SelectTrigger size="sm" className="w-full" aria-label="Lọc loại trên bản đồ"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Mọi loại ({floorPlaces})</SelectItem>
                            {floorTypes.map(code => <SelectItem key={code} value={code}>{model.typeOf(code).name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </aside>

            {/* Giữa: mặt bằng */}
            <section aria-label="Mặt bằng" className="relative min-w-0 flex-1 bg-muted/40 [&_.cb-map]:absolute [&_.cb-map]:inset-0 [&_.cb-map]:min-h-0">
                <EditorMap model={model} floorId={floorId} onMouseMove={setCursor}>
                    {map => (
                        <>
                            <ClickLayer map={map} onClick={onMapClick} cursor={tool !== "select"} />
                            <DropLayer map={map} onDrop={(code, ll) => startPlace(ll, code)} />
                            {show.walkways && <WalkwayPreviewLayer map={map} network={model.walkways} floorId={floorId} />}
                            {show.zones && <ZonesLayer map={map} zones={data.zones.filter(z => z.floorId === floorId && z.id !== zoneDraft?.id)} projection={projection}
                                selectedId={null} onSelect={id => void selectZone(id)} />}
                            {zoneDraft?.polygon && projection && <ZonesLayer map={map} zones={[{ ...zoneDraft, id: zoneDraft.id ?? -1, name: zoneDraft.name || "Vùng mới", polygon: zoneDraft.polygon } as ZoneDto]} projection={projection} selectedId={zoneDraft.id ?? -1} />}
                            {show.places && <PlacesLayer map={map} places={shownPlaces} typeOf={model.typeOf} selectedId={editing ? editing.id ?? -1 : null}
                                onSelect={id => void selectPlace(id)} onMove={movePlace} draggable />}
                            <DraftPolygonLayer map={map} points={zonePoints} onFirstClick={finishZone} />
                        </>
                    )}
                </EditorMap>

                {/* chọn toà + tầng */}
                <div className="absolute top-3 left-3 z-[800] flex max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-lg border bg-background p-1 shadow-sm">
                    {model.buildings.length > 1 && (
                        <Select value={String(floor.buildingId)} onValueChange={v => { const first = model.floorsOf(Number(v))[0]; if (first) void selectFloor(first.id); }}>
                            <SelectTrigger size="sm" className="border-0 shadow-none" aria-label="Toà nhà"><SelectValue /></SelectTrigger>
                            <SelectContent>{model.buildings.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.code} {b.name}</SelectItem>)}</SelectContent>
                        </Select>
                    )}
                    <ToggleGroup type="single" size="sm" value={String(floorId)} onValueChange={v => v && void selectFloor(Number(v))} aria-label="Tầng" className="overflow-x-auto">
                        {building && model.floorsOf(building.id).map(f => (
                            <ToggleGroupItem key={f.id} value={String(f.id)} className="px-2.5 whitespace-nowrap data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">{f.name}</ToggleGroupItem>
                        ))}
                    </ToggleGroup>
                </div>

                {cursor && (
                    <div className="absolute top-3 right-3 z-[800] rounded-md border bg-background px-2 py-1 text-xs text-muted-foreground tabular-nums shadow-sm">
                        {cursorXY ? `x ${Math.round(cursorXY.x)}, y ${Math.round(cursorXY.y)}` : `${cursor.lat.toFixed(6)}, ${cursor.lng.toFixed(6)}`}
                    </div>
                )}

                {floorPlaces === 0 && !editing && !zoneDraft && tool === "select" && (
                    <div className="absolute top-1/2 left-1/2 z-[800] w-80 -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-5 shadow-lg">
                        <p className="text-sm font-medium">{floor.name} chưa có điểm nào</p>
                        <p className="mt-1 text-sm text-muted-foreground">Kéo một loại điểm vào mặt bằng, hoặc nhập nhiều điểm từ tệp.</p>
                        <Button asChild variant="outline" size="sm" className="mt-4"><Link to={`${base}/import?floor=${floorId}`}><Download />Nhập từ CSV, GeoJSON</Link></Button>
                    </div>
                )}

                {(tool === "point" || tool === "zone") && (
                    <div className="absolute top-16 left-1/2 z-[800] flex -translate-x-1/2 items-center gap-3 rounded-full bg-primary px-4 py-1.5 text-sm text-primary-foreground shadow-md">
                        {tool === "point" ? `Bấm vào mặt bằng để đặt ${model.typeOf(pendingType ?? "other").name.toLowerCase()}` : `Bấm từng góc, bấm lại góc đầu để khép (${zonePoints.length} góc)`}
                        {tool === "zone" && <Button size="sm" variant="secondary" className="h-6 rounded-full px-3" disabled={zonePoints.length < 3} onClick={finishZone}>Xong</Button>}
                        <Button size="sm" variant="ghost" className="h-6 rounded-full px-2 hover:bg-white/10 hover:text-primary-foreground" onClick={() => armTool("select")}>Huỷ</Button>
                    </div>
                )}

                {/* thanh công cụ */}
                <div role="toolbar" aria-label="Công cụ" className="absolute bottom-4 left-1/2 z-[800] flex -translate-x-1/2 items-center gap-1 rounded-lg border bg-background p-1 shadow-md">
                    <ToolButton icon={MousePointer2} label="Chọn, kéo để dời" pressed={tool === "select"} onClick={() => armTool("select")} />
                    <ToolButton icon={MapPinPlus} label="Thêm điểm" pressed={tool === "point"} onClick={() => armTool(tool === "point" ? "select" : "point", pendingType)} />
                    <ToolButton icon={Pentagon} label={projection ? "Vẽ vùng" : "Vẽ vùng: cần mặt bằng đã căn chỉnh"} pressed={tool === "zone"} disabled={!projection} onClick={() => armTool(tool === "zone" ? "select" : "zone")} />
                    <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-5" />
                    <Button asChild variant="ghost" size="sm" className="text-muted-foreground"><Link to={`${base}/import?floor=${floorId}`}><Download />Nhập tệp</Link></Button>
                </div>

                {(floorUnreachable.length + floorIsolated > 0 || !projection) && (
                    <div className="absolute bottom-4 left-4 z-[800] flex flex-col gap-1">
                        {floorUnreachable.length + floorIsolated > 0 && (
                            <Link to={`${base}/walkways?floor=${floorId}`} className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs shadow-sm hover:bg-muted">
                                <TriangleAlert className="size-3.5 text-warning" />{floorUnreachable.length + floorIsolated} điểm chưa tới được
                            </Link>
                        )}
                        {!projection && (
                            <Link to={`${base}/plan?floor=${floorId}`} className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 text-xs shadow-sm hover:bg-muted">
                                <TriangleAlert className="size-3.5 text-warning" />Tầng chưa căn chỉnh mặt bằng
                            </Link>
                        )}
                    </div>
                )}
            </section>

            {/* Phải: thuộc tính */}
            <aside aria-label="Thuộc tính" className="flex w-80 shrink-0 flex-col border-l bg-background">
                {editing ? (
                    <form className="flex min-h-0 flex-1 flex-col" onSubmit={e => { e.preventDefault(); if (canSave) save(); }}>
                        <div className="flex items-start gap-2 border-b p-4">
                            <div className="min-w-0 flex-1">
                                <Input aria-label="Tên điểm" placeholder="Tên điểm" autoFocus={!editing.id} value={editing.name ?? ""} onChange={e => setDraft({ name: e.target.value })}
                                    className="h-8 border-transparent px-1.5 text-base font-semibold shadow-none hover:border-input focus-visible:border-ring md:text-base" />
                                <p className="mt-1 px-1.5 text-xs text-muted-foreground">{editing.id ? typeName : "Điểm mới"}, {floorLabel(model, floor)}</p>
                            </div>
                            <Button type="button" variant="ghost" size="icon" className="size-8" aria-label="Đóng" onClick={close}><X /></Button>
                        </div>
                        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="grid gap-1.5">
                                    <Label>Loại</Label>
                                    <Select value={editing.type ?? "other"} onValueChange={v => setDraft({ type: v })}>
                                        <SelectTrigger size="sm" className="w-full"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {!data.types.some(t => t.code === (editing.type ?? "other")) && <SelectItem value={editing.type ?? "other"}>{typeName}</SelectItem>}
                                            {data.types.map(t => <SelectItem key={t.code} value={t.code}>{t.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Field id="pl-area" label="Khu vực" value={editing.area} placeholder="Sảnh A" onChange={v => setDraft({ area: v })} />
                                <Field id="pl-hours" label="Giờ mở cửa" value={editing.openingHours} placeholder="05:00–22:00" onChange={v => setDraft({ openingHours: v })} />
                                <Field id="pl-phone" label="Điện thoại" type="tel" value={editing.phone} placeholder="028 …" onChange={v => setDraft({ phone: v })} />
                            </div>
                            <div className="grid gap-1.5">
                                <Label htmlFor="pl-desc">Mô tả</Label>
                                <Textarea id="pl-desc" rows={2} className="min-h-16" value={editing.description ?? ""} onChange={e => setDraft({ description: e.target.value })} />
                            </div>
                            <div className="grid gap-2">
                                <Label>Tiện ích</Label>
                                <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                                    {facilities.map(name => {
                                        const on = editing.facilities?.includes(name) ?? false;
                                        return (
                                            <label key={name} className="flex items-center gap-2 text-sm">
                                                <Checkbox checked={on} onCheckedChange={() => setDraft({ facilities: on ? (editing.facilities ?? []).filter(f => f !== name) : [...(editing.facilities ?? []), name] })} />
                                                <span className="truncate">{name}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                                <div className="flex gap-2">
                                    <Input className="h-8" aria-label="Tiện ích mới" placeholder="Thêm tiện ích" value={newFacility} onChange={e => setNewFacility(e.target.value)} />
                                    <Button type="button" variant="outline" size="sm" disabled={!newFacility.trim()} onClick={() => { setDraft({ facilities: [...new Set([...(editing.facilities ?? []), newFacility.trim()])] }); setNewFacility(""); }}>Thêm</Button>
                                </div>
                            </div>
                            <Field id="pl-img" label="Ảnh" type="url" value={editing.imageUrl} placeholder="Dán đường dẫn ảnh" onChange={v => setDraft({ imageUrl: v })} />
                            <Field id="pl-web" label="Trang web" type="url" value={editing.website} onChange={v => setDraft({ website: v })} />
                            <dl className="grid grid-cols-[4.5rem_1fr] gap-y-1 rounded-lg bg-muted/50 px-3 py-2 text-xs">
                                {editing.x != null && <><dt className="text-muted-foreground">Bản vẽ</dt><dd className="tabular-nums">x {Math.round(editing.x)}, y {Math.round(editing.y ?? 0)}</dd></>}
                                <dt className="text-muted-foreground">Toạ độ</dt><dd className="tabular-nums">{editing.lat.toFixed(5)}, {editing.lng.toFixed(5)}</dd>
                            </dl>
                        </div>
                        <div className="flex items-center gap-2 border-t p-3">
                            <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => void removePlace()}><Trash2 />{editing.id ? "Xoá" : "Bỏ"}</Button>
                            <Button type="submit" size="sm" className="ml-auto" disabled={!canSave} title={canSave ? undefined : dirty ? "Cần đặt tên trước khi lưu" : "Chưa có thay đổi"}>Lưu điểm</Button>
                        </div>
                    </form>
                ) : zoneDraft ? (
                    <form className="flex min-h-0 flex-1 flex-col" onSubmit={e => { e.preventDefault(); if (canSave) save(); }}>
                        <div className="flex items-start gap-2 border-b p-4">
                            <div className="min-w-0 flex-1">
                                <Input aria-label="Tên vùng" placeholder="Tên vùng" autoFocus={!zoneDraft.id} value={zoneDraft.name ?? ""} onChange={e => setZone({ name: e.target.value })}
                                    className="h-8 border-transparent px-1.5 text-base font-semibold shadow-none hover:border-input focus-visible:border-ring md:text-base" />
                                <p className="mt-1 px-1.5 text-xs text-muted-foreground">{zoneDraft.id ? "Vùng" : "Vùng mới"}, {floorLabel(model, floor)}</p>
                            </div>
                            <Button type="button" variant="ghost" size="icon" className="size-8" aria-label="Đóng" onClick={close}><X /></Button>
                        </div>
                        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
                            <div className="grid gap-2">
                                <Label>Màu nền</Label>
                                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Màu nền">
                                    {COLORS.map(c => (
                                        <button key={c} type="button" role="radio" aria-checked={(zoneDraft.color ?? "").toLowerCase() === c} aria-label={c}
                                            className="size-6 rounded-md ring-offset-2 ring-offset-background aria-checked:ring-2 aria-checked:ring-ring" style={{ background: c }} onClick={() => setZone({ color: c })} />
                                    ))}
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground">{zoneDraft.polygon?.length ?? 0} góc, toạ độ theo pixel bản vẽ.</p>
                        </div>
                        <div className="flex items-center gap-2 border-t p-3">
                            <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => void removeZone()}><Trash2 />{zoneDraft.id ? "Xoá" : "Bỏ"}</Button>
                            <Button type="submit" size="sm" className="ml-auto" disabled={!canSave}>Lưu vùng</Button>
                        </div>
                    </form>
                ) : (
                    <div className="flex flex-1 flex-col gap-6 p-4">
                        <div className="flex flex-col items-center gap-2 pt-10 text-center">
                            <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground"><MousePointer2 className="size-5" /></span>
                            <p className="text-sm font-medium">Chưa chọn gì</p>
                            <p className="text-sm text-muted-foreground">Bấm một điểm hoặc vùng trên mặt bằng để sửa.</p>
                        </div>
                        {floorUnreachable.length > 0 && (
                            <div>
                                <p className="mb-1 px-2 text-xs font-medium text-muted-foreground">Chưa có lối đi gần ({floorUnreachable.length})</p>
                                {floorUnreachable.slice(0, 8).map(p => (
                                    <button key={p.id} type="button" className="flex h-8 w-full items-center rounded-md px-2 text-left text-sm hover:bg-muted" onClick={() => void selectPlace(p.id)}>
                                        <span className="truncate">{p.name}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </aside>
        </div>
    );
}

function Field({ id, label, value, onChange, placeholder, type = "text" }: { id: string; label: string; value?: string | null; onChange(v: string): void; placeholder?: string; type?: string }) {
    return (
        <div className="grid gap-1.5">
            <Label htmlFor={id}>{label}</Label>
            <Input id={id} type={type} className="h-8" value={value ?? ""} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
        </div>
    );
}

function ToolButton({ icon: Icon, label, pressed, disabled, onClick }: { icon: LucideIcon; label: string; pressed: boolean; disabled?: boolean; onClick(): void }) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button type="button" variant={pressed ? "default" : "ghost"} size="icon" className="size-8" aria-label={label} aria-pressed={pressed} disabled={disabled} onClick={onClick}><Icon /></Button>
            </TooltipTrigger>
            <TooltipContent side="top">{label}</TooltipContent>
        </Tooltip>
    );
}
