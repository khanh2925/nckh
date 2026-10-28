import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { analyzeVenue, normalizeText, type LatLng, type LocationDto, type ZoneDto } from "@indoor-map/core";
import { locationApi, planApi } from "../../console/api";
import { HeaderActions, HeaderStatus, SaveState } from "../../console/Shell";
import { Button, COLORS, ColorPicker, useAction, useFeedback } from "../../console/ui";
import Lc, { type LucideName } from "../../design/Lc";
import EditorMap from "../EditorMap";
import { floorLabel, FloorChips, GuestLink } from "../FloorList";
import { ClickLayer, DraftPolygonLayer, DropLayer, PlacesLayer, WalkwayPreviewLayer, ZonesLayer } from "../layers";
import { useWorkspace } from "../Workspace";
import "./workspace.css";

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

    const header = (
        <>
            <HeaderStatus><SaveState state={busy ? "saving" : dirty ? "dirty" : "saved"} /></HeaderStatus>
            <HeaderActions>
                <GuestLink venue={data.venue} />
                <Button variant="primary" busy={busy} disabled={!canSave} title={canSave ? undefined : dirty ? "Cần đặt tên trước khi lưu" : "Chưa có thay đổi"} onClick={save}>Lưu bản nháp</Button>
            </HeaderActions>
        </>
    );

    if (!floor || !floorId) {
        return (
            <div className="k-page">
                {header}
                <section className="k-card ws-empty">
                    <h2 className="k16">Chưa có tầng</h2>
                    <p className="k14 k-m">Thêm toà nhà và tầng trước, rồi đặt điểm lên mặt bằng.</p>
                    <div className="ws-mt8"><Button variant="primary" to={`${base}/buildings`}>Thêm toà nhà và tầng</Button></div>
                </section>
            </div>
        );
    }

    const typeName = editing ? model.typeOf(editing.type).name : "";
    const facilities = editing ? [...new Set([...data.facilities.map(f => f.name), ...(editing.facilities ?? [])])] : [];

    return (
        <div className="ws-work">
            {header}
            <aside aria-label="Thêm vào bản đồ" className="ws-panel is-left">
                <label className="k-input ws-search">
                    <Lc name="search" size={16} />
                    <input aria-label="Tìm loại điểm" placeholder="Tìm loại điểm" value={query} onChange={e => setQuery(e.target.value)} />
                </label>
                <section className="ws-grp">
                    <h2 className="k-sec">Loại điểm</h2>
                    <div>
                        {types.map(t => (
                            <button key={t.code} type="button" className="ws-tl" draggable aria-pressed={tool === "point" && pendingType === t.code}
                                title="Kéo vào mặt bằng, hoặc bấm rồi bấm vào mặt bằng"
                                onDragStart={e => { e.dataTransfer.setData("text/plain", t.code); e.dataTransfer.effectAllowed = "copy"; }}
                                onClick={() => (tool === "point" && pendingType === t.code ? armTool("select") : armTool("point", t.code))}>
                                <span aria-hidden="true" className="ws-tile" style={{ background: t.color || "var(--muted)" }}><i className={`bi ${t.icon || "bi-geo-alt"}`} /></span>
                                <span className="ws-ellipsis">{t.name}</span>
                                {typeCounts.get(t.code) ? <span className="n k12 k-m">{typeCounts.get(t.code)}</span> : null}
                            </button>
                        ))}
                        {!types.length && <p className="k14 k-m" style={{ padding: 8 }}>Không có loại nào khớp.</p>}
                    </div>
                    <Link to={`${base}/types`} className="k-btn t sm" style={{ alignSelf: "flex-start", paddingLeft: 8 }}><Lc name="plus" size={16} />Thêm loại</Link>
                </section>
                <section className="ws-grp">
                    <h2 className="k-sec">Vẽ</h2>
                    <div>
                        <button type="button" className="ws-tl" aria-pressed={tool === "zone"} disabled={!projection} title={projection ? "Bấm từng góc, bấm lại góc đầu để khép" : "Cần mặt bằng đã căn chỉnh"}
                            onClick={() => armTool(tool === "zone" ? "select" : "zone")}>
                            <Lc name="pentagon" size={16} />Vùng
                        </button>
                        <Link to={`${base}/import?floor=${floorId}`} className="ws-tl"><Lc name="download" size={16} />Nhập từ CSV, GeoJSON</Link>
                    </div>
                </section>
                <section className="ws-grp">
                    <h2 className="k-sec">Hiển thị</h2>
                    <div>
                        <label className="k-line k14" style={{ minHeight: 32 }}><input type="checkbox" className="k-check" checked={show.places} onChange={e => setShow(s => ({ ...s, places: e.target.checked }))} />Điểm quan tâm</label>
                        <label className="k-line k14" style={{ minHeight: 32 }}><input type="checkbox" className="k-check" checked={show.zones} onChange={e => setShow(s => ({ ...s, zones: e.target.checked }))} />Vùng</label>
                        <label className="k-line k14" style={{ minHeight: 32 }}><input type="checkbox" className="k-check" checked={show.walkways} onChange={e => setShow(s => ({ ...s, walkways: e.target.checked }))} />Lối đi, chỉ xem</label>
                    </div>
                    <label htmlFor="type-filter" className="k-label">Loại trên bản đồ</label>
                    <select id="type-filter" className="k-input" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                        <option value="">Mọi loại ({floorPlaces})</option>
                        {floorTypes.map(code => <option key={code} value={code}>{model.typeOf(code).name}</option>)}
                    </select>
                </section>
            </aside>

            <section className="ws-canvas" aria-label="Canvas mặt bằng">
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
                <FloorChips model={model} floorId={floorId} onSelect={id => void selectFloor(id)} />
                {cursor && <div className="ws-float is-tr k12 k-m" style={{ padding: "8px 12px" }}>{cursorXY ? `x ${Math.round(cursorXY.x)}, y ${Math.round(cursorXY.y)}` : `${cursor.lat.toFixed(6)}, ${cursor.lng.toFixed(6)}`}</div>}

                {floorPlaces === 0 && !editing && !zoneDraft && tool === "select" && (
                    <div role="region" aria-labelledby="ed-empty" className="k-card ws-overcard">
                        <h2 id="ed-empty" className="k16">{floor.name} chưa có điểm nào</h2>
                        <p className="k14 k-m">Kéo một loại điểm vào mặt bằng, hoặc nhập nhiều điểm từ tệp.</p>
                        <div className="ws-mt8"><Link to={`${base}/import?floor=${floorId}`} className="k-btn"><Lc name="download" size={16} />Nhập từ CSV</Link></div>
                    </div>
                )}

                {tool === "point" && <div className="ws-float is-hint is-low">Bấm vào mặt bằng để đặt {model.typeOf(pendingType ?? "other").name.toLowerCase()}</div>}
                {tool === "zone" && (
                    <div className="ws-float is-hint is-low">
                        Bấm từng góc của vùng, bấm lại góc đầu để khép ({zonePoints.length} góc)
                        <button type="button" className="k-btn sm" disabled={zonePoints.length < 3} onClick={finishZone}>Xong</button>
                    </div>
                )}

                <div role="toolbar" aria-label="Công cụ" className="ws-float is-bc">
                    <ToolButton icon="mouse-pointer-2" label="Chọn, kéo để dời" pressed={tool === "select"} onClick={() => armTool("select")} />
                    <ToolButton icon="map-pin-plus" label="Thêm điểm" pressed={tool === "point"} onClick={() => armTool(tool === "point" ? "select" : "point", pendingType)} />
                    <ToolButton icon="pentagon" label={projection ? "Vẽ vùng" : "Vẽ vùng: cần mặt bằng đã căn chỉnh"} pressed={tool === "zone"} disabled={!projection} onClick={() => armTool(tool === "zone" ? "select" : "zone")} />
                </div>

                {(floorUnreachable.length + floorIsolated > 0 || !projection) && (
                    <div className="ws-float is-br" style={{ flexDirection: "column", alignItems: "stretch" }}>
                        {floorUnreachable.length + floorIsolated > 0 && (
                            <Link to={`${base}/walkways?floor=${floorId}`} className="k-btn t sm"><Lc name="triangle-alert" size={16} color="var(--warn)" /><span className="k-warn">{floorUnreachable.length + floorIsolated} điểm chưa tới được</span></Link>
                        )}
                        {!projection && <Link to={`${base}/plan?floor=${floorId}`} className="k-btn t sm"><Lc name="triangle-alert" size={16} color="var(--warn)" /><span className="k-warn">Tầng chưa căn chỉnh mặt bằng</span></Link>}
                    </div>
                )}
            </section>

            <aside aria-label="Thuộc tính" className="ws-panel is-right">
                {editing ? (
                    <>
                        <div className="ws-phead">
                            <input aria-label="Tên điểm" className="ws-name" placeholder="Tên điểm" autoFocus={!editing.id} value={editing.name ?? ""} onChange={e => setDraft({ name: e.target.value })} />
                            <span className="k12 k-m">{editing.id ? `${typeName}, ${floorLabel(model, floor)}` : `Điểm mới, ${floorLabel(model, floor)}`}</span>
                        </div>
                        <form className="ws-pbody" onSubmit={e => { e.preventDefault(); if (canSave) save(); }}>
                            <div className="k-grid2">
                                <div className="k-field"><label htmlFor="pl-type">Loại</label>
                                    <select id="pl-type" className="k-input" value={editing.type ?? "other"} onChange={e => setDraft({ type: e.target.value })}>
                                        {!data.types.some(t => t.code === (editing.type ?? "other")) && <option value={editing.type ?? "other"}>{typeName}</option>}
                                        {data.types.map(t => <option key={t.code} value={t.code}>{t.name}</option>)}
                                    </select>
                                </div>
                                <div className="k-field"><label htmlFor="pl-area">Khu vực</label><input id="pl-area" className="k-input" value={editing.area ?? ""} placeholder="Sảnh A" onChange={e => setDraft({ area: e.target.value })} /></div>
                            </div>
                            <div className="k-grid2">
                                <div className="k-field"><label htmlFor="pl-hours">Giờ mở cửa</label><input id="pl-hours" className="k-input" value={editing.openingHours ?? ""} placeholder="05:00–22:00" onChange={e => setDraft({ openingHours: e.target.value })} /></div>
                                <div className="k-field"><label htmlFor="pl-phone">Điện thoại</label><input id="pl-phone" type="tel" className="k-input" value={editing.phone ?? ""} placeholder="028 …" onChange={e => setDraft({ phone: e.target.value })} /></div>
                            </div>
                            <div className="k-field"><label htmlFor="pl-desc">Mô tả</label><textarea id="pl-desc" rows={2} className="k-input" value={editing.description ?? ""} onChange={e => setDraft({ description: e.target.value })} /></div>
                            <fieldset className="k-field ws-fs0">
                                <legend className="k-label">Tiện ích</legend>
                                {facilities.map(name => {
                                    const on = editing.facilities?.includes(name) ?? false;
                                    return (
                                        <label key={name} className="k-line k14" style={{ minHeight: 28 }}>
                                            <input type="checkbox" className="k-check" checked={on} onChange={() => setDraft({ facilities: on ? (editing.facilities ?? []).filter(f => f !== name) : [...(editing.facilities ?? []), name] })} />{name}
                                        </label>
                                    );
                                })}
                                <div className="k-line">
                                    <input className="k-input" style={{ height: 32 }} aria-label="Tiện ích mới" placeholder="Thêm tiện ích" value={newFacility} onChange={e => setNewFacility(e.target.value)} />
                                    <button type="button" className="k-btn sm" disabled={!newFacility.trim()} onClick={() => { setDraft({ facilities: [...new Set([...(editing.facilities ?? []), newFacility.trim()])] }); setNewFacility(""); }}>Thêm</button>
                                </div>
                            </fieldset>
                            <div className="k-field"><label htmlFor="pl-img">Ảnh</label><input id="pl-img" type="url" className="k-input" value={editing.imageUrl ?? ""} placeholder="Dán đường dẫn ảnh" onChange={e => setDraft({ imageUrl: e.target.value })} /></div>
                            <div className="k-field"><label htmlFor="pl-web">Trang web</label><input id="pl-web" type="url" className="k-input" value={editing.website ?? ""} onChange={e => setDraft({ website: e.target.value })} /></div>
                            <div>
                                {editing.x != null && <div className="k-row"><span className="k12 k-m" style={{ width: 64 }}>Vị trí</span><span className="k14">x {Math.round(editing.x)}, y {Math.round(editing.y ?? 0)}</span></div>}
                                <div className="k-row"><span className="k12 k-m" style={{ width: 64 }}>Toạ độ</span><span className="k14">{editing.lat.toFixed(5)}, {editing.lng.toFixed(5)}</span></div>
                            </div>
                            <p className="k12 k-m">Kéo ô biển trên mặt bằng để dời điểm.</p>
                            <button type="submit" hidden />
                        </form>
                        <div className="ws-pfoot">
                            <button type="button" className="k-btn d sm" style={{ paddingLeft: 0 }} onClick={() => void removePlace()}><Lc name="trash" size={16} />{editing.id ? "Xoá điểm…" : "Bỏ điểm mới"}</button>
                            <button type="button" className="k-btn t sm ws-right" onClick={() => void leaveSelection().then(ok => ok && setSelection(null))}>Đóng</button>
                        </div>
                    </>
                ) : zoneDraft ? (
                    <>
                        <div className="ws-phead">
                            <input aria-label="Tên vùng" className="ws-name" placeholder="Tên vùng" autoFocus={!zoneDraft.id} value={zoneDraft.name ?? ""} onChange={e => setZone({ name: e.target.value })} />
                            <span className="k12 k-m">{zoneDraft.id ? "Vùng" : "Vùng mới"}, {floorLabel(model, floor)}</span>
                        </div>
                        <form className="ws-pbody" onSubmit={e => { e.preventDefault(); if (canSave) save(); }}>
                            <ColorPicker label="Màu nền" value={zoneDraft.color ?? COLORS[1]!} onChange={c => setZone({ color: c })} />
                            <div className="k-row"><span className="k12 k-m" style={{ width: 64 }}>Góc</span><span className="k14">{zoneDraft.polygon?.length ?? 0} góc, toạ độ pixel bản vẽ</span></div>
                            <button type="submit" hidden />
                        </form>
                        <div className="ws-pfoot">
                            <button type="button" className="k-btn d sm" style={{ paddingLeft: 0 }} onClick={() => void removeZone()}><Lc name="trash" size={16} />{zoneDraft.id ? "Xoá vùng…" : "Bỏ vùng mới"}</button>
                            <button type="button" className="k-btn t sm ws-right" onClick={() => void leaveSelection().then(ok => ok && setSelection(null))}>Đóng</button>
                        </div>
                    </>
                ) : (
                    <div className="ws-pidle">
                        <p className="k14 k-m">Chọn một điểm trên mặt bằng để sửa thuộc tính.</p>
                        {floorUnreachable.length > 0 && (
                            <div className="ws-grp" style={{ textAlign: "left" }}>
                                <span className="k-label">Chưa có lối đi gần</span>
                                <div>
                                    {floorUnreachable.slice(0, 8).map(p => (
                                        <button key={p.id} type="button" className="ws-tl" onClick={() => void selectPlace(p.id)}><span className="ws-ellipsis">{p.name}</span></button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </aside>
        </div>
    );
}

function ToolButton({ icon, label, pressed, disabled, onClick }: { icon: LucideName; label: string; pressed: boolean; disabled?: boolean; onClick(): void }) {
    return (
        <button type="button" className="k-ib sm t" aria-label={label} title={label} aria-pressed={pressed} disabled={disabled} onClick={onClick}>
            <Lc name={icon} size={16} />
        </button>
    );
}
