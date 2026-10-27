import { useMemo, useState, type FormEvent } from "react";
import { groupLabel, type FacilityDto, type LocationTypeDto } from "@indoor-map/core";
import { catalogApi } from "../../console/api";
import { Button, Card, ColorPicker, Field, IconPicker, Table, useAction, useFeedback } from "../../console/ui";
import { useWorkspace } from "../Workspace";

const GROUPS = ["gate", "procedure", "food", "service", "restroom", "transport", "health", "study", "office", "leisure"];
const EMPTY: Partial<LocationTypeDto> = { code: "", name: "", icon: "bi-geo-alt", color: "#3f6fb5", groupName: "service" };

// Loại địa điểm (màu, icon, nhóm lọc) và tiện ích của địa điểm
export default function TypesPage() {
    const { venueId, data, model, reload } = useWorkspace();
    const { confirm } = useFeedback();
    const { busy, run } = useAction();
    const [tab, setTab] = useState<"types" | "facilities">("types");
    const [form, setForm] = useState<Partial<LocationTypeDto> | null>(null);
    const [facilityName, setFacilityName] = useState("");
    const [editingFacility, setEditingFacility] = useState<FacilityDto | null>(null);
    const counts = useMemo(() => {
        const map = new Map<string, number>();
        model.locations.forEach(l => map.set(l.type ?? "other", (map.get(l.type ?? "other") ?? 0) + 1));
        return map;
    }, [model]);
    const types = [...data.types].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const facilityUse = useMemo(() => {
        const map = new Map<string, number>();
        data.locations.forEach(l => l.facilities?.forEach(f => map.set(f, (map.get(f) ?? 0) + 1)));
        return map;
    }, [data.locations]);

    const saveType = async (e: FormEvent) => {
        e.preventDefault();
        if (!form) return;
        const body = { ...form, code: form.code?.trim(), name: form.name?.trim(), sortOrder: form.sortOrder ?? types.length * 10 };
        const saved = await run(() => (form.id ? catalogApi.updateType(venueId, form.id, body) : catalogApi.createType(venueId, body)), form.id ? "Đã lưu loại" : "Đã thêm loại");
        if (saved) {
            setForm(saved);
            await reload("types");
        }
    };
    const removeType = async (t: LocationTypeDto) => {
        const n = counts.get(t.code) ?? 0;
        if (!(await confirm(`Xoá loại “${t.name}”?`, { danger: true, okLabel: "Xoá", detail: n ? `${n} địa điểm đang thuộc loại này — máy chủ sẽ từ chối cho tới khi bạn chuyển chúng sang loại khác.` : undefined }))) return;
        if (t.id && await run(() => catalogApi.removeType(venueId, t.id!), "Đã xoá loại") !== null) {
            setForm(null);
            await reload("types");
        }
    };
    const copyTemplates = async () => {
        if (await run(() => catalogApi.copyTemplates(venueId), "Đã thêm các loại mẫu còn thiếu")) await reload("types");
    };
    const saveFacility = async (e: FormEvent) => {
        e.preventDefault();
        const name = (editingFacility?.name ?? facilityName).trim();
        if (!name) return;
        const saved = await run(() => (editingFacility ? catalogApi.updateFacility(venueId, editingFacility.id, name) : catalogApi.createFacility(venueId, name)), "Đã lưu tiện ích");
        if (saved) {
            setFacilityName("");
            setEditingFacility(null);
            await reload("facilities");
        }
    };
    const removeFacility = async (f: FacilityDto) => {
        if (!(await confirm(`Xoá tiện ích “${f.name}”?`, { danger: true, okLabel: "Xoá", detail: "Tiện ích sẽ bị gỡ khỏi các địa điểm đang có." }))) return;
        if (await run(() => catalogApi.removeFacility(venueId, f.id), "Đã xoá tiện ích") !== null) await reload("facilities", "locations");
    };

    return (
        <div className="cb-main" style={{ maxWidth: 1320 }}>
            <div className="cb-page-head">
                <div>
                    <h1 className="cb-h1">{tab === "types" ? "Loại địa điểm" : "Tiện ích"}</h1>
                    <p className="cb-muted">{tab === "types" ? `${types.length} loại · dùng để lọc, tô màu biểu tượng và gợi ý tìm kiếm trên điện thoại.` : `${data.facilities.length} tiện ích · hiện trong chi tiết địa điểm (Wi-Fi, ổ cắm, lối xe lăn…).`}</p>
                </div>
                <div className="cb-actions">
                    <div className="cb-seg">
                        <button type="button" aria-pressed={tab === "types"} onClick={() => setTab("types")}>Loại địa điểm</button>
                        <button type="button" aria-pressed={tab === "facilities"} onClick={() => setTab("facilities")}>Tiện ích · {data.facilities.length}</button>
                    </div>
                    {tab === "types" && <><Button onClick={() => void copyTemplates()} busy={busy}>Thêm từ danh mục mẫu</Button><Button variant="primary" onClick={() => setForm({ ...EMPTY })}>Thêm loại</Button></>}
                </div>
            </div>

            {tab === "types" ? (
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(320px, 1fr)", gap: 20, alignItems: "start" }}>
                    <Table head={["Loại", "Mã", "Nhóm", <span key="n" className="is-num">Số điểm</span>, ""]} minWidth={560}>
                        {types.map(t => (
                            <tr key={t.code} className={`is-click${form?.id === t.id ? " is-selected" : ""}`} onClick={() => setForm({ ...t })}>
                                <td><span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}><span style={{ width: 26, height: 26, borderRadius: 6, background: t.color, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><i className={`bi ${t.icon}`} aria-hidden="true" /></span><b style={{ fontWeight: 500 }}>{t.name}</b></span></td>
                                <td className="cb-mono">{t.code}</td>
                                <td>{groupLabel(t.groupName)}</td>
                                <td className="is-num">{counts.get(t.code) ?? 0}</td>
                                <td style={{ textAlign: "right" }}><button type="button" className="cb-btn cb-btn-ghost is-small">Sửa</button></td>
                            </tr>
                        ))}
                    </Table>
                    {form ? (
                        <Card title={form.id ? `Sửa loại · ${form.name}` : "Loại mới"} actions={form.id ? <Button small variant="danger" onClick={() => void removeType(form as LocationTypeDto)}>Xoá</Button> : undefined}>
                            <form className="cb-form" onSubmit={saveType}>
                                <div className="cb-grid-2">
                                    <Field label="Tên" required value={form.name ?? ""} onChange={e => setForm({ ...form, name: e.target.value })} />
                                    <Field label="Mã" required pattern="[a-z0-9_]+" disabled={Boolean(form.id)} value={form.code ?? ""} help={form.id ? "Không đổi được (dữ liệu đang dùng)" : "chữ thường, số, _"}
                                        onChange={e => setForm({ ...form, code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })} />
                                </div>
                                <div className="cb-field">
                                    <label htmlFor="grp">Nhóm lọc</label>
                                    <select id="grp" className="cb-input" value={form.groupName ?? ""} onChange={e => setForm({ ...form, groupName: e.target.value })}>
                                        {GROUPS.map(g => <option key={g} value={g}>{groupLabel(g)}</option>)}
                                    </select>
                                </div>
                                <ColorPicker label="Màu biểu tượng" value={form.color ?? "#3f6fb5"} onChange={c => setForm({ ...form, color: c })} />
                                <IconPicker value={form.icon ?? "bi-geo-alt"} onChange={icon => setForm({ ...form, icon })} />
                                <div className="cb-actions"><Button type="submit" variant="primary" busy={busy}>Lưu</Button><Button onClick={() => setForm(null)}>Đóng</Button></div>
                            </form>
                        </Card>
                    ) : (
                        <Card title="Chọn một loại để sửa"><p className="cb-muted">Mỗi địa điểm thuộc đúng một loại. Loại mẫu là bản sao — sửa thoải mái, không ảnh hưởng địa điểm khác. Muốn xoá một loại còn đang dùng thì đổi loại các điểm đó ở trang Điểm & vùng trước.</p></Card>
                    )}
                </div>
            ) : (
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(320px, 1fr)", gap: 20, alignItems: "start" }}>
                    <Table head={["Tiện ích", <span key="n" className="is-num">Số điểm có</span>, ""]} minWidth={420}>
                        {data.facilities.map(f => (
                            <tr key={f.id}>
                                <td>{f.name}</td>
                                <td className="is-num">{facilityUse.get(f.name) ?? 0}</td>
                                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                                    <button type="button" className="cb-btn cb-btn-ghost is-small" onClick={() => setEditingFacility({ ...f })}>Đổi tên</button>
                                    <button type="button" className="cb-btn cb-btn-ghost is-small" style={{ color: "#B42318" }} onClick={() => void removeFacility(f)}>Xoá</button>
                                </td>
                            </tr>
                        ))}
                        {!data.facilities.length && <tr><td colSpan={3} className="cb-muted">Chưa có tiện ích.</td></tr>}
                    </Table>
                    <Card title={editingFacility ? "Đổi tên tiện ích" : "Thêm tiện ích"}>
                        <form className="cb-form" onSubmit={saveFacility}>
                            <Field label="Tên" required value={editingFacility?.name ?? facilityName}
                                onChange={e => (editingFacility ? setEditingFacility({ ...editingFacility, name: e.target.value }) : setFacilityName(e.target.value))} placeholder="Wi-Fi miễn phí" />
                            <div className="cb-actions"><Button type="submit" variant="primary" busy={busy}>Lưu</Button>{editingFacility && <Button onClick={() => setEditingFacility(null)}>Huỷ</Button>}</div>
                        </form>
                    </Card>
                </div>
            )}
        </div>
    );
}
