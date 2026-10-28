import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { venueApi } from "../../console/api";
import { HeaderActions, HeaderStatus, SaveState } from "../../console/Shell";
import { Button, NotYet, useAction, useFeedback } from "../../console/ui";
import Lc from "../../design/Lc";
import { Dialog, GuestLink } from "../FloorList";
import { useWorkspace } from "../Workspace";
import { OutlineMap } from "./VenueCreatePage";
import { KIND_LABEL } from "./VenuesPage";
import "./workspace.css";

// Cài đặt địa điểm: tên, loại hình, mô tả, vùng bao (venueApi.update); gỡ xuất bản; xoá địa điểm (venueApi.remove).
export default function VenueSettingsPage() {
    const { venueId, data, patch } = useWorkspace();
    const { confirm } = useFeedback();
    const { busy, run } = useAction();
    const navigate = useNavigate();
    const venue = data.venue;
    const [tab, setTab] = useState<"general" | "members">("general");
    const [form, setForm] = useState({ name: venue.name, kind: venue.kind ?? "other", description: venue.description ?? "" });
    const [outline, setOutline] = useState<[number, number][]>(venue.outline ?? []);
    const [deleting, setDeleting] = useState<string | null>(null);
    const hidden = venue.status === "HIDDEN";
    const dirty = form.name !== venue.name || form.kind !== (venue.kind ?? "other") || form.description !== (venue.description ?? "")
        || JSON.stringify(outline) !== JSON.stringify(venue.outline ?? []);
    const host = window.location.host;

    const save = async () => {
        const center = outline.length ? { centerLat: outline.reduce((s, p) => s + p[0], 0) / outline.length, centerLng: outline.reduce((s, p) => s + p[1], 0) / outline.length } : {};
        const saved = await run(() => venueApi.update(venueId, {
            ...venue, name: form.name.trim(), kind: form.kind, description: form.description.trim(), outline: outline.length >= 3 ? outline : undefined, ...center
        }), "Đã lưu cài đặt địa điểm");
        if (saved) patch("venue", { ...venue, ...saved });
    };

    const unpublish = async () => {
        if (!(await confirm(`Gỡ xuất bản ${venue.name}?`, { danger: true, okLabel: "Gỡ xuất bản", detail: "Khách mở đường dẫn hoặc quét tem sẽ không thấy bản đồ. Bản nháp và mã QR giữ nguyên, xuất bản lại được bất cứ lúc nào." }))) return;
        const saved = await run(() => venueApi.unpublish(venueId), "Đã gỡ xuất bản");
        if (saved) patch("venue", { ...venue, ...saved });
    };

    const remove = async () => {
        if (await run(() => venueApi.remove(venueId), "Đã xoá địa điểm") !== null) navigate("/builder", { replace: true });
    };

    return (
        <div className="k-page">
            <HeaderStatus>{dirty ? <SaveState state={busy ? "saving" : "dirty"} /> : null}</HeaderStatus>
            <HeaderActions>
                <GuestLink venue={venue} />
                <Button variant="primary" busy={busy} disabled={!dirty || !form.name.trim()} title={dirty ? undefined : "Chưa có thay đổi"} onClick={() => void save()}>Lưu thay đổi</Button>
            </HeaderActions>
            <h1 className="k24">Cài đặt địa điểm</h1>
            <div role="tablist" aria-label="Cài đặt" className="k-tabs">
                <button type="button" role="tab" aria-selected={tab === "general"} className="k-tab" onClick={() => setTab("general")}>Chung</button>
                <button type="button" role="tab" aria-selected={tab === "members"} className="k-tab" onClick={() => setTab("members")}>Thành viên <span className="k12 k-m" style={{ fontWeight: 400 }}>Giai đoạn 2</span></button>
            </div>

            {hidden && (
                <div className="k-note" role="status">
                    <Lc name="eye-off" size={16} color="var(--danger)" />
                    <div><b className="k-b">Quản trị hệ thống đã ẩn địa điểm này.</b><div className="k-m">Bạn vẫn sửa bản nháp được. Không gỡ, xoá hay đổi đường dẫn khi đang bị ẩn.</div></div>
                </div>
            )}

            {tab === "members" ? (
                <NotYet>Mời thêm người biên tập, người dán tem và chuyển quyền sở hữu cần API thành viên, sẽ có ở giai đoạn 2.</NotYet>
            ) : (
                <>
                    <div className="ws-split is-aside-400">
                        <section aria-labelledby="s-info" className="k-card">
                            <h2 id="s-info" className="k16">Thông tin chung</h2>
                            <div className="k-field"><label htmlFor="v-name">Tên địa điểm</label><input id="v-name" className="k-input" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
                            <div className="k-field">
                                <label htmlFor="v-slug">Đường dẫn</label>
                                <div className="k-input ws-slug">
                                    <span className="k-m">{host}/v/</span>
                                    <input id="v-slug" readOnly value={venue.slug} aria-describedby="slug-h" />
                                    <Lc name="lock" size={16} color="var(--muted)" />
                                </div>
                                <span id="slug-h" className="k-hint">Không đổi được sau khi tạo, vì mã QR đã in chứa đường dẫn này.</span>
                            </div>
                            <div className="k-field">
                                <label htmlFor="v-kind">Loại hình</label>
                                <select id="v-kind" className="k-input" value={form.kind} onChange={e => setForm(f => ({ ...f, kind: e.target.value }))}>
                                    {Object.entries(KIND_LABEL).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                                </select>
                            </div>
                            <div className="k-field"><label htmlFor="v-desc">Mô tả</label><textarea id="v-desc" rows={3} className="k-input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
                        </section>
                        <div className="k-stack" style={{ gap: 24 }}>
                            <section aria-labelledby="s-entry" className="k-card">
                                <h2 id="s-entry" className="k16">Lối vào chính</h2>
                                <NotYet>Chọn điểm xuất phát mặc định cho khách chưa định vị cần trường dữ liệu mới ở backend.</NotYet>
                            </section>
                            <section aria-labelledby="s-ct" className="k-card">
                                <h2 id="s-ct" className="k16">Liên hệ cho khách</h2>
                                <NotYet>Điện thoại và trang web của địa điểm chưa có chỗ lưu ở backend.</NotYet>
                            </section>
                        </div>
                    </div>

                    <section aria-labelledby="s-outline" className="k-card">
                        <div className="k-line">
                            <h2 id="s-outline" className="k16">Vùng bao</h2>
                            <span className="k12 k-m">{outline.length} góc</span>
                            <div className="k-line ws-right">
                                <button type="button" className="k-btn sm" disabled={!outline.length} onClick={() => setOutline(o => o.slice(0, -1))}>Bỏ góc cuối</button>
                                <button type="button" className="k-btn sm" disabled={!outline.length} onClick={() => setOutline([])}>Xoá vùng bao</button>
                            </div>
                        </div>
                        <p className="k12 k-m">Bấm lên bản đồ để thêm góc, kéo để sửa. Khách thấy vùng này trên bản đồ chọn địa điểm.</p>
                        <OutlineMap value={outline} onChange={setOutline} center={venue.centerLat != null && venue.centerLng != null ? [venue.centerLat, venue.centerLng] : undefined} />
                    </section>

                    <section aria-label="Gỡ hoặc xoá địa điểm" className="k-card ws-danger-zone">
                        <div className="k-row">
                            <div className="ws-grow"><div className="k14 k-b">Gỡ xuất bản</div>
                                <div id="dz-1" className="k12 k-m">{hidden ? "Khoá khi địa điểm đang bị quản trị ẩn." : venue.status === "PUBLISHED" ? "Khách không mở được bản đồ. Bản nháp và mã QR giữ nguyên." : "Địa điểm chưa công khai."}</div></div>
                            <button type="button" className="k-btn d" aria-describedby="dz-1" disabled={hidden || venue.status !== "PUBLISHED" || busy} onClick={() => void unpublish()}>{hidden && <Lc name="lock" size={16} />}Gỡ xuất bản…</button>
                        </div>
                        <div className="k-row">
                            <div className="ws-grow"><div className="k14 k-b">Xoá địa điểm</div>
                                <div id="dz-2" className="k12 k-m">{hidden ? "Khoá khi địa điểm đang bị quản trị ẩn." : "Xoá toà nhà, tầng, điểm, lối đi. Không hoàn tác."}</div></div>
                            <button type="button" className="k-btn d" aria-describedby="dz-2" aria-haspopup="dialog" disabled={hidden || busy} onClick={() => setDeleting("")}>{hidden && <Lc name="lock" size={16} />}Xoá địa điểm…</button>
                        </div>
                    </section>
                </>
            )}

            {deleting !== null && (
                <Dialog alert title={`Xoá ${venue.name}?`} onClose={() => setDeleting(null)}
                    actions={<><Button onClick={() => setDeleting(null)}>Huỷ</Button><Button variant="danger" busy={busy} disabled={deleting.trim() !== venue.name.trim()} onClick={() => void remove()}>Xoá vĩnh viễn</Button></>}>
                    <ul className="k14" style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 8 }}>
                        <li>{data.buildings.length} toà nhà, {data.floors.length} tầng, {data.locations.length} điểm và mọi lối đi.</li>
                        <li>Mọi mã QR hết hiệu lực, kể cả tem đã dán.</li>
                    </ul>
                    <div className="k-field">
                        <label htmlFor="dl-conf">Gõ {venue.name} để xác nhận</label>
                        <input id="dl-conf" className="k-input" autoComplete="off" aria-describedby="dl-h" value={deleting} onChange={e => setDeleting(e.target.value)} />
                        <span id="dl-h" className="k-hint">Không hoàn tác.</span>
                    </div>
                </Dialog>
            )}
        </div>
    );
}
