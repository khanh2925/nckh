import { useMemo, useState, type FormEvent } from "react";
import { groupLabel, type FacilityDto, type LocationTypeDto } from "@indoor-map/core";
import { catalogApi, locationApi } from "../../console/api";
import { HeaderActions } from "../../console/Shell";
import { Button, COLORS, IconPicker, useAction, useFeedback } from "../../console/ui";
import Lc from "../../design/Lc";
import { Dialog, GuestLink } from "../FloorList";
import { useWorkspace } from "../Workspace";
import "./workspace.css";

const GROUPS = ["gate", "procedure", "food", "service", "restroom", "transport", "health", "study", "office", "leisure"];
/** Tên các màu marker (màu dữ liệu, cùng thứ tự với COLORS trong console/ui) */
const COLOR_NAMES = ["Đỏ gạch", "Xanh lam", "Tím", "Cam đất", "Hồng đậm", "Xanh két", "Xanh lá", "Nâu", "Xám xanh", "Xám than", "Tím nhạt", "Xám"];
const EMPTY: Partial<LocationTypeDto> = { code: "", name: "", icon: "bi-geo-alt", color: COLORS[1], groupName: "service" };
const colorName = (c?: string) => {
    const i = COLORS.indexOf((c ?? "").toLowerCase());
    return i >= 0 ? COLOR_NAMES[i] ?? c ?? "" : c ?? "";
};

// Loại điểm (màu, biểu tượng, nhóm lọc) và tiện ích của địa điểm
export default function TypesPage() {
    const { venueId, data, model, reload } = useWorkspace();
    const { confirm } = useFeedback();
    const { busy, run } = useAction();
    const [tab, setTab] = useState<"types" | "facilities">("types");
    const [form, setForm] = useState<Partial<LocationTypeDto> | null>(null);
    const [facilityName, setFacilityName] = useState("");
    const [editingFacility, setEditingFacility] = useState<FacilityDto | null>(null);
    const [removing, setRemoving] = useState<{ type: LocationTypeDto; to: string } | null>(null);
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

    const askRemove = async (t: LocationTypeDto) => {
        if ((counts.get(t.code) ?? 0) > 0) return setRemoving({ type: t, to: "" });
        if (!(await confirm(`Xoá loại “${t.name}”?`, { danger: true, okLabel: "Xoá loại" }))) return;
        if (t.id && await run(() => catalogApi.removeType(venueId, t.id!), "Đã xoá loại") !== null) {
            setForm(null);
            await reload("types");
        }
    };
    // Loại còn điểm: chuyển các điểm sang loại thay thế rồi mới xoá
    const moveAndRemove = async () => {
        if (!removing?.to || !removing.type.id) return;
        const { type, to } = removing;
        const done = await run(async () => {
            for (const loc of data.locations.filter(l => (l.type ?? "other") === type.code)) await locationApi.update(venueId, loc.id, { ...loc, type: to });
            await catalogApi.removeType(venueId, type.id!);
            return true;
        }, "Đã chuyển điểm và xoá loại");
        if (done) {
            setRemoving(null);
            setForm(null);
        }
        await reload("types", "locations");
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
        if (!(await confirm(`Xoá tiện ích “${f.name}”?`, { danger: true, okLabel: "Xoá tiện ích", detail: "Tiện ích sẽ bị gỡ khỏi các điểm đang có." }))) return;
        if (await run(() => catalogApi.removeFacility(venueId, f.id), "Đã xoá tiện ích") !== null) await reload("facilities", "locations");
    };

    const colorChoices = form?.color && !COLORS.includes(form.color.toLowerCase()) ? [...COLORS, form.color] : COLORS;

    return (
        <div className="k-page ws-page-full" style={{ minHeight: 640 }}>
            <HeaderActions>
                <GuestLink venue={data.venue} />
                <Button variant="primary" onClick={() => { setTab("types"); setForm({ ...EMPTY }); }}>Thêm loại</Button>
            </HeaderActions>
            <div className="k-title">
                <h1 className="k24">Loại và tiện ích</h1>
                <div className="k-acts"><Button busy={busy && !form} onClick={() => void copyTemplates()}>Thêm từ mẫu</Button></div>
            </div>
            <div role="tablist" aria-label="Danh mục" className="k-tabs">
                <button type="button" role="tab" aria-selected={tab === "types"} className="k-tab" onClick={() => setTab("types")}>Loại điểm <span className="k-m">{types.length}</span></button>
                <button type="button" role="tab" aria-selected={tab === "facilities"} className="k-tab" onClick={() => setTab("facilities")}>Tiện ích <span className="k-m">{data.facilities.length}</span></button>
            </div>

            {tab === "types" ? (
                <div className="ws-row ws-fill">
                    <section aria-label="Danh sách loại" className="k-card ws-card0 ws-grow" style={{ overflow: "auto", display: "block" }}>
                        <table className="k-tbl">
                            <thead><tr><th scope="col">Loại</th><th scope="col">Mã</th><th scope="col">Nhóm</th><th scope="col" className="num">Số điểm</th><th scope="col">Màu</th></tr></thead>
                            <tbody>
                                {types.map(t => (
                                    <tr key={t.code} className="is-click" tabIndex={0} aria-selected={form?.id != null && form.id === t.id}
                                        onClick={() => setForm({ ...t })} onKeyDown={e => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setForm({ ...t }))}>
                                        <td className="k-b">
                                            <span className="k-line">
                                                <span aria-hidden="true" className="ws-tile" style={{ background: t.color || "var(--muted)" }}><i className={`bi ${t.icon || "bi-geo-alt"}`} /></span>
                                                {t.name}
                                            </span>
                                        </td>
                                        <td><code className="k-m" style={{ fontFamily: "inherit" }}>{t.code}</code></td>
                                        <td>{groupLabel(t.groupName)}</td>
                                        <td className="num">{counts.get(t.code) ?? 0}</td>
                                        <td><span className="k-line"><span aria-hidden="true" className="ws-swatch" style={{ background: t.color || "var(--muted)" }} />{colorName(t.color)}</span></td>
                                    </tr>
                                ))}
                                {!types.length && <tr><td colSpan={5} className="k-m">Chưa có loại nào. Bấm Thêm từ mẫu để lấy danh mục theo loại hình địa điểm.</td></tr>}
                            </tbody>
                        </table>
                    </section>

                    <aside aria-label={form ? `Sửa loại ${form.name ?? ""}` : "Sửa loại"} className="k-card ws-card0" style={{ width: 360, flexShrink: 0, minHeight: 0, display: "flex" }}>
                        {form ? (
                            <form className="ws-col" style={{ flex: 1 }} onSubmit={e => void saveType(e)}>
                                <div className="ws-cardhead is-24" style={{ flexDirection: "column", alignItems: "flex-start", gap: 0 }}>
                                    <h2 className="k16">{form.id ? form.name : "Loại mới"}</h2>
                                    {form.id && <div className="k12 k-m">{counts.get(form.code ?? "") ?? 0} điểm</div>}
                                </div>
                                <div className="k-stack" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "16px 24px" }}>
                                    <div className="k-field"><label htmlFor="t-name">Tên</label><input id="t-name" className="k-input" required value={form.name ?? ""} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                                    <div className="k-grid2">
                                        <div className="k-field">
                                            <label htmlFor="t-code">Mã</label>
                                            <input id="t-code" className="k-input" required pattern="[a-z0-9_]+" disabled={Boolean(form.id)} title={form.id ? "Không đổi được khi đã có dữ liệu" : "Chữ thường, số, _"}
                                                value={form.code ?? ""} onChange={e => setForm({ ...form, code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })} />
                                        </div>
                                        <div className="k-field">
                                            <label htmlFor="t-grp">Nhóm</label>
                                            <select id="t-grp" className="k-input" value={form.groupName ?? ""} onChange={e => setForm({ ...form, groupName: e.target.value })}>
                                                {GROUPS.map(g => <option key={g} value={g}>{groupLabel(g)}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <fieldset className="ws-fs0">
                                        <legend className="k-label">Màu marker</legend>
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 16 }}>
                                            {colorChoices.map(c => (
                                                <label key={c} className="k-line k14" style={{ minHeight: 32, cursor: "pointer" }}>
                                                    <input type="radio" className="k-check" name="color" value={c} checked={(form.color ?? "").toLowerCase() === c.toLowerCase()} onChange={() => setForm({ ...form, color: c })} />
                                                    <span aria-hidden="true" className="ws-swatch" style={{ background: c }} />{colorName(c)}
                                                </label>
                                            ))}
                                        </div>
                                        <label className="k-line k12 k-m" style={{ marginTop: 8 }}>
                                            Màu khác
                                            <input type="color" aria-label="Màu khác" value={form.color ?? COLORS[1]} onChange={e => setForm({ ...form, color: e.target.value })} className="cb-color-input" />
                                        </label>
                                    </fieldset>
                                    <IconPicker value={form.icon ?? "bi-geo-alt"} onChange={icon => setForm({ ...form, icon })} />
                                </div>
                                <div className="ws-cardfoot is-24">
                                    {form.id ? <button type="button" className="k-btn d" style={{ marginLeft: -16 }} onClick={() => void askRemove(form as LocationTypeDto)}>Xoá loại…</button> : <button type="button" className="k-btn t" style={{ marginLeft: -16 }} onClick={() => setForm(null)}>Huỷ</button>}
                                    <Button type="submit" busy={busy} disabled={!form.name?.trim() || !form.code?.trim()}>{form.id ? "Lưu loại" : "Thêm loại"}</Button>
                                </div>
                            </form>
                        ) : (
                            <div className="ws-pidle" style={{ flex: 1 }}><p className="k14 k-m">Chọn một loại để sửa tên, màu và biểu tượng.</p></div>
                        )}
                    </aside>
                </div>
            ) : (
                <div className="ws-row ws-fill">
                    <section aria-label="Danh sách tiện ích" className="k-card ws-card0 ws-grow" style={{ overflow: "auto", display: "block" }}>
                        <table className="k-tbl">
                            <thead><tr><th scope="col">Tiện ích</th><th scope="col" className="num">Số điểm có</th><th scope="col"><span className="sr-only">Thao tác</span></th></tr></thead>
                            <tbody>
                                {data.facilities.map(f => (
                                    <tr key={f.id} aria-selected={editingFacility?.id === f.id}>
                                        <td className="k-b">{f.name}</td>
                                        <td className="num">{facilityUse.get(f.name) ?? 0}</td>
                                        <td className="is-act">
                                            <button type="button" className="k-btn t sm" onClick={() => setEditingFacility({ ...f })}>Đổi tên</button>
                                            <button type="button" className="k-btn d sm" onClick={() => void removeFacility(f)}>Xoá…</button>
                                        </td>
                                    </tr>
                                ))}
                                {!data.facilities.length && <tr><td colSpan={3} className="k-m">Chưa có tiện ích.</td></tr>}
                            </tbody>
                        </table>
                    </section>
                    <aside className="k-card" style={{ width: 360, flexShrink: 0, alignSelf: "flex-start" }}>
                        <form className="k-stack" onSubmit={e => void saveFacility(e)}>
                            <h2 className="k16">{editingFacility ? "Đổi tên tiện ích" : "Thêm tiện ích"}</h2>
                            <div className="k-field">
                                <label htmlFor="fac-name">Tên</label>
                                <input id="fac-name" className="k-input" required placeholder="Wi-Fi miễn phí" value={editingFacility?.name ?? facilityName}
                                    onChange={e => (editingFacility ? setEditingFacility({ ...editingFacility, name: e.target.value }) : setFacilityName(e.target.value))} />
                            </div>
                            <div className="k-line">
                                <Button type="submit" busy={busy}>{editingFacility ? "Lưu" : "Thêm tiện ích"}</Button>
                                {editingFacility && <Button variant="ghost" onClick={() => setEditingFacility(null)}>Huỷ</Button>}
                            </div>
                        </form>
                    </aside>
                </div>
            )}

            {removing && (
                <Dialog alert title={`Xoá loại “${removing.type.name}”?`} onClose={() => setRemoving(null)}
                    actions={<><Button onClick={() => setRemoving(null)}>Huỷ</Button><Button variant="danger" busy={busy} disabled={!removing.to} onClick={() => void moveAndRemove()}>Chuyển và xoá loại</Button></>}>
                    <p className="k14"><Lc name="triangle-alert" size={16} color="var(--warn)" style={{ verticalAlign: "-3px", marginRight: 8 }} />{counts.get(removing.type.code) ?? 0} điểm đang thuộc loại này.</p>
                    <div className="k-field">
                        <label htmlFor="del-to">Chuyển {counts.get(removing.type.code) ?? 0} điểm sang</label>
                        <select id="del-to" className="k-input" aria-describedby="del-help" value={removing.to} onChange={e => setRemoving({ ...removing, to: e.target.value })}>
                            <option value="">Chọn loại thay thế…</option>
                            {types.filter(t => t.code !== removing.type.code).map(t => <option key={t.code} value={t.code}>{t.name}</option>)}
                        </select>
                        <span id="del-help" className="k-hint">Bắt buộc, để điểm không mất loại.</span>
                    </div>
                </Dialog>
            )}
        </div>
    );
}
