import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { floorWord, type FloorDto } from "@indoor-map/core";
import { planApi, venueApi } from "../../console/api";
import { Button, Card, Field, Status, Table, TextArea, useAction, useFeedback } from "../../console/ui";
import { useWorkspace } from "../Workspace";
import { OutlineMap } from "./VenueCreatePage";

// Toà nhà & tầng (+ thông tin địa điểm)
export default function BuildingsPage() {
    const { venueId, data, model, reload, patch } = useWorkspace();
    const { confirm } = useFeedback();
    const { busy, run } = useAction();
    const buildings = [...data.buildings].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const [selectedId, setSelectedId] = useState<number | null>(buildings[0]?.id ?? null);
    const building = buildings.find(b => b.id === selectedId) ?? buildings[0];
    const floors = building ? data.floors.filter(f => f.buildingId === building.id).sort((a, b) => b.level - a.level) : [];
    const [editFloor, setEditFloor] = useState<FloorDto | null>(null);
    const [newBuilding, setNewBuilding] = useState({ code: "", name: "" });
    const [newFloor, setNewFloor] = useState({ level: "", name: "" });
    const [buildingName, setBuildingName] = useState<{ id: number; code: string; name: string } | null>(null);
    const [info, setInfo] = useState({ name: data.venue.name, description: data.venue.description ?? "" });
    const [outline, setOutline] = useState<[number, number][]>(data.venue.outline ?? []);

    const addBuilding = async (e: FormEvent) => {
        e.preventDefault();
        const created = await run(() => planApi.createBuilding(venueId, { code: newBuilding.code.trim(), name: newBuilding.name.trim(), sortOrder: buildings.length + 1 }), "Đã thêm toà nhà");
        if (created) {
            setNewBuilding({ code: "", name: "" });
            await reload("buildings", "venue");
            setSelectedId(created.id);
        }
    };

    const addFloor = async (e: FormEvent) => {
        e.preventDefault();
        if (!building) return;
        const level = Number(newFloor.level);
        const created = await run(() => planApi.createFloor(venueId, { buildingId: building.id, level, name: newFloor.name.trim() || floorWord(level) }), "Đã thêm tầng");
        if (created) {
            setNewFloor({ level: "", name: "" });
            await reload("floors", "venue");
        }
    };

    const saveFloor = async (e: FormEvent) => {
        e.preventDefault();
        if (!editFloor) return;
        const saved = await run(() => planApi.updateFloor(venueId, editFloor.id, { buildingId: editFloor.buildingId, level: editFloor.level, name: editFloor.name }), "Đã lưu tầng");
        if (saved) {
            setEditFloor(null);
            await reload("floors");
        }
    };

    const removeFloor = async (floor: FloorDto) => {
        const count = model.locationCount.get(floor.id) ?? 0;
        if (!(await confirm(`Xoá ${floor.name}?`, { danger: true, okLabel: "Xoá tầng", detail: `${count} địa điểm, vùng và lối đi của tầng này cũng bị xoá. Không hoàn tác được.` }))) return;
        if (await run(() => planApi.removeFloor(venueId, floor.id), "Đã xoá tầng") !== null) await reload("floors", "locations", "zones", "walkways", "venue");
    };

    const removeBuilding = async () => {
        if (!building) return;
        if (!(await confirm(`Xoá toà nhà ${building.code}?`, { danger: true, okLabel: "Xoá toà nhà", detail: `${floors.length} tầng cùng toàn bộ địa điểm, vùng, lối đi bên trong bị xoá.` }))) return;
        if (await run(() => planApi.removeBuilding(venueId, building.id), "Đã xoá toà nhà") !== null) {
            setSelectedId(null);
            await reload();
        }
    };

    const saveBuildingName = async (e: FormEvent) => {
        e.preventDefault();
        if (!buildingName || !building) return;
        if (await run(() => planApi.updateBuilding(venueId, building.id, { ...building, code: buildingName.code.trim(), name: buildingName.name.trim() }), "Đã đổi tên")) {
            setBuildingName(null);
            await reload("buildings", "floors");
        }
    };

    const saveInfo = async (e: FormEvent) => {
        e.preventDefault();
        const center = outline.length ? { centerLat: outline.reduce((s, p) => s + p[0], 0) / outline.length, centerLng: outline.reduce((s, p) => s + p[1], 0) / outline.length } : {};
        const saved = await run(() => venueApi.update(venueId, { ...data.venue, name: info.name.trim(), description: info.description.trim(), outline: outline.length >= 3 ? outline : undefined, ...center }), "Đã lưu thông tin địa điểm");
        if (saved) patch("venue", { ...data.venue, ...saved });
    };

    return (
        <div className="cb-work">
            <aside className="cb-side">
                <div className="cb-side-title">Toà nhà</div>
                <ul className="cb-side-list">
                    {buildings.map(b => (
                        <li key={b.id}><button type="button" aria-current={b.id === building?.id} onClick={() => { setSelectedId(b.id); setEditFloor(null); }}>
                            <span><b>{b.code}</b> · {b.name}</span><small>{data.floors.filter(f => f.buildingId === b.id).length} tầng</small>
                        </button></li>
                    ))}
                </ul>
                <form className="cb-side-section" onSubmit={addBuilding}>
                    <span className="cb-label">Thêm toà nhà</span>
                    <div style={{ display: "grid", gridTemplateColumns: "72px 1fr", gap: 6 }}>
                        <input className="cb-input" aria-label="Mã toà nhà" placeholder="Mã" maxLength={20} required value={newBuilding.code} onChange={e => setNewBuilding(n => ({ ...n, code: e.target.value.toUpperCase() }))} />
                        <input className="cb-input" aria-label="Tên toà nhà" placeholder="Tên toà nhà" required value={newBuilding.name} onChange={e => setNewBuilding(n => ({ ...n, name: e.target.value }))} />
                    </div>
                    <Button type="submit" small busy={busy}>+ Thêm toà nhà</Button>
                </form>
            </aside>

            <div style={{ flex: 1, minWidth: 0, padding: "24px 28px", display: "flex", flexDirection: "column", gap: 18 }}>
                {!building ? (
                    <Card title="Bắt đầu: thêm toà nhà đầu tiên"><p className="cb-muted">Mỗi địa điểm gồm một hoặc nhiều toà nhà (ví dụ “T1 · Nhà ga quốc nội”, “H · Toà nhà H”), mỗi toà nhà có các tầng. Dùng ô “Thêm toà nhà” ở cột trái.</p></Card>
                ) : (
                    <>
                        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                            {buildingName ? (
                                <form onSubmit={saveBuildingName} className="cb-actions">
                                    <input className="cb-input" style={{ width: 90 }} aria-label="Mã" value={buildingName.code} onChange={e => setBuildingName({ ...buildingName, code: e.target.value.toUpperCase() })} />
                                    <input className="cb-input" style={{ width: 280 }} aria-label="Tên" value={buildingName.name} onChange={e => setBuildingName({ ...buildingName, name: e.target.value })} />
                                    <Button type="submit" variant="primary" small>Lưu</Button><Button small onClick={() => setBuildingName(null)}>Huỷ</Button>
                                </form>
                            ) : (
                                <div>
                                    <div className="cb-actions"><h1 className="cb-h1">{building.code} · {building.name}</h1><Button small onClick={() => setBuildingName({ id: building.id, code: building.code, name: building.name })}>Đổi tên</Button></div>
                                    <p className="cb-muted" style={{ marginTop: 6 }}>{floors.length} tầng · {floors.filter(f => f.plan).length}/{floors.length} đã có mặt bằng · {floors.reduce((s, f) => s + (model.locationCount.get(f.id) ?? 0), 0)} địa điểm</p>
                                </div>
                            )}
                            <Button variant="danger" onClick={removeBuilding}>Xoá toà nhà</Button>
                        </div>

                        <Table head={["Mức", "Tên tầng", "Mặt bằng", "Địa điểm", "Nút lối đi", ""]} minWidth={720}>
                            {floors.map(f => (
                                <tr key={f.id} className={editFloor?.id === f.id ? "is-selected" : ""}>
                                    <td className="cb-mono">{f.level > 0 ? `+${f.level}` : f.level}</td>
                                    <td style={{ fontWeight: 500 }}>{f.name}</td>
                                    <td>{!f.plan ? <Status kind="warn">Chưa có mặt bằng</Status> : f.plan.anchor ? <Status kind="ok">Đã căn chỉnh</Status> : <Status kind="warn">Chưa chấm mốc</Status>}</td>
                                    <td className="is-num">{model.locationCount.get(f.id) ?? 0}</td>
                                    <td className="is-num">{data.walkways.nodes.filter(n => n.floorId === f.id).length}</td>
                                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                                        <Link to={`/builder/v/${venueId}/plan?floor=${f.id}`}>Mặt bằng</Link>{" · "}
                                        <Link to={`/builder/v/${venueId}/editor?floor=${f.id}`}>Biên tập</Link>{" · "}
                                        <button type="button" className="cb-btn cb-btn-ghost is-small" onClick={() => setEditFloor({ ...f })}>Sửa</button>
                                        <button type="button" className="cb-btn cb-btn-ghost is-small" style={{ color: "#B42318" }} onClick={() => void removeFloor(f)}>Xoá</button>
                                    </td>
                                </tr>
                            ))}
                            {floors.length === 0 && <tr><td colSpan={6} className="cb-muted">Chưa có tầng. Thêm tầng ở dưới.</td></tr>}
                        </Table>

                        <div className="cb-grid-2" style={{ alignItems: "start" }}>
                            {editFloor ? (
                                <Card title={`Sửa tầng · ${editFloor.name}`}>
                                    <form className="cb-form" onSubmit={saveFloor}>
                                        <Field label="Tên hiển thị" required value={editFloor.name} onChange={e => setEditFloor({ ...editFloor, name: e.target.value })} />
                                        <Field label="Mức (level)" type="number" required value={editFloor.level} onChange={e => setEditFloor({ ...editFloor, level: Number(e.target.value) })}
                                            help="Trệt = 0, hầm = −1. Dùng để sắp thứ tự và biết lên hay xuống khi đổi tầng." />
                                        <div className="cb-actions"><Button type="submit" variant="primary" busy={busy}>Lưu</Button><Button onClick={() => setEditFloor(null)}>Huỷ</Button></div>
                                    </form>
                                </Card>
                            ) : (
                                <Card title={`Thêm tầng vào ${building.code}`}>
                                    <form className="cb-form" onSubmit={addFloor}>
                                        <div className="cb-grid-2">
                                            <Field label="Mức (level)" type="number" required value={newFloor.level} onChange={e => setNewFloor(n => ({ ...n, level: e.target.value }))} help="Trệt = 0, hầm = −1" />
                                            <Field label="Tên (không bắt buộc)" value={newFloor.name} placeholder={newFloor.level ? floorWord(Number(newFloor.level)) : "Tầng 1 · Khu khởi hành"} onChange={e => setNewFloor(n => ({ ...n, name: e.target.value }))} />
                                        </div>
                                        <div className="cb-actions"><Button type="submit" variant="primary" busy={busy} disabled={newFloor.level === ""}>+ Thêm tầng</Button></div>
                                    </form>
                                </Card>
                            )}
                            <Card title="Bước tiếp theo">
                                <p className="cb-muted">Mỗi tầng cần một bản vẽ mặt bằng (SVG, PNG hoặc JPG) và 2 điểm mốc để đặt lên bản đồ thật.</p>
                                <div className="cb-actions" style={{ marginTop: 12 }}>
                                    <Button variant="primary" to={`/builder/v/${venueId}/plan${floors[0] ? `?floor=${floors[0].id}` : ""}`} disabled={!floors.length}>Tải & căn chỉnh mặt bằng →</Button>
                                </div>
                            </Card>
                        </div>
                    </>
                )}

                <Card title="Thông tin địa điểm" actions={<span className="cb-mono" style={{ color: "#6B7280" }}>/v/{data.venue.slug}</span>}>
                    <form className="cb-form" onSubmit={saveInfo}>
                        <div className="cb-grid-2" style={{ alignItems: "start" }}>
                            <div className="cb-form">
                                <Field label="Tên địa điểm" required value={info.name} onChange={e => setInfo(i => ({ ...i, name: e.target.value }))} />
                                <TextArea label="Mô tả ngắn" value={info.description} onChange={e => setInfo(i => ({ ...i, description: e.target.value }))} />
                                <p className="cb-muted">Đường dẫn công khai không đổi được sau khi tạo (để mã QR đã in vẫn dùng được).</p>
                                <div className="cb-actions"><Button type="submit" variant="primary" busy={busy}>Lưu thông tin</Button></div>
                            </div>
                            <div className="cb-field">
                                <span className="cb-label">Vùng bao ({outline.length} đỉnh) — bấm để thêm đỉnh, kéo để sửa</span>
                                <OutlineMap value={outline} onChange={setOutline}
                                    center={data.venue.centerLat != null && data.venue.centerLng != null ? [data.venue.centerLat, data.venue.centerLng] : undefined} />
                                <div className="cb-actions"><Button small onClick={() => setOutline(o => o.slice(0, -1))} disabled={!outline.length}>Bỏ đỉnh cuối</Button><Button small onClick={() => setOutline([])} disabled={!outline.length}>Xoá vùng bao</Button></div>
                            </div>
                        </div>
                    </form>
                </Card>
            </div>
        </div>
    );
}
