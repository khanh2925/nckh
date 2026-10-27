import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { groupLabel, type LocationTypeDto, type UserDto, type UserStatus, type VenueDto, type VenueStatus } from "@indoor-map/core";
import { adminApi } from "../console/api";
import { useAuth } from "../console/auth";
import { Button, Card, ColorPicker, ErrorNote, Field, IconPicker, Kpi, NotYet, PageHead, Spinner, Status, Table, useAction, useFeedback } from "../console/ui";
import { KIND_LABEL, VenueStatus as VenueStatusText } from "../builder/pages/VenuesPage";

// ---------------------------------------------------------------- dữ liệu dùng chung
function useAdminData() {
    const [users, setUsers] = useState<UserDto[] | null>(null);
    const [venues, setVenues] = useState<VenueDto[] | null>(null);
    const [error, setError] = useState<unknown>(null);
    const [latency, setLatency] = useState<number | null>(null);
    const load = useCallback(async () => {
        const t = performance.now();
        try {
            const [u, v] = await Promise.all([adminApi.users(), adminApi.venues()]);
            setLatency(Math.round(performance.now() - t));
            setUsers(u);
            setVenues(v);
            setError(null);
        } catch (e) {
            setError(e);
        }
    }, []);
    useEffect(() => {
        let alive = true;
        const t = performance.now();
        Promise.all([adminApi.users(), adminApi.venues()])
            .then(([u, v]) => {
                if (!alive) return;
                setLatency(Math.round(performance.now() - t));
                setUsers(u);
                setVenues(v);
            })
            .catch(e => alive && setError(e));
        return () => {
            alive = false;
        };
    }, []);
    return { users, venues, error, latency, reload: load, setUsers, setVenues };
}

const USER_STATUS: Record<UserStatus, [string, "live" | "ok" | "err"]> = { PENDING: ["Chờ duyệt", "live"], ACTIVE: ["Hoạt động", "ok"], LOCKED: ["Bị khoá", "err"] };

export function AdminLayout() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [pending, setPending] = useState<number | null>(null);
    useEffect(() => {
        void adminApi.users("PENDING").then(list => setPending(list.length)).catch(() => setPending(null));
    }, []);
    return (
        <div className="cb-admin">
            <aside className="cb-admin-side">
                <NavLink to="/admin" className="cb-brand" end>Indoor Map · Hệ thống</NavLink>
                <NavLink to="/admin" end>Tổng quan</NavLink>
                <NavLink to="/admin/review">Kiểm duyệt địa điểm</NavLink>
                <NavLink to="/admin/users">Người dùng {pending ? <span className="cb-badge">{pending}</span> : null}</NavLink>
                <NavLink to="/admin/templates">Danh mục loại mẫu</NavLink>
                <NavLink to="/admin/settings">Cấu hình hệ thống</NavLink>
                <NavLink to="/admin/logs">Nhật ký hệ thống</NavLink>
                <NavLink to="/builder">Mở Builder →</NavLink>
                <div className="cb-admin-foot">
                    <span>{user?.email}</span>
                    <button type="button" onClick={() => { logout(); navigate("/login"); }}>Đăng xuất</button>
                </div>
            </aside>
            <main className="cb-admin-main"><Outlet /></main>
        </div>
    );
}

// ---------------------------------------------------------------- tổng quan
export function AdminDashboard() {
    const { users, venues, error, latency, reload } = useAdminData();
    if (error) return <ErrorNote error={error} onRetry={() => void reload()} />;
    if (!users || !venues) return <Spinner />;
    const pendingUsers = users.filter(u => u.status === "PENDING");
    const hidden = venues.filter(v => v.status === "HIDDEN");
    const drafts = venues.filter(v => v.status === "DRAFT");
    return (
        <>
            <PageHead title="Tổng quan hệ thống" sub={new Date().toLocaleString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                actions={<Button onClick={() => void reload()} icon="bi-arrow-clockwise">Làm mới</Button>} />
            <div className="cb-kpis">
                <Kpi label="Địa điểm" value={venues.length} sub={`${venues.filter(v => v.status === "PUBLISHED").length} công khai · ${drafts.length} nháp · ${hidden.length} ẩn`} />
                <Kpi label="Tài khoản chờ duyệt" value={pendingUsers.length} tone={pendingUsers.length ? "live" : undefined} sub={pendingUsers[0] ? `mới nhất: ${pendingUsers[pendingUsers.length - 1]!.email}` : "không có"} />
                <Kpi label="Người dùng" value={users.length} sub={`${users.filter(u => u.role === "SYSTEM_ADMIN").length} quản trị hệ thống`} />
                <Kpi label="Điểm quan tâm" value={venues.reduce((s, v) => s + (v.locationCount ?? 0), 0)} sub="tất cả địa điểm" />
                <Kpi label="API" value={latency != null ? `${latency} ms` : "—"} tone="ok" sub="thời gian tải trang này" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.3fr) minmax(0, 1fr)", gap: 18, alignItems: "start" }}>
                <Card title="Hàng đợi cần xử lý" pad={false} actions={<Button small to="/admin/users">Người dùng →</Button>}>
                    <Table head={["Việc", "Đối tượng", ""]} minWidth={480}>
                        {pendingUsers.map(u => (
                            <tr key={u.id}><td><Status kind="live">Duyệt tài khoản</Status></td><td>{u.fullName} · <span className="cb-mono">{u.email}</span></td><td style={{ textAlign: "right" }}><Button small to="/admin/users">Xem</Button></td></tr>
                        ))}
                        {hidden.map(v => (
                            <tr key={v.id}><td><Status kind="err">Đang bị ẩn</Status></td><td>{v.name} · {v.ownerName}</td><td style={{ textAlign: "right" }}><Button small to="/admin/review">Xem</Button></td></tr>
                        ))}
                        {!pendingUsers.length && !hidden.length && <tr><td colSpan={3} className="cb-muted">Không có việc chờ xử lý.</td></tr>}
                    </Table>
                </Card>
                <div className="cb-stack">
                    <Card title="Sức khoẻ hệ thống">
                        <div className="cb-kv">
                            <span>API (Spring Boot)</span><Status kind="ok">phản hồi {latency} ms</Status>
                            <span>Cơ sở dữ liệu</span><Status kind="ok">đọc được ({users.length + venues.length} bản ghi)</Status>
                        </div>
                    </Card>
                    <NotYet title="Giám sát chi tiết & hoạt động gần đây">Cần API giám sát (pool kết nối, dung lượng lưu trữ, email) và nhật ký hoạt động. Xem trang Nhật ký hệ thống.</NotYet>
                </div>
            </div>
        </>
    );
}

// ---------------------------------------------------------------- kiểm duyệt địa điểm
export function AdminReview() {
    const { users, venues, error, reload, setVenues } = useAdminData();
    const { confirm } = useFeedback();
    const { busy, run } = useAction();
    const [filter, setFilter] = useState<VenueStatus | "ALL">("ALL");
    const [ownerFor, setOwnerFor] = useState<VenueDto | null>(null);
    const [ownerId, setOwnerId] = useState<number | "">("");
    if (error) return <ErrorNote error={error} onRetry={() => void reload()} />;
    if (!venues || !users) return <Spinner />;
    const list = venues.filter(v => filter === "ALL" || v.status === filter);
    const count = (s: VenueStatus) => venues.filter(v => v.status === s).length;

    const setStatus = async (v: VenueDto, status: VenueStatus) => {
        const text = status === "HIDDEN" ? `Ẩn “${v.name}” khỏi khách?` : status === "PUBLISHED" ? `Cho “${v.name}” hiện công khai?` : `Đưa “${v.name}” về bản nháp?`;
        const detail = status === "HIDDEN" ? "Chủ địa điểm sẽ không tự xuất bản lại được cho tới khi quản trị hệ thống bỏ ẩn." : undefined;
        if (!(await confirm(text, { detail, danger: status === "HIDDEN", okLabel: status === "HIDDEN" ? "Ẩn địa điểm" : "Đồng ý" }))) return;
        const saved = await run(() => adminApi.setVenueStatus(v.id, status), "Đã cập nhật trạng thái");
        if (saved) setVenues(venues.map(x => (x.id === v.id ? { ...x, ...saved } : x)));
    };
    const saveOwner = async (e: FormEvent) => {
        e.preventDefault();
        if (!ownerFor || !ownerId) return;
        const saved = await run(() => adminApi.setVenueOwner(ownerFor.id, Number(ownerId)), "Đã chuyển chủ sở hữu");
        if (saved) {
            setVenues(venues.map(x => (x.id === ownerFor.id ? { ...x, ...saved } : x)));
            setOwnerFor(null);
        }
    };

    return (
        <>
            <PageHead title="Kiểm duyệt địa điểm" sub="Ẩn địa điểm vi phạm hoặc sai lệch, khôi phục hiển thị, chuyển quyền sở hữu."
                actions={<div className="cb-seg">{(["ALL", "PUBLISHED", "DRAFT", "HIDDEN"] as const).map(s => (
                    <button key={s} type="button" aria-pressed={filter === s} onClick={() => setFilter(s)}>
                        {s === "ALL" ? `Tất cả · ${venues.length}` : s === "PUBLISHED" ? `Công khai · ${count("PUBLISHED")}` : s === "DRAFT" ? `Nháp · ${count("DRAFT")}` : `Đã ẩn · ${count("HIDDEN")}`}
                    </button>
                ))}</div>} />
            <Table head={["Địa điểm", "Loại hình", "Chủ sở hữu", "Dữ liệu", "Trạng thái", ""]} minWidth={980}>
                {list.map(v => (
                    <tr key={v.id}>
                        <td><div style={{ fontWeight: 500 }}>{v.name}</div><div className="cb-mono" style={{ color: "#6B7280" }}>/v/{v.slug}</div></td>
                        <td>{KIND_LABEL[v.kind ?? "other"] ?? v.kind}</td>
                        <td>{v.ownerName ?? "—"}</td>
                        <td className="cb-muted">{v.buildingCount ?? 0} toà · {v.floorCount ?? 0} tầng · {v.locationCount ?? 0} điểm</td>
                        <td><VenueStatusText status={v.status} /></td>
                        <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                            {v.status === "PUBLISHED" && <a href={`/v/${v.slug}`} target="_blank" rel="noreferrer" className="cb-btn cb-btn-ghost is-small">Xem</a>}
                            <Button small to={`/builder/v/${v.id}/publish`}>Mở</Button>{" "}
                            <Button small onClick={() => { setOwnerFor(v); setOwnerId(v.ownerId ?? ""); }}>Đổi chủ</Button>{" "}
                            {v.status === "HIDDEN"
                                ? <Button small busy={busy} onClick={() => void setStatus(v, "DRAFT")}>Bỏ ẩn</Button>
                                : <Button small variant="danger" busy={busy} onClick={() => void setStatus(v, "HIDDEN")}>Ẩn</Button>}
                        </td>
                    </tr>
                ))}
                {!list.length && <tr><td colSpan={6} className="cb-muted">Không có địa điểm.</td></tr>}
            </Table>
            {ownerFor && (
                <Card title={`Chuyển chủ sở hữu · ${ownerFor.name}`}>
                    <form className="cb-actions" onSubmit={saveOwner}>
                        <select className="cb-input" style={{ width: 360 }} aria-label="Chủ sở hữu mới" value={ownerId} onChange={e => setOwnerId(e.target.value ? Number(e.target.value) : "")}>
                            <option value="">Chọn người dùng…</option>
                            {users.filter(u => u.status === "ACTIVE").map(u => <option key={u.id} value={u.id}>{u.fullName} · {u.email}</option>)}
                        </select>
                        <Button type="submit" variant="primary" busy={busy} disabled={!ownerId}>Chuyển</Button>
                        <Button onClick={() => setOwnerFor(null)}>Huỷ</Button>
                    </form>
                </Card>
            )}
            <NotYet title="Hàng đợi kiểm duyệt trước khi xuất bản">Hiện chủ địa điểm xuất bản ngay; quản trị hệ thống kiểm tra sau và ẩn khi cần. Quy trình “chờ duyệt rồi mới công khai” và báo cáo từ khách cần thêm API.</NotYet>
        </>
    );
}

// ---------------------------------------------------------------- người dùng
export function AdminUsers() {
    const { users, venues, error, reload, setUsers } = useAdminData();
    const { user: me } = useAuth();
    const { confirm } = useFeedback();
    const { busy, run } = useAction();
    const [filter, setFilter] = useState<UserStatus | "ALL">("ALL");
    const [query, setQuery] = useState("");
    if (error) return <ErrorNote error={error} onRetry={() => void reload()} />;
    if (!users || !venues) return <Spinner />;
    const q = query.trim().toLowerCase();
    const list = users.filter(u => (filter === "ALL" || u.status === filter) && (!q || `${u.fullName} ${u.email}`.toLowerCase().includes(q)));

    const setStatus = async (u: UserDto, status: UserStatus) => {
        const label = status === "ACTIVE" ? (u.status === "PENDING" ? "Duyệt" : "Mở khoá") : status === "LOCKED" ? (u.status === "PENDING" ? "Từ chối" : "Khoá") : status;
        if (status === "LOCKED" && !(await confirm(`${label} tài khoản ${u.email}?`, { danger: true, okLabel: label, detail: "Người này sẽ không đăng nhập được. Địa điểm của họ vẫn giữ nguyên." }))) return;
        const saved = await run(() => adminApi.setUserStatus(u.id, status), `${label}: ${u.email}`);
        if (saved) setUsers(users.map(x => (x.id === u.id ? saved : x)));
    };

    return (
        <>
            <PageHead title="Người dùng" sub={`${users.length} tài khoản · ${users.filter(u => u.status === "PENDING").length} chờ duyệt. Khách tham quan không cần tài khoản.`} />
            <div className="cb-actions">
                <div className="cb-seg">{(["ALL", "PENDING", "ACTIVE", "LOCKED"] as const).map(s => (
                    <button key={s} type="button" aria-pressed={filter === s} onClick={() => setFilter(s)}>
                        {s === "ALL" ? `Tất cả · ${users.length}` : `${USER_STATUS[s][0]} · ${users.filter(u => u.status === s).length}`}
                    </button>
                ))}</div>
                <input className="cb-input" style={{ width: 300 }} type="search" aria-label="Tìm người dùng" placeholder="Tìm theo tên, email…" value={query} onChange={e => setQuery(e.target.value)} />
            </div>
            <Table head={["Người dùng", "Vai trò", "Trạng thái", "Địa điểm", "Tham gia", ""]} minWidth={940}>
                {list.map(u => {
                    const owned = venues.filter(v => v.ownerId === u.id);
                    const [label, kind] = USER_STATUS[u.status];
                    return (
                        <tr key={u.id}>
                            <td><div style={{ fontWeight: 500 }}>{u.fullName}</div><div className="cb-mono" style={{ color: "#6B7280" }}>{u.email}</div></td>
                            <td className="cb-mono">{u.role}</td>
                            <td><Status kind={kind}>{label}</Status></td>
                            <td>{owned.length ? owned.map(v => v.name).join(", ") : <span className="cb-muted">—</span>}</td>
                            <td>{u.createdAt ? new Date(u.createdAt).toLocaleDateString("vi-VN") : "—"}</td>
                            <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                                {u.id === me?.id ? <span className="cb-muted">bạn</span> : u.status === "PENDING" ? (
                                    <><Button small variant="primary" busy={busy} onClick={() => void setStatus(u, "ACTIVE")}>Duyệt</Button>{" "}<Button small variant="danger" onClick={() => void setStatus(u, "LOCKED")}>Từ chối</Button></>
                                ) : u.status === "ACTIVE" ? <Button small variant="danger" onClick={() => void setStatus(u, "LOCKED")}>Khoá</Button>
                                    : <Button small busy={busy} onClick={() => void setStatus(u, "ACTIVE")}>Mở khoá</Button>}
                            </td>
                        </tr>
                    );
                })}
                {!list.length && <tr><td colSpan={6} className="cb-muted">Không có người dùng khớp.</td></tr>}
            </Table>
            <p className="cb-muted">Quản trị hệ thống đầu tiên được tạo tự động từ biến môi trường ADMIN_EMAIL / ADMIN_PASSWORD của backend khi bảng người dùng còn trống.</p>
        </>
    );
}

// ---------------------------------------------------------------- danh mục loại mẫu
const KINDS = ["all", "airport", "hospital", "school", "mall", "park", "office"];
const KIND_TAB: Record<string, string> = { all: "Chung", airport: "Sân bay", hospital: "Bệnh viện", school: "Trường học", mall: "TTTM", park: "Công viên", office: "Văn phòng" };
const GROUPS = ["gate", "procedure", "food", "service", "restroom", "transport", "health", "study", "office", "leisure"];

export function AdminTemplates() {
    const [templates, setTemplates] = useState<LocationTypeDto[] | null>(null);
    const [error, setError] = useState<unknown>(null);
    const [kind, setKind] = useState("airport");
    const [form, setForm] = useState<Partial<LocationTypeDto> | null>(null);
    const { confirm } = useFeedback();
    const { busy, run } = useAction();
    const load = useCallback(() => {
        adminApi.templates().then(setTemplates).catch(setError);
    }, []);
    useEffect(load, [load]);
    const list = useMemo(() => (templates ?? []).filter(t => t.kind === kind).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)), [templates, kind]);
    if (error) return <ErrorNote error={error} onRetry={load} />;
    if (!templates) return <Spinner />;

    const save = async (e: FormEvent) => {
        e.preventDefault();
        if (!form) return;
        const body = { ...form, code: form.code?.trim(), name: form.name?.trim(), kind: form.kind ?? kind, sortOrder: form.sortOrder ?? (list.length + 1) * 10 };
        const saved = await run(() => (form.id ? adminApi.updateTemplate(form.id, body) : adminApi.createTemplate(body)), "Đã lưu mẫu");
        if (saved) {
            setForm(saved);
            load();
        }
    };
    const remove = async () => {
        if (!form?.id) return;
        if (!(await confirm(`Xoá mẫu “${form.name}”?`, { danger: true, okLabel: "Xoá", detail: "Không ảnh hưởng các địa điểm đã sao chép mẫu này." }))) return;
        if (await run(() => adminApi.removeTemplate(form.id!), "Đã xoá mẫu") !== null) {
            setForm(null);
            load();
        }
    };

    return (
        <>
            <PageHead title="Danh mục loại địa điểm mẫu" sub={`${templates.length} mẫu · khi chủ địa điểm tạo địa điểm mới, mẫu “Chung” + mẫu theo loại hình được sao chép vào địa điểm đó. Sửa mẫu không ảnh hưởng địa điểm đã tạo.`}
                actions={<Button variant="primary" onClick={() => setForm({ kind, code: "", name: "", icon: "bi-geo-alt", color: "#3f6fb5", groupName: "service" })}>Thêm mẫu</Button>} />
            <div className="cb-seg">{KINDS.map(k => <button key={k} type="button" aria-pressed={kind === k} onClick={() => { setKind(k); setForm(null); }}>{KIND_TAB[k]} · {templates.filter(t => t.kind === k).length}</button>)}</div>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 380px", gap: 20, alignItems: "start" }}>
                <Table head={["Mẫu", "Mã", "Nhóm", ""]} minWidth={520}>
                    {list.map(t => (
                        <tr key={t.id} className={`is-click${form?.id === t.id ? " is-selected" : ""}`} onClick={() => setForm({ ...t })}>
                            <td><span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}><span style={{ width: 24, height: 24, borderRadius: 6, background: t.color, color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><i className={`bi ${t.icon}`} aria-hidden="true" /></span>{t.name}</span></td>
                            <td className="cb-mono">{t.code}</td>
                            <td>{groupLabel(t.groupName)}</td>
                            <td style={{ textAlign: "right" }}><button type="button" className="cb-btn cb-btn-ghost is-small">Sửa</button></td>
                        </tr>
                    ))}
                    {!list.length && <tr><td colSpan={4} className="cb-muted">Chưa có mẫu cho loại hình này.</td></tr>}
                </Table>
                {form ? (
                    <Card title={form.id ? `Sửa mẫu · ${form.name}` : "Mẫu mới"} actions={form.id ? <Button small variant="danger" onClick={() => void remove()}>Xoá</Button> : undefined}>
                        <form className="cb-form" onSubmit={save}>
                            <div className="cb-grid-2">
                                <Field label="Tên" required value={form.name ?? ""} onChange={e => setForm({ ...form, name: e.target.value })} />
                                <Field label="Mã" required value={form.code ?? ""} onChange={e => setForm({ ...form, code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })} />
                            </div>
                            <div className="cb-grid-2">
                                <div className="cb-field"><label htmlFor="tk">Loại hình</label>
                                    <select id="tk" className="cb-input" value={form.kind ?? kind} onChange={e => setForm({ ...form, kind: e.target.value })}>{KINDS.map(k => <option key={k} value={k}>{KIND_TAB[k]}</option>)}</select></div>
                                <div className="cb-field"><label htmlFor="tg">Nhóm lọc</label>
                                    <select id="tg" className="cb-input" value={form.groupName ?? ""} onChange={e => setForm({ ...form, groupName: e.target.value })}>{GROUPS.map(g => <option key={g} value={g}>{groupLabel(g)}</option>)}</select></div>
                            </div>
                            <ColorPicker label="Màu mặc định" value={form.color ?? "#3f6fb5"} onChange={c => setForm({ ...form, color: c })} />
                            <IconPicker value={form.icon ?? "bi-geo-alt"} onChange={icon => setForm({ ...form, icon })} />
                            <div className="cb-actions"><Button type="submit" variant="primary" busy={busy}>Lưu mẫu</Button><Button onClick={() => setForm(null)}>Đóng</Button></div>
                        </form>
                    </Card>
                ) : <Card title="Chọn một mẫu để sửa"><p className="cb-muted">Mẫu “Chung” (nhà vệ sinh, thang máy, lối ra…) được thêm cho mọi loại hình.</p></Card>}
            </div>
        </>
    );
}

// ---------------------------------------------------------------- cấu hình & nhật ký (chưa có API)
export function AdminSettings() {
    const apiBase = import.meta.env.VITE_API_BASE_URL || "(cùng địa chỉ website / proxy /api)";
    return (
        <>
            <PageHead title="Cấu hình hệ thống" sub="Áp dụng cho mọi địa điểm." />
            <NotYet title="Chưa có API cấu hình">Các tham số dưới đây hiện cố định trong mã nguồn hoặc biến môi trường backend. Khi có API cấu hình, quản trị hệ thống sẽ chỉnh trực tiếp ở đây.</NotYet>
            <Table head={["Nhóm", "Tham số", "Giá trị hiện tại", "Đặt ở đâu"]} minWidth={860}>
                {[
                    ["Đăng ký", "Tài khoản mới", "Chờ duyệt (PENDING)", "AuthServiceImpl"],
                    ["Đăng ký", "Quản trị hệ thống đầu tiên", "ADMIN_EMAIL / ADMIN_PASSWORD", "Biến môi trường backend"],
                    ["Bảo mật", "Khoá đăng nhập tạm", "sau nhiều lần sai liên tiếp", "LoginAttemptService"],
                    ["Bảo mật", "Hạn JWT", "app.jwt.* trong application.properties", "Back-End"],
                    ["Chỉ đường", "Tốc độ đi bộ", "1,2 m/s", "packages/core/src/routing.ts"],
                    ["Chỉ đường", "Phạt đổi tầng", "30 m tương đương", "packages/core/src/routing.ts"],
                    ["Chỉ đường", "Bán kính nhập lối đi", "60 m", "packages/core/src/routing.ts"],
                    ["Chỉ đường", "Bán kính mốc trong chỉ dẫn", "14 m", "packages/core/src/directions.ts"],
                    ["Định vị", "Ngưỡng gợi ý quét lại QR", "≈ 14 m độ lệch ước lượng", "packages/core/src/pdr.ts"],
                    ["Bản đồ nền", "Tile ngoài trời", "CARTO light (OpenStreetMap)", "Front-End"],
                    ["Frontend", "Địa chỉ API", apiBase, "VITE_API_BASE_URL"]
                ].map(r => <tr key={r[1]}>{r.map((c, i) => <td key={i} className={i === 2 || i === 3 ? "cb-mono" : undefined}>{c}</td>)}</tr>)}
            </Table>
        </>
    );
}

export function AdminLogs() {
    return (
        <>
            <PageHead title="Nhật ký hệ thống" sub="Mọi hành động quản trị và sự kiện bảo mật." />
            <NotYet title="Chưa có API nhật ký">Backend chưa ghi nhật ký hoạt động (đăng nhập, khoá tạm, duyệt tài khoản, xuất bản, nhập CSV…). Cần thêm bảng audit_logs và API đọc có lọc theo loại/người/thời gian. Hiện có thể xem log máy chủ trên Render.</NotYet>
        </>
    );
}
