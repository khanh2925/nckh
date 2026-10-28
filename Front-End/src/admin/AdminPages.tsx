import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { groupLabel, type LocationTypeDto, type UserDto, type UserStatus, type VenueDto, type VenueStatus } from "@indoor-map/core";
import { adminApi } from "../console/api";
import { ConsoleFrame, HeaderActions, SideGroup, SideItem, Sidebar } from "../console/Shell";
import { useAuth } from "../console/auth";
import Lc, { type LucideName } from "../design/Lc";
import { Button, COLORS, ColorPicker, IconPicker, useAction, useFeedback } from "../console/ui";
import { KIND_LABEL } from "../builder/pages/VenuesPage";
import "./admin.css";

// ---------------------------------------------------------------- dữ liệu dùng chung
function useAdminData() {
    const [users, setUsers] = useState<UserDto[] | null>(null);
    const [venues, setVenues] = useState<VenueDto[] | null>(null);
    const [error, setError] = useState<unknown>(null);
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        let alive = true;
        Promise.all([adminApi.users(), adminApi.venues()])
            .then(([u, v]) => {
                if (!alive) return;
                setUsers(u);
                setVenues(v);
                setError(null);
            })
            .catch(e => alive && setError(e));
        return () => {
            alive = false;
        };
    }, [attempt]);
    const reload = useCallback(() => {
        setError(null);
        setUsers(null);
        setVenues(null);
        setAttempt(a => a + 1);
    }, []);
    return { users, venues, error, reload, setUsers, setVenues };
}

const ADMIN_PAGES: [string, string, LucideName][] = [
    ["", "Tổng quan", "layout-dashboard"], ["review", "Kiểm duyệt", "shield-check"], ["users", "Người dùng", "users"],
    ["templates", "Danh mục mẫu", "list"], ["settings", "Cấu hình", "settings"], ["logs", "Nhật ký", "file-text"]
];

export function AdminLayout() {
    const { pathname } = useLocation();
    const [pending, setPending] = useState<number | null>(null);
    useEffect(() => {
        void adminApi.users("PENDING").then(list => setPending(list.length)).catch(() => setPending(null));
    }, []);
    const page = pathname.replace(/^\/admin\/?/, "").split("/")[0] ?? "";
    const current = ADMIN_PAGES.find(([path]) => path === page)?.[1] ?? "Tổng quan";
    return (
        <ConsoleFrame area="admin" crumbs={[{ label: "Quản trị hệ thống", to: "/admin" }, { label: current }]}
            nav={(
                <Sidebar label="Quản trị hệ thống">
                    <SideGroup>Quản trị hệ thống</SideGroup>
                    {ADMIN_PAGES.map(([path, label, icon]) => (
                        <SideItem key={path} to={path ? `/admin/${path}` : "/admin"} end={!path} icon={icon} label={label}
                            count={path === "users" && pending ? `${pending} chờ` : undefined} />
                    ))}
                </Sidebar>
            )}>
            <div className="k-page"><Outlet /></div>
        </ConsoleFrame>
    );
}

// ---------------------------------------------------------------- thành phần nhỏ
type Tone = "ok" | "warn" | "danger" | "";
const TONE_COLOR: Record<Tone, string> = { ok: "var(--ok)", warn: "var(--warn)", danger: "var(--danger)", "": "var(--muted)" };

function Badge({ children, tone = "", icon }: { children: ReactNode; tone?: Tone; icon?: LucideName }) {
    return <span className={`k-badge ${tone ? `k-${tone}` : "k-m"}`}>{icon && <Lc name={icon} size={14} color={TONE_COLOR[tone]} />}{children}</span>;
}

function Skel({ w, h = 12 }: { w: number | string; h?: number }) {
    return <span className="k-skel" style={{ width: w, height: h }} />;
}

function Title({ children, after }: { children: string; after?: ReactNode }) {
    return <div className="k-title"><h1 className="k24">{children}</h1>{after}</div>;
}

function Kpi({ value, label, sub }: { value: ReactNode; label: string; sub?: ReactNode }) {
    return (
        <div className="k-card tight">
            <div className="k-kpi"><span className="k28">{value}</span><span className="k12 k-m">{label}</span>{sub && <span className="k12">{sub}</span>}</div>
        </div>
    );
}
const NA = <span className="k-m" aria-label="Không có số liệu">—</span>;

function LoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
    return (
        <div className="k-note" role="alert" style={{ alignItems: "center" }}>
            <Lc name="circle-alert" size={16} color="var(--danger)" />
            <div><span className="k-b k-danger">Không tải được dữ liệu.</span> <span className="k-m">{(error as Error)?.message}</span></div>
            <div style={{ marginLeft: "auto" }}><Button small icon="refresh-cw" onClick={onRetry}>Thử lại</Button></div>
        </div>
    );
}

function Chips<T extends string>({ items, value, onChange, label }: { items: [T, string, number | null][]; value: T; onChange: (v: T) => void; label: string }) {
    return (
        <div role="group" aria-label={label} className="ka-chips">
            {items.map(([key, text, n]) => (
                <button key={key} type="button" className="k-chip" aria-pressed={value === key} onClick={() => onChange(key)}>
                    {text}{n != null && <span className={value === key ? undefined : "k-m"}>{n}</span>}
                </button>
            ))}
        </div>
    );
}

/** Hộp thoại theo bản thiết kế: tiêu đề 20, nội dung, chân có ghi chú trái + nút phải. Esc hoặc bấm nền để đóng. */
function Dialog({ title, children, note, actions, onClose }: { title: string; children: ReactNode; note?: string; actions: ReactNode; onClose: () => void }) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        ref.current?.querySelector<HTMLElement>("select, textarea, input, button")?.focus();
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);
    return (
        <div className="k-scrim" onClick={onClose}>
            <div ref={ref} className="k-dlg" role="dialog" aria-modal="true" aria-labelledby="ka-dlg-t" onClick={e => e.stopPropagation()}>
                <h2 id="ka-dlg-t" className="k20">{title}</h2>
                {children}
                <div className="ka-dlg-foot">{note && <span className="k12 k-m left">{note}</span>}{actions}</div>
            </div>
        </div>
    );
}

function DangerButton({ children, onClick, busy, disabled, title }: { children: ReactNode; onClick: () => void; busy?: boolean; disabled?: boolean; title?: string }) {
    return (
        <button type="button" className="k-btn d" style={{ borderColor: "var(--rule)" }} onClick={onClick} disabled={disabled || busy} title={title} aria-busy={busy || undefined}>
            {busy && <span className="cb-spinner is-inline" aria-hidden="true" />}{children}
        </button>
    );
}

function Who({ user, extra }: { user: UserDto; extra?: string }) {
    return <div><span className="k14 k-b ka-block">{user.fullName}</span><span className="k12 k-m">{user.email}{extra ? `, ${extra}` : ""}</span></div>;
}

/** "3 giờ", "2 ngày"… tính từ thời điểm tạo */
function since(iso?: string): { text: string; late: boolean } | null {
    if (!iso) return null;
    const ms = Date.now() - new Date(iso).getTime();
    if (!Number.isFinite(ms) || ms < 0) return null;
    const min = Math.floor(ms / 60000);
    if (min < 60) return { text: `${Math.max(1, min)} phút`, late: false };
    const h = Math.floor(min / 60);
    if (h < 24) return { text: `${h} giờ`, late: false };
    const d = Math.floor(h / 24);
    return { text: `${d} ngày`, late: d >= 2 };
}

const dateTime = (iso?: string) => (iso ? new Date(iso).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "");

// ---------------------------------------------------------------- tổng quan
export function AdminDashboard() {
    const { users, venues, error, reload } = useAdminData();
    const ready = users && venues;
    const pending = (users ?? []).filter(u => u.status === "PENDING").sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
    const lockedOwners = new Set((users ?? []).filter(u => u.status === "LOCKED").map(u => u.id));
    const orphaned = (venues ?? []).filter(v => v.ownerId != null && lockedOwners.has(v.ownerId));
    const count = (s: VenueStatus) => (venues ?? []).filter(v => v.status === s).length;
    const oldest = since(pending[0]?.createdAt);
    const emailOf = (id?: number) => users?.find(u => u.id === id)?.email ?? "";
    const jobs = pending.length + orphaned.length;

    const kpiLabels = ["Địa điểm", "Chủ bị khoá", "Tài khoản chờ duyệt"];
    return (
        <>
            <HeaderActions><Button to="/admin/logs">Nhật ký</Button></HeaderActions>
            <Title>Tổng quan hệ thống</Title>
            {error ? <LoadError error={error} onRetry={reload} /> : null}
            <section aria-label="Số liệu chính" className="ka-kpis" aria-busy={!ready && !error ? true : undefined}>
                {ready ? (
                    <>
                        <Kpi value={venues.length} label="Địa điểm" sub={`${count("PUBLISHED")} công khai, ${count("DRAFT")} nháp, ${count("HIDDEN")} ẩn`} />
                        <Kpi value={orphaned.length} label="Chủ bị khoá" sub="địa điểm cần chuyển chủ" />
                        <Kpi value={pending.length} label="Tài khoản chờ duyệt" sub={oldest ? `lâu nhất ${oldest.text}` : "không có"} />
                    </>
                ) : kpiLabels.map(label => (
                    <div key={label} className="k-card tight">
                        <div className="k-kpi">{error ? NA : <Skel w={48} h={32} />}<span className="k12 k-m">{label}</span>{error ? <span className="k12 k-danger">Không tải được</span> : <Skel w={140} />}</div>
                    </div>
                ))}
                <Kpi value={NA} label="Lượt mở bản đồ" sub={<span className="k-m">Chưa khả dụng</span>} />
                <Kpi value={NA} label="Lỗi API 24 giờ" sub={<span className="k-m">Chưa khả dụng</span>} />
            </section>
            <div className="ka-cols">
                <section className="k-card ka-flush" aria-labelledby="q-title" aria-busy={!ready && !error ? true : undefined}>
                    <div className="ka-hd"><h2 id="q-title" className="k16">Hàng đợi cần xử lý</h2><div className="end">{ready ? <span className="k14 k-m">{jobs} việc</span> : !error && <Skel w={40} />}</div></div>
                    {error ? <div className="ka-empty"><p className="k14 k-m">Không tải được hàng đợi.</p></div> : ready && jobs === 0 ? (
                        <div className="ka-empty"><h3 className="k16">Không có việc chờ xử lý</h3><p className="k14 k-m">Tài khoản mới và địa điểm có chủ bị khoá sẽ hiện ở đây.</p></div>
                    ) : (
                        <div className="ka-scroll">
                            <table className="k-tbl">
                                <thead><tr><th scope="col">Việc</th><th scope="col">Đối tượng</th><th scope="col">Chờ</th><th scope="col"><span className="sr-only">Thao tác</span></th></tr></thead>
                                <tbody>
                                    {!ready ? [128, 112, 112].map((w, i) => (
                                        <tr key={i}><td><Skel w={w} /></td><td><div className="k-stack" style={{ gap: 8 }}><Skel w={110} h={16} /><Skel w={140} /></div></td><td><Skel w={40} /></td><td><div className="ka-acts"><Skel w={64} h={32} /></div></td></tr>
                                    )) : (
                                        <>
                                            {pending.map(u => {
                                                const wait = since(u.createdAt);
                                                return (
                                                    <tr key={`u${u.id}`}>
                                                        <td>Duyệt tài khoản</td>
                                                        <td><span className="k-b">{u.fullName}</span><span className="k12 k-m ka-block">{u.email}</span></td>
                                                        <td>{wait ? (wait.late ? <Badge tone="warn" icon="clock">{wait.text}</Badge> : wait.text) : "—"}</td>
                                                        <td><div className="ka-acts"><Button small to="/admin/users">Xử lý</Button></div></td>
                                                    </tr>
                                                );
                                            })}
                                            {orphaned.map(v => (
                                                <tr key={`v${v.id}`}>
                                                    <td>Chuyển chủ địa điểm</td>
                                                    <td><span className="k-b">{v.name}</span><span className="k12 k-m ka-block">Chủ bị khoá: {emailOf(v.ownerId) || v.ownerName}</span></td>
                                                    <td>—</td>
                                                    <td><div className="ka-acts"><Button small to="/admin/review">Xử lý</Button></div></td>
                                                </tr>
                                            ))}
                                        </>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
                <div className="k-stack" style={{ gap: 24 }}>
                    <section className="k-card ka-flush" aria-labelledby="h-title">
                        <div className="ka-hd"><h2 id="h-title" className="k16">Sức khoẻ hệ thống</h2><div className="end"><Badge>Chưa khả dụng</Badge></div></div>
                        <div className="ka-body"><p className="k14 k-b">Chưa kết nối giám sát</p><p className="k12 k-m">API, cơ sở dữ liệu, lưu trữ mặt bằng, email</p></div>
                    </section>
                    <section className="k-card ka-flush" aria-labelledby="a-title">
                        <div className="ka-hd"><h2 id="a-title" className="k16">Hoạt động gần đây</h2><div className="end"><Badge>Chưa khả dụng</Badge></div></div>
                        <div className="ka-body"><p className="k14 k-b">Chưa ghi nhật ký hoạt động</p><p className="k12 k-m">Đăng nhập, duyệt tài khoản, xuất bản, nhập dữ liệu</p></div>
                        <div className="ka-foot"><Button small variant="ghost" to="/admin/logs">Xem nhật ký</Button></div>
                    </section>
                </div>
            </div>
        </>
    );
}

// ---------------------------------------------------------------- kiểm duyệt địa điểm
type ReviewFilter = "ALL" | "PUBLISHED" | "DRAFT" | "LOCKED_OWNER" | "HIDDEN";
type ReviewDialog = "hide" | "unhide" | "owner" | null;

function venueBadge(v: VenueDto, ownerLocked: boolean) {
    if (v.status === "HIDDEN") return <Badge tone="danger" icon="eye-off">Đã ẩn</Badge>;
    if (ownerLocked) return <Badge tone="danger" icon="lock">Chủ bị khoá</Badge>;
    if (v.status === "PUBLISHED") return <Badge tone="ok">Công khai</Badge>;
    return <Badge>Bản nháp</Badge>;
}

export function AdminReview() {
    const { users, venues, error, reload, setVenues } = useAdminData();
    const { confirm } = useFeedback();
    const { busy, run } = useAction();
    const [filter, setFilter] = useState<ReviewFilter>("ALL");
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [dialog, setDialog] = useState<ReviewDialog>(null);
    const [ownerId, setOwnerId] = useState<number | "">("");
    const closeDialog = useCallback(() => setDialog(null), []);

    const lockedOwners = useMemo(() => new Set((users ?? []).filter(u => u.status === "LOCKED").map(u => u.id)), [users]);
    const isOwnerLocked = (v: VenueDto) => v.ownerId != null && lockedOwners.has(v.ownerId);
    const all = venues ?? [];
    const matches = (v: VenueDto, f: ReviewFilter) => f === "ALL" || (f === "LOCKED_OWNER" ? isOwnerLocked(v) && v.status !== "HIDDEN" : v.status === f);
    const list = all.filter(v => matches(v, filter));
    const selected = list.find(v => v.id === selectedId) ?? list[0];
    const owner = users?.find(u => u.id === selected?.ownerId);

    const patch = (saved: VenueDto | null) => {
        if (saved && venues) setVenues(venues.map(x => (x.id === saved.id ? { ...x, ...saved } : x)));
        return saved;
    };
    const setStatus = async (v: VenueDto, status: VenueStatus, message: string) => {
        if (patch(await run(() => adminApi.setVenueStatus(v.id, status), message))) setDialog(null);
    };
    const unpublish = async (v: VenueDto) => {
        if (!(await confirm(`Gỡ xuất bản ${v.name}?`, { detail: "Địa điểm về Nháp, khách không mở được cho tới khi chủ xuất bản lại.", danger: true, okLabel: "Gỡ xuất bản" }))) return;
        await setStatus(v, "DRAFT", "Đã gỡ xuất bản");
    };
    const saveOwner = async (e: FormEvent) => {
        e.preventDefault();
        if (!selected || !ownerId) return;
        if (patch(await run(() => adminApi.setVenueOwner(selected.id, Number(ownerId)), "Đã chuyển chủ sở hữu"))) setDialog(null);
    };

    const chips: [ReviewFilter, string, number | null][] = [
        ["ALL", "Tất cả", venues ? all.length : null], ["PUBLISHED", "Công khai", venues ? all.filter(v => matches(v, "PUBLISHED")).length : null],
        ["DRAFT", "Nháp", venues ? all.filter(v => matches(v, "DRAFT")).length : null],
        ["LOCKED_OWNER", "Chủ bị khoá", venues && users ? all.filter(v => matches(v, "LOCKED_OWNER")).length : null],
        ["HIDDEN", "Đã ẩn", venues ? all.filter(v => matches(v, "HIDDEN")).length : null]
    ];

    return (
        <>
            <Title>Kiểm duyệt địa điểm</Title>
            <Chips label="Lọc theo trạng thái" items={chips} value={filter} onChange={f => { setFilter(f); setSelectedId(null); }} />
            {error ? <LoadError error={error} onRetry={reload} /> : !venues || !users ? (
                <div className="ka-split" aria-busy="true">
                    <span className="sr-only" role="status">Đang tải địa điểm cần kiểm duyệt</span>
                    <div className="k-card ka-flush">
                        {[196, 168, 152, 140].map((w, i) => (
                            <div key={i} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: "8px 12px", padding: "12px 16px", borderTop: i ? "1px solid var(--rule)" : undefined }}>
                                <Skel w={w} h={16} /><Skel w={72} /><Skel w={w - 40} />
                            </div>
                        ))}
                    </div>
                    <section className="k-card ka-flush">
                        <div className="ka-head"><div className="k-line" style={{ gap: 12 }}><Skel w={260} h={24} /><Skel w={72} /></div><Skel w={220} /></div>
                        <div className="ka-facts">{[0, 1, 2].map(i => <div key={i} className="k-stack" style={{ gap: 8 }}><Skel w={48} /><Skel w={64} h={16} /></div>)}</div>
                        <div className="ka-sec"><Skel w={120} h={16} /><Skel w="55%" /><Skel w="100%" h={64} /></div>
                    </section>
                </div>
            ) : !selected ? (
                <section className="k-card ka-empty">
                    <h2 className="k16">Không có địa điểm cần kiểm duyệt</h2>
                    <p className="k14 k-m">Địa điểm công khai, bị ẩn hoặc có chủ bị khoá sẽ hiện ở đây.</p>
                    {filter !== "ALL" && <div style={{ marginTop: 8 }}><Button onClick={() => setFilter("ALL")}>Xem tất cả</Button></div>}
                </section>
            ) : (
                <div className="ka-split">
                    <nav aria-label="Địa điểm cần xem" className="k-card ka-flush ka-vl">
                        {list.map(v => (
                            <button key={v.id} type="button" aria-current={v.id === selected.id} onClick={() => setSelectedId(v.id)}>
                                <span className="k14 k-b ka-ellipsis">{v.name}</span>{venueBadge(v, isOwnerLocked(v))}
                                <span className="k12 k-m ka-ellipsis">Chủ: {v.ownerName ?? "—"}</span>
                            </button>
                        ))}
                    </nav>
                    <section className="k-card ka-flush" aria-label="Chi tiết địa điểm">
                        <div className="ka-head">
                            <div className="k-line" style={{ gap: 16 }}>
                                <h2 className="k16">{selected.name}</h2>
                                <div className="k-line" style={{ gap: 16 }}>
                                    {selected.status === "PUBLISHED" ? <Badge tone="ok">Công khai</Badge> : selected.status === "HIDDEN" ? <Badge tone="danger" icon="eye-off">Đã ẩn</Badge> : <Badge>Bản nháp</Badge>}
                                    {isOwnerLocked(selected) && <Badge tone="danger" icon="lock">Chủ bị khoá</Badge>}
                                </div>
                                {selected.status === "PUBLISHED" && <span className="end"><a href={`/v/${selected.slug}`} target="_blank" rel="noreferrer" className="k-btn sm">Xem như khách</a></span>}
                            </div>
                            <div className="k12 k-m k-line" style={{ gap: 16 }}>
                                <span>/v/{selected.slug}</span>
                                <span>{KIND_LABEL[selected.kind ?? "other"] ?? selected.kind}</span>
                                <span>Chủ: {selected.ownerName ?? "—"}{isOwnerLocked(selected) ? " (bị khoá)" : ""}</span>
                            </div>
                        </div>
                        <dl className="ka-facts">
                            <div><dt className="k12 k-m">Toà nhà</dt><dd className="k16">{selected.buildingCount ?? 0}</dd></div>
                            <div><dt className="k12 k-m">Tầng</dt><dd className="k16">{selected.floorCount ?? 0}</dd></div>
                            <div><dt className="k12 k-m">Điểm</dt><dd className="k16">{selected.locationCount ?? 0}</dd></div>
                        </dl>
                        {isOwnerLocked(selected) && selected.status !== "HIDDEN" && (
                            <div className="ka-sec">
                                <div className="k-note" role="note">
                                    <Lc name="triangle-alert" size={16} color="var(--warn)" />
                                    <div><span className="k-b">Chủ {selected.ownerName} đang bị khoá, địa điểm vẫn {selected.status === "PUBLISHED" ? "công khai" : "ở bản nháp"}.</span> <span className="k-m">Không ai sửa được cho tới khi bạn chuyển chủ.</span></div>
                                </div>
                            </div>
                        )}
                        {selected.status === "HIDDEN" && (
                            <div className="ka-sec">
                                <h3 className="k14 k-b">Chủ địa điểm thấy địa điểm bị ẩn và được</h3>
                                <dl className="k-line k14" style={{ gap: 24, margin: 0 }}>
                                    {[["Xem", "Được"], ["Sửa nháp", "Được"], ["Xuất bản", "Không"]].map(([k, v]) => (
                                        <div key={k}><dt className="k12 k-m">{k}</dt><dd className={`k-b${v === "Không" ? " k-danger" : ""}`} style={{ margin: 0 }}>{v}</dd></div>
                                    ))}
                                </dl>
                            </div>
                        )}
                        <div className="ka-sec">
                            <div className="k-line"><h3 className="k14 k-b">Lịch sử kiểm duyệt</h3><Badge>Chưa khả dụng</Badge></div>
                            <p className="k12 k-m">Cập nhật lần cuối {selected.updatedAt ? new Date(selected.updatedAt).toLocaleString("vi-VN") : "—"}</p>
                        </div>
                        <div className="ka-dfoot">
                            <div className="start">
                                {selected.status === "PUBLISHED" && <Button variant="danger" disabled={busy} onClick={() => void unpublish(selected)}>Gỡ xuất bản…</Button>}
                                {selected.status !== "HIDDEN" && <Button variant="danger" onClick={() => setDialog("hide")}>Ẩn địa điểm…</Button>}
                            </div>
                            <div className="end">
                                <Button onClick={() => { setOwnerId(""); setDialog("owner"); }}>Chuyển chủ…</Button>
                                {selected.status === "HIDDEN"
                                    ? <Button variant="primary" onClick={() => setDialog("unhide")}>Hiện lại về Nháp…</Button>
                                    : <Button variant="primary" to={`/builder/v/${selected.id}/buildings`}>Mở trong Builder</Button>}
                            </div>
                        </div>
                    </section>
                </div>
            )}

            {dialog === "hide" && selected && (
                <Dialog title={`Ẩn ${selected.name}?`} onClose={closeDialog} note="Hiện lại được bất cứ lúc nào"
                    actions={<><Button onClick={closeDialog}>Huỷ</Button><DangerButton busy={busy} onClick={() => void setStatus(selected, "HIDDEN", "Đã ẩn địa điểm")}>Ẩn địa điểm</DangerButton></>}>
                    <ul className="ka-list k14">
                        <li>Khách không mở được <span className="k-b">/v/{selected.slug}</span> và các mã QR đã dán.</li>
                        <li>Chủ vẫn sửa nháp, nhưng không xuất bản được tới khi bạn hiện lại.</li>
                    </ul>
                </Dialog>
            )}
            {dialog === "unhide" && selected && (
                <Dialog title={`Hiện lại ${selected.name}?`} onClose={closeDialog}
                    actions={<><Button onClick={closeDialog}>Huỷ</Button><Button variant="primary" busy={busy} onClick={() => void setStatus(selected, "DRAFT", "Đã đưa về bản nháp")}>Hiện lại về Nháp</Button></>}>
                    <ul className="ka-list k14">
                        <li>Địa điểm về <span className="k-b">Nháp</span>, khách vẫn chưa thấy.</li>
                        <li>Chủ {selected.ownerName ?? ""} sửa rồi <span className="k-b">tự xuất bản lại</span>.</li>
                    </ul>
                </Dialog>
            )}
            {dialog === "owner" && selected && (
                <Dialog title={`Chuyển chủ ${selected.name}?`} onClose={closeDialog}
                    actions={<><Button onClick={closeDialog}>Huỷ</Button><button type="submit" form="ka-owner" className="k-btn p" disabled={!ownerId || busy} aria-busy={busy || undefined}>Chuyển chủ</button></>}>
                    <div className="k14"><span className="k12 k-m ka-block">Chủ hiện tại</span><span className="k-b">{selected.ownerName ?? "—"}</span>{owner?.status === "LOCKED" && <span className="k-danger"> (bị khoá)</span>}</div>
                    <form id="ka-owner" onSubmit={saveOwner} className="k-field">
                        <label htmlFor="own-new">Chủ mới</label>
                        <select id="own-new" className="k-input" required value={ownerId} onChange={e => setOwnerId(e.target.value ? Number(e.target.value) : "")}>
                            <option value="">Chọn tài khoản…</option>
                            {users?.filter(u => u.status === "ACTIVE" && u.id !== selected.ownerId).map(u => <option key={u.id} value={u.id}>{u.fullName}, {u.email}</option>)}
                        </select>
                        <span className="k-hint">Chỉ tài khoản đã duyệt, đang hoạt động.</span>
                    </form>
                    <ul className="ka-list k14">
                        <li>Chủ mới sửa và xuất bản được ngay; chủ cũ mất quyền với địa điểm này.</li>
                        <li>Đường dẫn và mã QR giữ nguyên.</li>
                    </ul>
                </Dialog>
            )}
        </>
    );
}

// ---------------------------------------------------------------- người dùng
type UserFilter = "ALL" | UserStatus;
const ROLE_LABEL = { VENUE_ADMIN: "Quản trị địa điểm", SYSTEM_ADMIN: "Quản trị hệ thống" } as const;

function userBadge(u: UserDto) {
    if (u.status === "PENDING") return <Badge tone="warn">Chờ duyệt</Badge>;
    if (u.status === "LOCKED") return <Badge tone="danger" icon="lock">Bị khoá</Badge>;
    return <Badge tone="ok">Hoạt động</Badge>;
}

export function AdminUsers() {
    const { users, venues, error, reload, setUsers } = useAdminData();
    const { user: me } = useAuth();
    const { confirm } = useFeedback();
    const { busy, run } = useAction();
    const [filter, setFilter] = useState<UserFilter>("ALL");
    const [query, setQuery] = useState("");
    const [dialog, setDialog] = useState<{ kind: "reject" | "lock"; user: UserDto } | null>(null);
    const closeDialog = useCallback(() => setDialog(null), []);

    const all = users ?? [];
    const q = query.trim().toLowerCase();
    const list = all.filter(u => (filter === "ALL" || u.status === filter) && (!q || `${u.fullName} ${u.email}`.toLowerCase().includes(q)));
    const activeAdmins = all.filter(u => u.role === "SYSTEM_ADMIN" && u.status === "ACTIVE").length;
    const ownedBy = (u: UserDto) => (venues ?? []).filter(v => v.ownerId === u.id);

    const setStatus = async (u: UserDto, status: UserStatus, message: string) => {
        const saved = await run(() => adminApi.setUserStatus(u.id, status), message);
        if (saved && users) {
            setUsers(users.map(x => (x.id === u.id ? saved : x)));
            setDialog(null);
        }
    };
    const unlock = async (u: UserDto) => {
        if (!(await confirm(`Mở khoá ${u.email}?`, { detail: "Người này đăng nhập lại được và tiếp tục quản lý địa điểm của mình.", okLabel: "Mở khoá" }))) return;
        await setStatus(u, "ACTIVE", `Đã mở khoá ${u.email}`);
    };

    const chips: [UserFilter, string, number | null][] = [
        ["ALL", "Tất cả", users ? all.length : null], ["PENDING", "Chờ duyệt", users ? all.filter(u => u.status === "PENDING").length : null],
        ["ACTIVE", "Hoạt động", users ? all.filter(u => u.status === "ACTIVE").length : null], ["LOCKED", "Bị khoá", users ? all.filter(u => u.status === "LOCKED").length : null]
    ];
    const head = (
        <colgroup><col /><col style={{ width: 160 }} /><col style={{ width: 240 }} /><col style={{ width: 220 }} /><col style={{ width: 200 }} /></colgroup>
    );
    const thead = (
        <thead><tr><th scope="col">Người dùng</th><th scope="col">Vai trò</th><th scope="col">Trạng thái</th><th scope="col">Địa điểm</th><th scope="col"><span className="sr-only">Thao tác</span></th></tr></thead>
    );

    return (
        <>
            <Title>Người dùng</Title>
            <div className="ka-toolbar">
                <Chips label="Lọc theo trạng thái" items={chips} value={filter} onChange={setFilter} />
                <label className="k-input ka-search">
                    <Lc name="search" size={16} color="var(--muted)" />
                    <input type="search" value={query} onChange={e => setQuery(e.target.value)} aria-label="Tìm tên hoặc email" placeholder="Tìm tên hoặc email" />
                </label>
            </div>
            <section className="k-card ka-flush ka-scroll" aria-label="Danh sách người dùng" aria-busy={!users && !error ? true : undefined}>
                {!users && !error && <span className="sr-only" role="status">Đang tải danh sách người dùng</span>}
                <table className="k-tbl">
                    {head}{thead}
                    {users && !error && (
                        <tbody>
                            {list.map(u => {
                                const owned = ownedBy(u);
                                const isMe = u.id === me?.id;
                                const lastAdmin = u.role === "SYSTEM_ADMIN" && u.status === "ACTIVE" && activeAdmins <= 1;
                                const wait = u.status === "PENDING" ? since(u.createdAt) : null;
                                return (
                                    <tr key={u.id}>
                                        <td><span className="k-b">{u.fullName}{isMe ? " (bạn)" : ""}</span><span className="k12 k-m ka-block">{u.email}</span></td>
                                        <td>{ROLE_LABEL[u.role]}</td>
                                        <td>
                                            {userBadge(u)}
                                            {u.status === "PENDING" && u.createdAt && <span className="k12 k-m ka-sub">{wait?.late ? `chờ ${wait.text}` : `đăng ký ${dateTime(u.createdAt)}`}</span>}
                                            {lastAdmin && <span className="k12 k-m ka-sub">Quản trị cuối cùng</span>}
                                        </td>
                                        <td>
                                            {owned.length ? owned.map(v => v.name).join(", ") : <span className="k-m">—</span>}
                                            {u.status === "LOCKED" && owned.length > 0 && <Link to="/admin/review" className="k12 k-b ka-block" style={{ marginTop: 4, textDecoration: "underline", textUnderlineOffset: 2 }}>Chuyển chủ ở Kiểm duyệt</Link>}
                                        </td>
                                        <td>
                                            <div className="ka-acts">
                                                {u.status === "PENDING" ? (
                                                    <>
                                                        <Button small busy={busy} onClick={() => void setStatus(u, "ACTIVE", `Đã duyệt ${u.email}`)}>Duyệt</Button>
                                                        <Button small variant="ghost" onClick={() => setDialog({ kind: "reject", user: u })}>Từ chối…</Button>
                                                    </>
                                                ) : u.status === "ACTIVE" ? (
                                                    <Button small variant="danger" disabled={isMe || lastAdmin} onClick={() => setDialog({ kind: "lock", user: u })}
                                                        title={isMe ? "Không tự khoá tài khoản của mình" : lastAdmin ? "Không khoá được quản trị hệ thống cuối cùng" : undefined}>Khoá…</Button>
                                                ) : <Button small busy={busy} onClick={() => void unlock(u)}>Mở khoá…</Button>}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    )}
                    {!users && !error && (
                        <tbody>
                            {[[132, 176, 80, 64, 104], [104, 148, 80, 64, 104], [148, 132, 84, 168, 64], [96, 120, 84, 136, 64], [112, 140, 96, 64, 64]].map((w, i) => (
                                <tr key={i}>
                                    <td><div className="k-stack" style={{ gap: 8 }}><Skel w={w[0]!} h={16} /><Skel w={w[1]!} /></div></td>
                                    <td><Skel w={112} /></td><td><Skel w={w[2]!} /></td><td><Skel w={w[3]!} /></td>
                                    <td><div className="ka-acts"><Skel w={w[4]!} h={32} /></div></td>
                                </tr>
                            ))}
                        </tbody>
                    )}
                </table>
                {error ? (
                    <div className="ka-empty is-big">
                        <h2 role="alert" className="k16 k-danger k-line"><Lc name="circle-alert" size={16} color="var(--danger)" />Không tải được danh sách người dùng</h2>
                        <p className="k14 k-m">{(error as Error)?.message || "Lỗi máy chủ."} Dữ liệu không thay đổi.</p>
                        <div style={{ marginTop: 8 }}><Button icon="refresh-cw" onClick={reload}>Thử lại</Button></div>
                    </div>
                ) : users && !list.length && (
                    <div className="ka-empty is-big">
                        <h2 className="k16">{q ? `Không có người dùng khớp “${query.trim()}”` : "Không có người dùng"}</h2>
                        {q && <p className="k14 k-m">Thử tên khác hoặc email đầy đủ.</p>}
                        {(q || filter !== "ALL") && <div style={{ marginTop: 8 }}><Button onClick={() => { setQuery(""); setFilter("ALL"); }}>Xoá tìm kiếm</Button></div>}
                    </div>
                )}
            </section>

            {dialog?.kind === "reject" && (
                <Dialog title="Từ chối đơn đăng ký?" onClose={closeDialog}
                    actions={<><Button onClick={closeDialog}>Huỷ</Button><DangerButton busy={busy} onClick={() => void setStatus(dialog.user, "LOCKED", `Đã từ chối ${dialog.user.email}`)}>Từ chối đơn</DangerButton></>}>
                    <Who user={dialog.user} />
                    <ul className="ka-list k14">
                        <li>Tài khoản chuyển sang <span className="k-b">Bị khoá</span>, không đăng nhập được.</li>
                        <li>Mở khoá được sau ở mục Bị khoá nếu cần.</li>
                    </ul>
                </Dialog>
            )}
            {dialog?.kind === "lock" && (
                <Dialog title="Khoá tài khoản?" onClose={closeDialog}
                    actions={<><Button onClick={closeDialog}>Huỷ</Button><DangerButton busy={busy} onClick={() => void setStatus(dialog.user, "LOCKED", `Đã khoá ${dialog.user.email}`)}>Khoá tài khoản</DangerButton></>}>
                    <Who user={dialog.user} extra={ROLE_LABEL[dialog.user.role].toLowerCase()} />
                    <ul className="ka-list k14">
                        <li>Không đăng nhập được cho tới khi được mở khoá.</li>
                        {ownedBy(dialog.user).length > 0
                            ? <li><span className="k-b">{ownedBy(dialog.user).length} địa điểm</span> ({ownedBy(dialog.user).map(v => v.name).join(", ")}) giữ nguyên trạng thái; xử lý ở Kiểm duyệt.</li>
                            : <li>Người này chưa sở hữu địa điểm nào.</li>}
                    </ul>
                </Dialog>
            )}
        </>
    );
}

// ---------------------------------------------------------------- danh mục loại mẫu
const KINDS = ["all", "airport", "hospital", "school", "mall", "park", "office"];
const KIND_TAB: Record<string, string> = { all: "Chung", airport: "Sân bay", hospital: "Bệnh viện", school: "Trường học", mall: "TTTM", park: "Công viên", office: "Văn phòng" };
/** Màu mặc định của mẫu mới: lấy từ bảng màu chung (màu là dữ liệu lưu trong CSDL) */
const DEFAULT_COLOR = COLORS[1] ?? COLORS[0] ?? "";
const GROUPS = ["gate", "procedure", "food", "service", "restroom", "transport", "health", "study", "office", "leisure"];

export function AdminTemplates() {
    const [templates, setTemplates] = useState<LocationTypeDto[] | null>(null);
    const [error, setError] = useState<unknown>(null);
    const [tab, setTab] = useState<"types" | "workflows">("types");
    const [kind, setKind] = useState("airport");
    const [form, setForm] = useState<Partial<LocationTypeDto> | null>(null);
    const { confirm } = useFeedback();
    const { busy, run } = useAction();
    const load = useCallback(() => {
        adminApi.templates().then(list => {
            setTemplates(list);
            setError(null);
        }).catch(setError);
    }, []);
    useEffect(load, [load]);
    const list = useMemo(() => (templates ?? []).filter(t => t.kind === kind).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)), [templates, kind]);

    const formKind = form?.kind ?? kind;
    const code = form?.code?.trim() ?? "";
    const duplicate = code ? (templates ?? []).find(t => t.kind === formKind && t.code === code && t.id !== form?.id) : undefined;
    const canSave = !!form && !!form.name?.trim() && !!code && !duplicate;

    const add = () => {
        setTab("types");
        setForm({ kind, code: "", name: "", icon: "bi-geo-alt", color: DEFAULT_COLOR, groupName: "service" });
    };
    const save = async (e: FormEvent) => {
        e.preventDefault();
        if (!form || !canSave) return;
        const body = { ...form, code, name: form.name?.trim(), kind: formKind, sortOrder: form.sortOrder ?? (list.length + 1) * 10 };
        const saved = await run(() => (form.id ? adminApi.updateTemplate(form.id, body) : adminApi.createTemplate(body)), "Đã lưu mẫu");
        if (saved) {
            setForm(saved);
            if (saved.kind && saved.kind !== kind) setKind(saved.kind);
            load();
        }
    };
    const remove = async () => {
        if (!form?.id) return;
        const id = form.id;
        if (!(await confirm(`Xoá mẫu “${form.name}”?`, { danger: true, okLabel: "Xoá", detail: "Địa điểm đã sao chép mẫu này giữ nguyên bản sao của mình." }))) return;
        if (await run(() => adminApi.removeTemplate(id), "Đã xoá mẫu") !== null) {
            setForm(null);
            load();
        }
    };

    return (
        <>
            <HeaderActions><Button icon="plus" onClick={add}>Thêm mẫu</Button></HeaderActions>
            <Title>Danh mục mẫu</Title>
            <div role="tablist" aria-label="Danh mục mẫu" className="k-tabs">
                <button type="button" role="tab" className="k-tab" aria-selected={tab === "types"} onClick={() => setTab("types")}>Loại địa điểm mẫu</button>
                <button type="button" role="tab" className="k-tab" aria-selected={tab === "workflows"} onClick={() => setTab("workflows")}>Quy trình mẫu <span className="k12 k-m">Chưa khả dụng</span></button>
            </div>
            {tab === "workflows" ? (
                <section className="k-card ka-empty">
                    <h2 className="k16">Quy trình mẫu chưa khả dụng</h2>
                    <p className="k12 k-m">Chưa có API lưu quy trình mẫu.</p>
                </section>
            ) : error ? <LoadError error={error} onRetry={load} /> : (
                <>
                    <Chips label="Loại hình" value={kind} onChange={k => { setKind(k); setForm(null); }}
                        items={KINDS.map(k => [k, KIND_TAB[k] ?? k, templates ? templates.filter(t => t.kind === k).length : null] as [string, string, number | null])} />
                    <div className="ka-tgrid">
                        <section className="k-card ka-flush" aria-labelledby="set-title" aria-busy={!templates || undefined}>
                            <div className="ka-hd"><h2 id="set-title" className="k16">{KIND_TAB[kind]}</h2>{templates && <span className="k14 k-m">{list.length} mẫu</span>}</div>
                            <table className="k-tbl">
                                <thead><tr><th scope="col">Mẫu</th><th scope="col">Mã</th><th scope="col">Nhóm</th><th scope="col"><span className="sr-only">Thao tác</span></th></tr></thead>
                                <tbody>
                                    {!templates ? [140, 120, 160, 100, 130].map((w, i) => (
                                        <tr key={i}><td><Skel w={w} /></td><td><Skel w={64} /></td><td><Skel w={72} /></td><td><div className="ka-acts"><Skel w={48} h={32} /></div></td></tr>
                                    )) : list.map(t => (
                                        <tr key={t.id} aria-selected={form?.id === t.id || undefined}>
                                            <td><span className="k-line"><span className="ka-swatch" style={{ background: t.color }}><i className={`bi ${t.icon ?? "bi-geo-alt"}`} aria-hidden="true" /></span><span className="k-b">{t.name}</span></span></td>
                                            <td className="k-m">{t.code}</td>
                                            <td>{groupLabel(t.groupName)}</td>
                                            <td><div className="ka-acts"><Button small variant="ghost" onClick={() => setForm({ ...t })}>Sửa</Button></div></td>
                                        </tr>
                                    ))}
                                    {templates && !list.length && <tr><td colSpan={4} className="k-m">Chưa có mẫu cho loại hình này.</td></tr>}
                                </tbody>
                            </table>
                        </section>
                        {form ? (
                            <section className="k-card ka-flush" aria-labelledby="ed-title">
                                <div className="ka-edhead">
                                    <h2 id="ed-title" className="k16">{form.id ? form.name || "Mẫu" : "Mẫu mới"}</h2>
                                    <p className="k12 k-m">{KIND_TAB[formKind] ?? formKind}</p>
                                </div>
                                <form id="ka-tpl" onSubmit={save} className="k-stack ka-edform">
                                    <div className="k-field">
                                        <label htmlFor="tp-name">Tên</label>
                                        <input id="tp-name" className="k-input" type="text" required value={form.name ?? ""} onChange={e => setForm({ ...form, name: e.target.value })} />
                                    </div>
                                    <div className="k-field">
                                        <label htmlFor="tp-code">Mã</label>
                                        <input id="tp-code" className="k-input" type="text" required value={form.code ?? ""} aria-invalid={duplicate ? true : undefined} aria-describedby="tp-code-h"
                                            onChange={e => setForm({ ...form, code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })} />
                                        {duplicate
                                            ? <span id="tp-code-h" role="alert" className="k-line k12 k-b k-danger" style={{ gap: 4 }}><Lc name="circle-alert" size={14} />Mã “{code}” đã dùng cho {duplicate.name}</span>
                                            : code ? <span id="tp-code-h" className="k-line k12 k-ok" style={{ gap: 4 }}><Lc name="check" size={14} />Mã chưa trùng</span>
                                                : <span id="tp-code-h" className="k-hint">Chữ thường, số, dấu gạch dưới</span>}
                                    </div>
                                    <div className="k-grid2">
                                        <div className="k-field">
                                            <label htmlFor="tp-grp">Nhóm</label>
                                            <select id="tp-grp" className="k-input" value={form.groupName ?? ""} onChange={e => setForm({ ...form, groupName: e.target.value })}>{GROUPS.map(g => <option key={g} value={g}>{groupLabel(g)}</option>)}</select>
                                        </div>
                                        <div className="k-field">
                                            <label htmlFor="tp-kind">Loại hình</label>
                                            <select id="tp-kind" className="k-input" value={formKind} onChange={e => setForm({ ...form, kind: e.target.value })}>{KINDS.map(k => <option key={k} value={k}>{KIND_TAB[k]}</option>)}</select>
                                        </div>
                                    </div>
                                    <ColorPicker label="Màu mặc định" value={form.color ?? DEFAULT_COLOR} onChange={c => setForm({ ...form, color: c })} />
                                    <IconPicker value={form.icon ?? "bi-geo-alt"} onChange={icon => setForm({ ...form, icon })} />
                                    <p className="k12 k-m">Địa điểm đã tạo giữ bản sao của mình; không bị sửa.</p>
                                </form>
                                <div className="ka-edfoot">
                                    {form.id && <Button variant="danger" onClick={() => void remove()}>Xoá…</Button>}
                                    <div className="end">
                                        <Button variant="ghost" onClick={() => setForm(null)}>Đóng</Button>
                                        <button type="submit" form="ka-tpl" className="k-btn p" disabled={!canSave || busy} aria-busy={busy || undefined}
                                            title={duplicate ? "Sửa mã trùng trước khi lưu" : undefined}>
                                            {busy && <span className="cb-spinner is-inline" aria-hidden="true" />}Lưu mẫu
                                        </button>
                                    </div>
                                </div>
                            </section>
                        ) : (
                            <section className="k-card">
                                <h2 className="k16">Chọn một mẫu để sửa</h2>
                                <p className="k14 k-m">Mẫu Chung (nhà vệ sinh, thang máy, lối ra…) được thêm cho mọi loại hình.</p>
                            </section>
                        )}
                    </div>
                </>
            )}
        </>
    );
}

// ---------------------------------------------------------------- cấu hình (chỉ đọc) & nhật ký (chưa có API)
type CfgRow = [string, string, string];
function CfgSection({ id, title, rows, unavailable }: { id: string; title: string; rows: CfgRow[]; unavailable?: boolean }) {
    return (
        <section className="k-card" aria-labelledby={id}>
            <div className="k-line"><h2 id={id} className="k16">{title}</h2>{unavailable && <span style={{ marginLeft: "auto" }}><Badge>Chưa khả dụng</Badge></span>}</div>
            <dl className="ka-cfg">
                {rows.map(([k, d, v]) => (
                    <div key={k} className="k-row">
                        <dt><span className="k14 k-b ka-block">{k}</span><span className="k12 k-m">{d}</span></dt>
                        <dd className={`k14${unavailable ? " k-m" : ""}`}>{v}</dd>
                    </div>
                ))}
            </dl>
        </section>
    );
}

export function AdminSettings() {
    const apiBase = import.meta.env.VITE_API_BASE_URL || "Cùng địa chỉ website (/api)";
    const host = window.location.host;
    return (
        <>
            <HeaderActions><Button variant="primary" disabled title="Chưa có API lưu cấu hình">Lưu cấu hình</Button></HeaderActions>
            <Title after={<><Badge icon="lock">Chỉ đọc</Badge><span className="k12 k-m" style={{ marginLeft: "auto" }}>Chưa có API lưu</span></>}>Cấu hình hệ thống</Title>
            <div className="ka-cfg-cols">
                <div className="k-stack" style={{ gap: 24 }}>
                    <CfgSection id="s1" title="Tài khoản và đăng nhập" rows={[
                        ["Đăng ký quản trị địa điểm", "Tài khoản mới ở trạng thái Chờ duyệt.", "Mở, duyệt tay"],
                        ["Khoá đăng nhập tạm", "Tính theo địa chỉ IP, tách khỏi khoá tài khoản.", "5 lần sai / 15 phút"],
                        ["Hạn phiên đăng nhập", "Hết hạn thì phải đăng nhập lại.", "8 giờ"],
                        ["Quản trị hệ thống đầu tiên", "Tạo từ biến môi trường khi chưa có người dùng.", "ADMIN_EMAIL"]
                    ]} />
                    <CfgSection id="s2" title="Dữ liệu địa điểm" rows={[
                        ["Tệp mặt bằng", "Gửi lên dạng ảnh hoặc SVG.", "≤ 8 MB, SVG, PNG, JPG"],
                        ["Địa chỉ API", "Frontend gọi backend qua địa chỉ này.", apiBase]
                    ]} />
                    <CfgSection id="s5" title="Chỉ đường bằng camera" unavailable rows={[["Cho phép chủ địa điểm bật", "Giai đoạn 2, chưa có cấu hình.", "Tắt"]]} />
                </div>
                <div className="k-stack" style={{ gap: 24 }}>
                    <CfgSection id="s3" title="Chỉ đường" rows={[
                        ["Tốc độ đi bộ", "Dùng cho thời gian ước tính.", "1,2 m/s"],
                        ["Phạt chuyển tầng", "Tránh đổi tầng không cần thiết.", "30 m"],
                        ["Bán kính nhập lối đi", "Điểm xa lối đi hơn mức này coi như không tới được.", "60 m"],
                        ["Bán kính nhắc mốc", "Mốc gần lượt rẽ được nêu trong chỉ dẫn.", "14 m"]
                    ]} />
                    <CfgSection id="s4" title="Bản đồ và đường dẫn" rows={[
                        ["Bản đồ nền ngoài trời", "Dùng khi đặt vị trí địa điểm.", "OpenStreetMap (CARTO)"],
                        ["Đường dẫn bản đồ", "Link khách mở từ trình duyệt.", `${host}/v/…`],
                        ["Đường dẫn mã QR", "Đổi sẽ làm hỏng tem đã dán.", `${host}/q/…`]
                    ]} />
                    <CfgSection id="s6" title="Email thông báo" unavailable rows={[["Gửi email cho người dùng", "Hệ thống chưa gửi email.", "Tắt"]]} />
                </div>
            </div>
        </>
    );
}

const LOG_NA = "Chưa có API nhật ký";
export function AdminLogs() {
    const filters: [string, string, string[]][] = [
        ["f-actor", "Người", ["Mọi người", "Quản trị hệ thống", "Chủ địa điểm", "Hệ thống"]],
        ["f-object", "Đối tượng", ["Mọi đối tượng", "Địa điểm", "Tài khoản", "Mẫu", "Cấu hình"]],
        ["f-action", "Hành động", ["Mọi hành động", "Kiểm duyệt", "Bảo mật", "Dữ liệu"]],
        ["f-time", "Thời gian", ["7 ngày qua", "24 giờ qua", "30 ngày qua"]]
    ];
    return (
        <>
            <HeaderActions><Button disabled title={LOG_NA}>Xuất CSV</Button></HeaderActions>
            <Title after={<Badge>Chưa khả dụng</Badge>}>Nhật ký hệ thống</Title>
            <section aria-label="Bộ lọc" className="ka-flt">
                <div className="k-field"><label htmlFor="f-q">Tìm</label><input id="f-q" className="k-input" type="search" disabled placeholder="Email, đối tượng" title={LOG_NA} /></div>
                {filters.map(([id, label, opts]) => (
                    <div key={id} className="k-field"><label htmlFor={id}>{label}</label><select id={id} className="k-input" disabled title={LOG_NA}>{opts.map(o => <option key={o}>{o}</option>)}</select></div>
                ))}
            </section>
            <section className="k-card ka-flush" aria-labelledby="ev-title">
                <div className="ka-hd"><h2 id="ev-title" className="k16">Sự kiện</h2></div>
                <table className="k-tbl">
                    <colgroup><col style={{ width: 128 }} /><col style={{ width: 220 }} /><col style={{ width: 200 }} /><col style={{ width: 300 }} /><col /></colgroup>
                    <thead><tr><th scope="col">Thời gian</th><th scope="col">Người</th><th scope="col">Hành động</th><th scope="col">Đối tượng</th><th scope="col">Chi tiết</th></tr></thead>
                </table>
                <div className="ka-empty is-big">
                    <h3 className="k16">Chưa ghi nhật ký</h3>
                    <p className="k14 k-m">Backend chưa lưu đăng nhập, duyệt tài khoản, xuất bản hay nhập dữ liệu.</p>
                </div>
            </section>
        </>
    );
}
