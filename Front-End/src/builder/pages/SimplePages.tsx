import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { analyzeVenue, buildVenueModel, type VenueDto, type VenueMapDto } from "@indoor-map/core";
import { authApi, catalogApi, locationApi, planApi, venueApi, walkwayApi } from "../../console/api";
import { useAuth } from "../../console/auth";
import { ApiError } from "../../console/http";
import { ErrorNote, useAction } from "../../console/ui";
import Lc from "../../design/Lc";
import { useWorkspace } from "../Workspace";
import { VenueStatus } from "./VenuesPage";
import "./global.css";

function Badge({ children, tone, icon }: { children: string; tone?: "ok" | "warn" | "danger"; icon?: "clock" | "circle-check" | "lock" }) {
    return (
        <span className={`k-badge ${tone ? `k-${tone}` : "k-m"}`}>
            {icon && <Lc name={icon} size={14} />}{children}
        </span>
    );
}

function Skel({ w, h = 12 }: { w: number | string; h?: number }) {
    return <span className="k-skel" style={{ width: w, height: h }} />;
}

// ---------------------------------------------------------------- mốc camera (giai đoạn 2, chưa có API)
function planSrc(plan?: { svg?: string; imageUrl?: string }): string | null {
    if (plan?.svg) return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(plan.svg)}`;
    return plan?.imageUrl ?? null;
}

export function LandmarksPage() {
    const { model } = useWorkspace();
    const floors = model.buildings.flatMap(b => model.floorsOf(b.id));
    const [floorId, setFloorId] = useState<number | null>(null);
    const floor = floors.find(f => f.id === floorId) ?? floors.find(f => f.plan) ?? floors[0];
    const src = planSrc(floor?.plan);
    return (
        <div className="k-page" style={{ minHeight: "100%" }}>
            <div className="k-title">
                <h1 className="k24">Mốc camera</h1>
                <Badge tone="warn" icon="clock">Chưa khả dụng</Badge>
                <span className="k14 k-m">Giai đoạn 2</span>
            </div>
            <section aria-labelledby="ua-t" className="k-card tight kg-tinted">
                <h2 id="ua-t" className="k16">Chỉ đường bằng camera chưa dùng được</h2>
                <p className="k14 k-m">Hiện khách định vị bằng mã QR và bước chân. Mốc camera sẽ mở ở giai đoạn 2.</p>
            </section>
            <div className="kg-lm">
                <section aria-labelledby="map-t" className="k-card kg-lm-map">
                    <div className="kg-lm-head">
                        <h2 id="map-t" className="k16">Mốc trên tầng</h2>
                        {floors.length > 0 && (
                            <select aria-label="Tầng" className="k-input" value={floor?.id ?? ""} onChange={e => setFloorId(Number(e.target.value))}>
                                {floors.map(f => <option key={f.id} value={f.id}>{f.buildingCode} / {f.name}</option>)}
                            </select>
                        )}
                        <span className="end"><button type="button" className="k-btn" disabled title="Chưa khả dụng"><Lc name="plus" size={16} />Thêm mốc</button></span>
                    </div>
                    <div className="kg-lm-canvas">
                        <span className="kg-lm-label k12 k-b k-m">Chưa có mốc</span>
                        {src ? <img src={src} alt={`Mặt bằng ${floor?.buildingCode ?? ""} ${floor?.name ?? ""}`} />
                            : <p className="k14 k-m">{floors.length ? "Tầng này chưa có mặt bằng." : "Địa điểm chưa có tầng."}</p>}
                    </div>
                </section>
                <aside aria-label="Cài đặt camera" className="k-stack kg-lm-aside">
                    <section aria-labelledby="set-t" aria-disabled="true" className="k-card">
                        <h2 id="set-t" className="k16">Cài đặt cho địa điểm</h2>
                        <div className="kg-dim">
                            <label className="k-row k14" style={{ justifyContent: "space-between" }}>
                                <span>Bật chỉ đường camera cho khách</span><input type="checkbox" role="switch" className="kg-switch" disabled />
                            </label>
                            <label className="k-row k14" style={{ justifyContent: "space-between" }}>
                                <span>Bắt quét QR trước khi dùng camera</span><input type="checkbox" role="switch" className="kg-switch" disabled />
                            </label>
                            <div className="k-field" style={{ marginTop: 16 }}>
                                <label htmlFor="thr" className="k-line" style={{ justifyContent: "space-between" }}>Ngưỡng khớp tối thiểu<span style={{ fontWeight: 400 }}>—</span></label>
                                <input id="thr" type="range" min={0.5} max={0.95} step={0.01} defaultValue={0.8} disabled className="kg-range" />
                            </div>
                        </div>
                    </section>
                    <section aria-labelledby="priv-t" className="k-card">
                        <h2 id="priv-t" className="k16">Quyền ảnh và riêng tư</h2>
                        <p className="k14 k-m">Chỉ chụp cảnh cố định khi địa điểm cho phép; mặt người được làm mờ, ảnh không hiện cho khách.</p>
                    </section>
                </aside>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------- thống kê: dữ liệu bản đồ thật, lượt dùng chưa có API
async function loadBundle(venue: VenueDto): Promise<VenueMapDto> {
    const id = venue.id;
    const [buildings, floors, zones, types, facilities, locations, walkways] = await Promise.all([
        planApi.buildings(id), planApi.floors(id), planApi.zones(id), catalogApi.types(id), catalogApi.facilities(id), locationApi.list(id), walkwayApi.get(id)
    ]);
    return { venue, buildings, floors, zones, types, facilities, locations, walkways };
}

interface BuildingRow {
    id: number;
    code: string;
    name: string;
    floors: number;
    points: number;
    /** % điểm tới được; null khi chưa có điểm nào đặt được lên bản đồ */
    reach: number | null;
}

function useVenueStats(venue: VenueDto | undefined) {
    const [state, setState] = useState<{ id: number; bundle?: VenueMapDto; error?: unknown } | null>(null);
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        if (!venue) return undefined;
        let alive = true;
        loadBundle(venue).then(bundle => alive && setState({ id: venue.id, bundle }))
            .catch(error => alive && setState({ id: venue.id, error }));
        return () => {
            alive = false;
        };
    }, [venue, attempt]);
    const current = state && venue && state.id === venue.id ? state : null;
    const summary = useMemo(() => {
        const bundle = current?.bundle;
        if (!bundle) return null;
        const model = buildVenueModel(bundle);
        const report = analyzeVenue(model);
        const blocked = new Set([...report.unreachable, ...report.isolated].map(p => p.id));
        const withPlan = bundle.floors.filter(f => f.plan).length;
        const rows: BuildingRow[] = model.buildings.map(b => {
            const floorIds = new Set(bundle.floors.filter(f => f.buildingId === b.id).map(f => f.id));
            const placed = model.locations.filter(p => floorIds.has(p.floorId));
            return {
                id: b.id, code: b.code, name: b.name, floors: floorIds.size,
                points: bundle.locations.filter(l => floorIds.has(l.floorId)).length,
                reach: placed.length ? Math.round((100 * placed.filter(p => !blocked.has(p.id)).length) / placed.length) : null
            };
        });
        return { bundle, rows, withPlan, blocked: blocked.size };
    }, [current?.bundle]);
    return { summary, error: current?.error, loading: !!venue && !current, retry: () => setAttempt(a => a + 1) };
}

export function StatsPage() {
    const [venues, setVenues] = useState<VenueDto[] | null>(null);
    const [listError, setListError] = useState<unknown>(null);
    const [venueId, setVenueId] = useState<number | null>(null);
    useEffect(() => {
        venueApi.mine().then(setVenues).catch(setListError);
    }, []);
    const venue = venues?.find(v => v.id === venueId) ?? venues?.[0];
    const { summary, error, loading, retry } = useVenueStats(venue);

    return (
        <>
            <div className="k-title">
                <h1 className="k24">Thống kê</h1>
                {venues && venues.length > 0 && (
                    <div className="k-acts">
                        <label htmlFor="st-venue" className="k14 k-m">Địa điểm</label>
                        <select id="st-venue" className="k-input kg-select" value={venue?.id ?? ""} onChange={e => setVenueId(Number(e.target.value))}>
                            {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                        </select>
                    </div>
                )}
            </div>
            {listError ? <ErrorNote error={listError} /> : null}
            {venues && venues.length === 0 && (
                <div className="k-card kg-empty">
                    <h2 className="k16">Chưa có địa điểm nào</h2>
                    <p className="k14 k-m">Số liệu bản đồ hiện khi bạn có địa điểm.</p>
                    <div style={{ marginTop: 8 }}><Link to="/builder/new" className="k-btn">Tạo địa điểm</Link></div>
                </div>
            )}
            {(!venues || venue) && !listError && (
                <section aria-labelledby="sd-t" className="k-stack">
                    <div className="k-line" style={{ gap: 16 }}>
                        <h2 id="sd-t" className="k16">Dữ liệu bản đồ</h2>
                        {venue && <VenueStatus status={venue.status} />}
                    </div>
                    {error ? <ErrorNote error={error} onRetry={retry} /> : (
                        <div className="k-card kg-flush" aria-busy={loading || !venues || undefined}>
                            <div className="kg-kpis">
                                {summary ? (
                                    <>
                                        <div className="k-kpi"><span className="k28">{summary.rows.length}</span><span className="k12 k-m">Toà nhà</span><span className="k12 k-m">{summary.rows.map(r => r.code).join(", ") || "Chưa có"}</span></div>
                                        <div className="k-kpi"><span className="k28">{summary.bundle.floors.length}</span><span className="k12 k-m">Tầng</span><span className="k12 k-m">{summary.withPlan}/{summary.bundle.floors.length} có mặt bằng</span></div>
                                        <div className="k-kpi">
                                            <span className="k28">{summary.bundle.locations.length}</span><span className="k12 k-m">Điểm quan tâm</span>
                                            {summary.blocked ? <span className="k12 k-warn">{summary.blocked} điểm chưa tới được</span> : <span className="k12 k-m">Đều tới được</span>}
                                        </div>
                                    </>
                                ) : ["Toà nhà", "Tầng", "Điểm quan tâm"].map(label => (
                                    <div key={label} className="k-kpi"><Skel w={48} h={32} /><span className="k12 k-m">{label}</span><Skel w={120} /></div>
                                ))}
                                <div className="k-kpi"><span className="k28 k-m" aria-label="Không có số liệu">—</span><span className="k12 k-m">Mã QR định vị</span><span className="k12 k-m">Chưa khả dụng</span></div>
                            </div>
                            <table className="k-tbl kg-in" aria-label="Theo toà nhà">
                                <thead><tr><th scope="col">Toà nhà</th><th scope="col" className="num">Tầng</th><th scope="col" className="num">Điểm</th><th scope="col" style={{ width: 240 }}>Điểm tới được</th></tr></thead>
                                <tbody>
                                    {!summary ? [0, 1, 2].map(i => (
                                        <tr key={i}><td><Skel w={140} /></td><td className="num"><Skel w={24} /></td><td className="num"><Skel w={32} /></td><td><Skel w={160} /></td></tr>
                                    )) : summary.rows.map(r => (
                                        <tr key={r.id}>
                                            <td><span className="k-b">{r.code}</span> <span className="k-m">{r.name}</span></td>
                                            <td className="num">{r.floors}</td>
                                            <td className="num">{r.points}</td>
                                            <td>{r.reach == null ? <span className="k-m">Chưa có điểm trên bản đồ</span> : (
                                                <><span className="kg-meter" aria-hidden="true"><span style={{ width: `${r.reach}%` }} /></span><span className={r.reach === 100 ? undefined : "k-warn"}>{r.reach}%</span></>
                                            )}</td>
                                        </tr>
                                    ))}
                                    {summary && !summary.rows.length && <tr><td colSpan={4} className="k-m">Chưa có toà nhà.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            )}
            <section aria-labelledby="su-t" className="k-stack">
                <div className="k-line" style={{ gap: 16 }}><h2 id="su-t" className="k16">Thống kê sử dụng</h2><Badge>Chưa khả dụng</Badge></div>
                <div className="k-card kg-usage">
                    <div>
                        <div><h3 className="k16">Chưa ghi nhận hoạt động của khách</h3><p className="k14 k-m" style={{ marginTop: 4 }}>Sẽ có khi:</p></div>
                        <ul className="kg-plain" style={{ gap: 16 }}>
                            <li><span className="k14 k-b" style={{ display: "block" }}>Hệ thống bật ghi nhận sự kiện</span><span className="k12 k-m">Cần backend lưu lượt xem, tìm kiếm, chỉ đường</span></li>
                            <li><span className="k14 k-b" style={{ display: "block" }}>Địa điểm có chính sách riêng tư</span><span className="k12 k-m">Báo cho khách; chỉ lưu số liệu ẩn danh</span></li>
                        </ul>
                    </div>
                    <div>
                        <p className="k-sec">Số liệu sẽ hiện</p>
                        <ul className="kg-plain k14 k-m"><li>Lượt xem bản đồ</li><li>Lượt chỉ đường</li><li>Từ khoá khách tìm</li><li>Tuyến không tìm được</li></ul>
                        <label className="k-line k14 k-m kg-switch-row">
                            <span style={{ flex: 1 }}>Ghi nhận sự kiện ẩn danh</span><input type="checkbox" role="switch" className="kg-switch" disabled />
                        </label>
                    </div>
                </div>
            </section>
        </>
    );
}

// ---------------------------------------------------------------- tài khoản
export function AccountTabs({ current }: { current: "profile" | "notifications" }) {
    return (
        <nav className="k-tabs" aria-label="Mục tài khoản">
            <Link to="/builder/account" className="k-tab" aria-current={current === "profile" ? "page" : undefined}>Hồ sơ</Link>
            <Link to="/builder/notifications" className="k-tab" aria-current={current === "notifications" ? "page" : undefined}>Thông báo</Link>
        </nav>
    );
}

export function AccountPage() {
    const { user, setUser } = useAuth();
    const { busy, run } = useAction();
    const [name, setName] = useState(user?.fullName ?? "");
    const [savedAt, setSavedAt] = useState<string | null>(null);
    const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
    const [pwBusy, setPwBusy] = useState(false);
    const [pwError, setPwError] = useState<{ current?: string; form?: string } | null>(null);
    const [pwDone, setPwDone] = useState(false);
    const weak = pw.next.length > 0 && (pw.next.length < 8 || !/[a-zA-Z]/.test(pw.next) || !/\d/.test(pw.next));
    const mismatch = pw.confirm.length > 0 && pw.confirm !== pw.next;

    const saveName = async (e: FormEvent) => {
        e.preventDefault();
        const saved = await run(() => authApi.updateProfile(name.trim()));
        if (saved) {
            setUser(saved);
            setSavedAt(new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }));
        }
    };
    const savePassword = async (e: FormEvent) => {
        e.preventDefault();
        if (weak || mismatch || !pw.next) return;
        setPwBusy(true);
        setPwError(null);
        setPwDone(false);
        try {
            await authApi.changePassword(pw.current, pw.next);
            setPw({ current: "", next: "", confirm: "" });
            setPwDone(true);
        } catch (err) {
            const message = (err as Error).message || "Có lỗi xảy ra";
            if (err instanceof ApiError && err.status === 400 && /hiện tại/i.test(message)) setPwError({ current: message });
            else setPwError({ form: message });
        } finally {
            setPwBusy(false);
        }
    };

    if (!user) return null;
    const since = user.createdAt ? `, từ ${new Date(user.createdAt).toLocaleDateString("vi-VN")}` : "";
    return (
        <>
            <div className="k-title"><h1 className="k24">Tài khoản</h1></div>
            <AccountTabs current="profile" />
            <div className="k-stack" style={{ gap: 32 }}>
                <section className="kg-sec" aria-labelledby="s-info">
                    <div><h2 id="s-info" className="k16">Thông tin cá nhân</h2></div>
                    <form className="k-card" onSubmit={saveName}>
                        <div className="k-line" style={{ gap: 16 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <span className="k14 k-b" style={{ display: "block" }}>{user.fullName}</span>
                                <span className="k12 k-m">{user.role === "SYSTEM_ADMIN" ? "Quản trị hệ thống" : "Quản trị địa điểm"}{since}</span>
                            </div>
                            {user.status === "ACTIVE" ? <Badge tone="ok" icon="circle-check">Hoạt động</Badge> : <Badge tone="warn">{user.status === "PENDING" ? "Chờ duyệt" : "Bị khoá"}</Badge>}
                        </div>
                        <div className="k-grid2">
                            <div className="k-field">
                                <label htmlFor="pf-name">Họ và tên</label>
                                <input id="pf-name" className="k-input" type="text" autoComplete="name" required value={name} onChange={e => { setName(e.target.value); setSavedAt(null); }} />
                            </div>
                            <div className="k-field">
                                <label htmlFor="pf-email">Email đăng nhập</label>
                                <input id="pf-email" className="k-input" type="text" value={user.email} disabled aria-describedby="em-h" />
                                <span id="em-h" className="k-hint">Không đổi được.</span>
                            </div>
                        </div>
                        <div className="kg-cardfoot">
                            {savedAt && <span role="status" className="k-line k12 k-m"><Lc name="check" size={16} color="var(--ok)" />Đã lưu họ tên lúc {savedAt}</span>}
                            <span className="end">
                                <button type="submit" className="k-btn" disabled={busy || !name.trim() || name.trim() === user.fullName} aria-busy={busy || undefined}>Lưu họ tên</button>
                            </span>
                        </div>
                    </form>
                </section>
                <section className="kg-sec" aria-labelledby="s-pw">
                    <div><h2 id="s-pw" className="k16">Đổi mật khẩu</h2></div>
                    <form className="k-card" onSubmit={savePassword}>
                        <div className="k-field">
                            <label htmlFor="pw-cur">Mật khẩu hiện tại</label>
                            <input id="pw-cur" className="k-input" type="password" autoComplete="current-password" required value={pw.current}
                                aria-invalid={pwError?.current ? true : undefined} aria-describedby={pwError?.current ? "pw-err" : undefined}
                                onChange={e => { setPw(p => ({ ...p, current: e.target.value })); setPwError(null); }} />
                            {pwError?.current && <span id="pw-err" className="k-line k12 k-danger"><Lc name="circle-alert" size={16} />{pwError.current}</span>}
                        </div>
                        <div className="k-grid2">
                            <div className="k-field">
                                <label htmlFor="pw-new">Mật khẩu mới</label>
                                <input id="pw-new" className="k-input" type="password" autoComplete="new-password" required value={pw.next} aria-invalid={weak || undefined} aria-describedby="pw-h"
                                    onChange={e => { setPw(p => ({ ...p, next: e.target.value })); setPwDone(false); }} />
                                <span id="pw-h" className={weak ? "k12 k-danger" : "k-hint"}>Ít nhất 8 ký tự, có chữ và số</span>
                            </div>
                            <div className="k-field">
                                <label htmlFor="pw-rep">Nhập lại mật khẩu mới</label>
                                <input id="pw-rep" className="k-input" type="password" autoComplete="new-password" required value={pw.confirm} aria-invalid={mismatch || undefined}
                                    onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))} />
                                {mismatch && <span className="k12 k-danger">Chưa khớp</span>}
                            </div>
                        </div>
                        <div className="kg-cardfoot">
                            {pwDone && <span role="status" className="k-line k12 k-m"><Lc name="check" size={16} color="var(--ok)" />Đã đổi mật khẩu</span>}
                            {(pwError?.current || pwError?.form) && <span role="alert" className="k12 k-b k-danger">{pwError.form ?? "Chưa đổi được mật khẩu"}</span>}
                            <span className="end">
                                <button type="submit" className="k-btn p" disabled={pwBusy || weak || mismatch || !pw.current || !pw.next || !pw.confirm} aria-busy={pwBusy || undefined}>
                                    {pwBusy && <span className="cb-spinner is-inline" aria-hidden="true" />}Đổi mật khẩu
                                </button>
                            </span>
                        </div>
                    </form>
                </section>
            </div>
        </>
    );
}
