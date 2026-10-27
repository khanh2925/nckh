import { useCallback, useMemo, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { analyzeVenue, type LatLng, type LocationDto, type ZoneDto } from "@indoor-map/core";
import { locationApi, planApi } from "../../console/api";
import { Button, Check, ColorPicker, Field, Select, Status, TextArea, useAction, useFeedback } from "../../console/ui";
import EditorMap from "../EditorMap";
import FloorList from "../FloorList";
import { ClickLayer, DraftPolygonLayer, PlacesLayer, WalkwayPreviewLayer, ZonesLayer } from "../layers";
import { useWorkspace } from "../Workspace";

type Tool = "select" | "point" | "zone";
type Selection = { kind: "place"; draft: Partial<LocationDto> & { floorId: number; lat: number; lng: number } } | { kind: "zone"; draft: Partial<ZoneDto> & { floorId: number } } | null;

// Điểm & vùng: chấm điểm quan tâm, kéo để dời, vẽ vùng; thuộc tính ở cột phải; kiểm tra dữ liệu ở thanh dưới.
export default function EditorPage() {
    const { venueId, data, model, patch } = useWorkspace();
    const { confirm } = useFeedback();
    const { busy, run } = useAction();
    const [params, setParams] = useSearchParams();
    const floorId = Number(params.get("floor")) || model.defaultFloor?.id || model.floors[0]?.id || null;
    const floor = floorId ? model.floorsById.get(floorId) : undefined;
    const projection = floor?.projection ?? null;
    const [tool, setTool] = useState<Tool>("select");
    const [selection, setSelection] = useState<Selection>(null);
    const [zonePoints, setZonePoints] = useState<LatLng[]>([]);
    const [show, setShow] = useState({ places: true, zones: true, walkways: false });
    const [typeFilter, setTypeFilter] = useState("");
    const [cursor, setCursor] = useState<LatLng | null>(null);
    const [newFacility, setNewFacility] = useState("");
    const report = useMemo(() => analyzeVenue(model), [model]);

    const places = useMemo(
        () => model.locations.filter(l => l.floorId === floorId && (!typeFilter || l.type === typeFilter)),
        [model, floorId, typeFilter]
    );
    const editing = selection?.kind === "place" ? selection.draft : null;
    const shownPlaces = useMemo(() => {
        if (!editing) return places;
        const others = places.filter(p => p.id !== editing.id);
        return [...others, { ...editing, id: editing.id ?? -1, name: editing.name || "Điểm mới" } as (typeof places)[number]];
    }, [places, editing]);

    const selectFloor = (id: number) => {
        setParams({ floor: String(id) });
        setSelection(null);
        setZonePoints([]);
    };

    const withPixels = (lat: number, lng: number) => {
        const xy = projection?.toImage({ lat, lng });
        return { lat, lng, ...(xy ? { x: Math.round(xy.x * 10) / 10, y: Math.round(xy.y * 10) / 10 } : {}) };
    };

    const onMapClick = useCallback((ll: { lat: number; lng: number }) => {
        if (!floorId) return;
        if (tool === "point") {
            setSelection({ kind: "place", draft: { floorId, name: "", type: "other", ...withPixels(ll.lat, ll.lng) } });
            setTool("select");
        } else if (tool === "zone") {
            setZonePoints(pts => [...pts, { lat: ll.lat, lng: ll.lng }]);
        } else {
            setSelection(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tool, floorId, projection]);

    const selectPlace = useCallback((id: number) => {
        const loc = data.locations.find(l => l.id === id);
        const place = model.locationsById.get(id);
        if (loc && place) setSelection({ kind: "place", draft: { ...loc, lat: place.lat, lng: place.lng, floorId: place.floorId } });
    }, [data.locations, model]);

    const movePlace = useCallback((_id: number, ll: { lat: number; lng: number }) => {
        setSelection(s => (s?.kind === "place" ? { kind: "place", draft: { ...s.draft, ...withPixels(ll.lat, ll.lng) } } : s));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projection]);

    const finishZone = () => {
        if (!floorId || zonePoints.length < 3 || !projection) return;
        const polygon = zonePoints.map(p => {
            const xy = projection.toImage(p);
            return [Math.round(xy.x * 10) / 10, Math.round(xy.y * 10) / 10] as [number, number];
        });
        setSelection({ kind: "zone", draft: { floorId, name: "", color: "#2d5be3", polygon } });
        setZonePoints([]);
        setTool("select");
    };

    const savePlace = async (e: FormEvent) => {
        e.preventDefault();
        if (!editing) return;
        const body: Partial<LocationDto> = {
            floorId: editing.floorId, name: editing.name?.trim(), type: editing.type, lat: editing.lat, lng: editing.lng, x: editing.x, y: editing.y,
            area: editing.area?.trim() || undefined, description: editing.description?.trim() || undefined, openingHours: editing.openingHours?.trim() || undefined,
            phone: editing.phone?.trim() || undefined, website: editing.website?.trim() || undefined, facilities: editing.facilities
        };
        const saved = await run(() => (editing.id ? locationApi.update(venueId, editing.id, body) : locationApi.create(venueId, body)), editing.id ? "Đã lưu địa điểm" : "Đã thêm địa điểm");
        if (!saved) return;
        patch("locations", editing.id ? data.locations.map(l => (l.id === saved.id ? saved : l)) : [...data.locations, saved]);
        setSelection({ kind: "place", draft: { ...saved, lat: saved.lat ?? editing.lat, lng: saved.lng ?? editing.lng, floorId: saved.floorId } });
    };

    const removePlace = async () => {
        if (!editing?.id) return setSelection(null);
        if (!(await confirm(`Xoá “${editing.name}”?`, { danger: true, okLabel: "Xoá" }))) return;
        if (await run(() => locationApi.remove(venueId, editing.id!), "Đã xoá địa điểm") !== null) {
            patch("locations", data.locations.filter(l => l.id !== editing.id));
            setSelection(null);
        }
    };

    const zoneDraft = selection?.kind === "zone" ? selection.draft : null;
    const saveZone = async (e: FormEvent) => {
        e.preventDefault();
        if (!zoneDraft) return;
        const body = { floorId: zoneDraft.floorId, name: zoneDraft.name?.trim(), color: zoneDraft.color, polygon: zoneDraft.polygon };
        const saved = await run(() => (zoneDraft.id ? planApi.updateZone(venueId, zoneDraft.id, body) : planApi.createZone(venueId, body)), "Đã lưu vùng");
        if (!saved) return;
        patch("zones", zoneDraft.id ? data.zones.map(z => (z.id === saved.id ? saved : z)) : [...data.zones, saved]);
        setSelection({ kind: "zone", draft: saved });
    };
    const removeZone = async () => {
        if (!zoneDraft?.id) return setSelection(null);
        if (!(await confirm(`Xoá vùng “${zoneDraft.name}”?`, { danger: true, okLabel: "Xoá" }))) return;
        if (await run(() => planApi.removeZone(venueId, zoneDraft.id!), "Đã xoá vùng") !== null) {
            patch("zones", data.zones.filter(z => z.id !== zoneDraft.id));
            setSelection(null);
        }
    };

    const setDraft = (patchValue: Partial<LocationDto>) => setSelection(s => (s?.kind === "place" ? { kind: "place", draft: { ...s.draft, ...patchValue } } : s));
    const floorUnreachable = report.unreachable.filter(p => p.floorId === floorId).length;
    const floorIsolated = report.isolated.filter(p => p.floorId === floorId).length;
    const floorPlaces = model.locations.filter(l => l.floorId === floorId).length;
    const floorTypes = useMemo(() => [...new Set(model.locations.filter(l => l.floorId === floorId).map(l => l.type ?? "other"))], [model, floorId]);
    const cursorXY = cursor && projection ? projection.toImage(cursor) : null;

    if (!floor || !floorId) {
        return <div className="cb-main"><div className="cb-empty"><div className="cb-h3">Chưa có tầng</div><Button variant="primary" to={`/builder/v/${venueId}/buildings`}>Thêm toà nhà & tầng →</Button></div></div>;
    }

    return (
        <div className="cb-work">
            <aside className="cb-side">
                <FloorList model={model} floorId={floorId} onSelect={selectFloor} count={id => model.locationCount.get(id) ?? 0} />
                <div className="cb-side-section">
                    <span className="cb-label">Lớp hiển thị</span>
                    <Check label="Điểm quan tâm" checked={show.places} onChange={v => setShow(s => ({ ...s, places: v }))} />
                    <Check label="Vùng" checked={show.zones} onChange={v => setShow(s => ({ ...s, zones: v }))} />
                    <Check label="Lối đi (chỉ xem)" checked={show.walkways} onChange={v => setShow(s => ({ ...s, walkways: v }))} />
                    <Select label="Lọc theo loại" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                        <option value="">Mọi loại ({floorPlaces})</option>
                        {floorTypes.map(code => <option key={code} value={code}>{model.typeOf(code).name}</option>)}
                    </Select>
                </div>
            </aside>

            <section className="cb-canvas" aria-label="Canvas mặt bằng">
                <EditorMap model={model} floorId={floorId} onMouseMove={setCursor}>
                    {map => (
                        <>
                            <ClickLayer map={map} onClick={onMapClick} cursor={tool !== "select"} />
                            {show.walkways && <WalkwayPreviewLayer map={map} network={model.walkways} floorId={floorId} />}
                            {show.zones && <ZonesLayer map={map} zones={data.zones.filter(z => z.floorId === floorId && z.id !== zoneDraft?.id)} projection={projection}
                                selectedId={null} onSelect={id => { const z = data.zones.find(x => x.id === id); if (z) setSelection({ kind: "zone", draft: { ...z } }); }} />}
                            {zoneDraft?.polygon && projection && <ZonesLayer map={map} zones={[{ ...zoneDraft, id: zoneDraft.id ?? -1, name: zoneDraft.name || "Vùng mới", polygon: zoneDraft.polygon } as ZoneDto]} projection={projection} selectedId={zoneDraft.id ?? -1} />}
                            {show.places && <PlacesLayer map={map} places={shownPlaces} typeOf={model.typeOf} selectedId={editing ? editing.id ?? -1 : null}
                                onSelect={selectPlace} onMove={movePlace} draggable />}
                            <DraftPolygonLayer map={map} points={zonePoints} onFirstClick={finishZone} />
                        </>
                    )}
                </EditorMap>
                <div className="cb-canvas-tools" role="toolbar" aria-label="Công cụ">
                    <button type="button" aria-pressed={tool === "select"} onClick={() => { setTool("select"); setZonePoints([]); }} title="Chọn / kéo để dời"><i className="bi bi-cursor" aria-hidden="true" /> Chọn</button>
                    <button type="button" aria-pressed={tool === "point"} onClick={() => setTool("point")} title="Thêm điểm quan tâm"><i className="bi bi-geo-alt" aria-hidden="true" /> Thêm điểm</button>
                    <button type="button" aria-pressed={tool === "zone"} onClick={() => setTool("zone")} disabled={!projection} title={projection ? "Vẽ vùng" : "Cần mặt bằng đã căn chỉnh"}><i className="bi bi-pentagon" aria-hidden="true" /> Vẽ vùng</button>
                    <span className="sep" />
                    <Link to={`/builder/v/${venueId}/import?floor=${floorId}`} className="cb-btn cb-btn-ghost is-small"><i className="bi bi-filetype-csv" aria-hidden="true" /> Nhập CSV</Link>
                </div>
                <div className="cb-coord">{cursor ? `${cursorXY ? `x ${Math.round(cursorXY.x)} · y ${Math.round(cursorXY.y)} · ` : ""}${cursor.lat.toFixed(6)}, ${cursor.lng.toFixed(6)}` : floor.name}</div>
                {tool === "point" && <div className="cb-hint">Bấm vào bản vẽ để đặt điểm quan tâm mới</div>}
                {tool === "zone" && (
                    <div className="cb-hint" style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        Bấm từng góc của vùng ({zonePoints.length} đỉnh) · bấm lại đỉnh đầu để khép
                        <button type="button" className="cb-btn is-small" disabled={zonePoints.length < 3} onClick={finishZone}>Xong</button>
                    </div>
                )}
                <div className="cb-checkbar">
                    <span className="cb-checkbar-title">Kiểm tra dữ liệu · {floor.name}</span>
                    <span>{floorPlaces} địa điểm</span>
                    {floorUnreachable ? <Status kind="err">{floorUnreachable} điểm không có lối đi trong 60 m</Status> : <Status kind="ok">Mọi điểm có lối đi gần</Status>}
                    {floorIsolated ? <Status kind="warn">{floorIsolated} điểm nối vào mảnh lối đi rời</Status> : null}
                    {!projection && <Status kind="warn">Tầng chưa căn chỉnh mặt bằng</Status>}
                    <Link to={`/builder/v/${venueId}/walkways?floor=${floorId}`} style={{ marginLeft: "auto", fontWeight: 500 }}>Sửa lối đi →</Link>
                </div>
            </section>

            <aside className="cb-side is-right">
                {editing ? (
                    <form className="cb-pad cb-form" onSubmit={savePlace}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <h2 className="cb-h3">{editing.id ? "Điểm quan tâm" : "Điểm mới"}</h2>
                            <Button small variant="danger" onClick={() => void removePlace()}>{editing.id ? "Xoá" : "Bỏ"}</Button>
                        </div>
                        <Field label="Tên" required autoFocus={!editing.id} value={editing.name ?? ""} onChange={e => setDraft({ name: e.target.value })} />
                        <Select label="Loại địa điểm" value={editing.type ?? "other"} onChange={e => setDraft({ type: e.target.value })}>
                            {data.types.map(t => <option key={t.code} value={t.code}>{t.name}</option>)}
                        </Select>
                        <div className="cb-kv cb-mono" style={{ fontSize: 12 }}>
                            {editing.x != null && <><span>x · y (px)</span><span>{editing.x} · {editing.y}</span></>}
                            <span>lat · lng</span><span>{editing.lat.toFixed(6)} · {editing.lng.toFixed(6)}</span>
                        </div>
                        <p className="cb-muted" style={{ fontSize: 12 }}>Kéo biểu tượng trên bản đồ để dời vị trí.</p>
                        <Field label="Khu vực" value={editing.area ?? ""} onChange={e => setDraft({ area: e.target.value })} placeholder="Khu cách ly, Sảnh A…" />
                        <TextArea label="Mô tả" value={editing.description ?? ""} onChange={e => setDraft({ description: e.target.value })} />
                        <Field label="Giờ mở cửa" value={editing.openingHours ?? ""} onChange={e => setDraft({ openingHours: e.target.value })} placeholder="05:00–22:00" />
                        <div className="cb-grid-2">
                            <Field label="Điện thoại" value={editing.phone ?? ""} onChange={e => setDraft({ phone: e.target.value })} />
                            <Field label="Website" value={editing.website ?? ""} onChange={e => setDraft({ website: e.target.value })} />
                        </div>
                        <div className="cb-field">
                            <span className="cb-label">Tiện ích</span>
                            <div className="cb-actions" style={{ gap: 6 }}>
                                {[...new Set([...data.facilities.map(f => f.name), ...(editing.facilities ?? [])])].map(name => {
                                    const on = editing.facilities?.includes(name) ?? false;
                                    return (
                                        <label key={name} className="cb-chip" style={on ? { borderColor: "#2D5BE3", background: "#EEF2FB" } : undefined}>
                                            <input type="checkbox" checked={on} onChange={() => setDraft({ facilities: on ? (editing.facilities ?? []).filter(f => f !== name) : [...(editing.facilities ?? []), name] })} /> {name}
                                        </label>
                                    );
                                })}
                            </div>
                            <div className="cb-actions">
                                <input className="cb-input" style={{ flex: 1 }} aria-label="Tiện ích mới" placeholder="Thêm tiện ích…" value={newFacility} onChange={e => setNewFacility(e.target.value)} />
                                <Button small disabled={!newFacility.trim()} onClick={() => { setDraft({ facilities: [...(editing.facilities ?? []), newFacility.trim()] }); setNewFacility(""); }}>Thêm</Button>
                            </div>
                        </div>
                        <div className="cb-actions"><Button type="submit" variant="primary" busy={busy} disabled={!editing.name?.trim()}>{editing.id ? "Lưu điểm" : "Thêm điểm"}</Button><Button onClick={() => setSelection(null)}>Đóng</Button></div>
                    </form>
                ) : zoneDraft ? (
                    <form className="cb-pad cb-form" onSubmit={saveZone}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <h2 className="cb-h3">{zoneDraft.id ? "Vùng" : "Vùng mới"}</h2>
                            <Button small variant="danger" onClick={() => void removeZone()}>{zoneDraft.id ? "Xoá" : "Bỏ"}</Button>
                        </div>
                        <Field label="Tên vùng" required autoFocus value={zoneDraft.name ?? ""} onChange={e => setSelection({ kind: "zone", draft: { ...zoneDraft, name: e.target.value } })} placeholder="Khu check-in A" />
                        <ColorPicker value={zoneDraft.color ?? "#2d5be3"} onChange={c => setSelection({ kind: "zone", draft: { ...zoneDraft, color: c } })} />
                        <p className="cb-muted cb-mono" style={{ fontSize: 12 }}>{zoneDraft.polygon?.length ?? 0} đỉnh (pixel bản vẽ)</p>
                        <div className="cb-actions"><Button type="submit" variant="primary" busy={busy} disabled={!zoneDraft.name?.trim()}>Lưu vùng</Button><Button onClick={() => setSelection(null)}>Đóng</Button></div>
                    </form>
                ) : (
                    <div className="cb-pad cb-stack">
                        <h2 className="cb-h3">{floor.name}</h2>
                        <p className="cb-muted">Chọn một điểm trên bản đồ để sửa, hoặc dùng công cụ <b>Thêm điểm</b> / <b>Vẽ vùng</b>.</p>
                        <div className="cb-kv">
                            <span>Địa điểm</span><b>{floorPlaces}</b>
                            <span>Vùng</span><b>{data.zones.filter(z => z.floorId === floorId).length}</b>
                            <span>Nút lối đi</span><b>{model.walkways.nodes.filter(n => n.floorId === floorId).length}</b>
                        </div>
                        {floorUnreachable > 0 && (
                            <div className="cb-stack" style={{ gap: 6 }}>
                                <span className="cb-label">Điểm chưa có lối đi gần</span>
                                {report.unreachable.filter(p => p.floorId === floorId).slice(0, 8).map(p => (
                                    <button key={p.id} type="button" className="cb-btn is-small" style={{ justifyContent: "flex-start" }} onClick={() => selectPlace(p.id)}>{p.name}</button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </aside>
        </div>
    );
}
