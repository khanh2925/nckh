import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link, NavLink, useNavigate } from "react-router-dom";
import Lc, { type LucideName } from "../design/Lc";
import { useAuth } from "./auth";

// Một khung cho mọi màn máy tính (Builder, Admin): header 64 than chì có vạch vàng + sidebar 224 (hoặc rail 64).
// Trang đặt nút của mình lên header bằng <HeaderActions> và trạng thái lưu bằng <HeaderStatus> (cổng React).

interface Slots {
    actions: HTMLElement | null;
    status: HTMLElement | null;
}
const SlotContext = createContext<Slots>({ actions: null, status: null });

/** Nút của trang, hiện ở bên phải header. Mỗi màn tối đa một nút chính (variant="primary"). */
export function HeaderActions({ children }: { children: ReactNode }) {
    const { actions } = useContext(SlotContext);
    return actions ? createPortal(children, actions) : null;
}

/** Trạng thái cạnh breadcrumb (đã lưu, chưa lưu, lỗi lưu). */
export function HeaderStatus({ children }: { children: ReactNode }) {
    const { status } = useContext(SlotContext);
    return status ? createPortal(children, status) : null;
}

export function SaveState({ state, count, onRetry }: { state: "saved" | "saving" | "dirty" | "error"; count?: number; onRetry?: () => void }) {
    if (state === "saved") return <span className="cs-save" role="status"><Lc name="check" size={14} stroke={2.4} />Đã lưu bản nháp</span>;
    if (state === "saving") return <span className="cs-save" role="status">Đang lưu…</span>;
    if (state === "dirty") return <span className="cs-save is-dirty" role="status">{count ? `${count} thay đổi chưa lưu` : "Có thay đổi chưa lưu"}</span>;
    return (
        <span className="cs-save is-err" role="status">
            Lưu thất bại{onRetry && <button type="button" onClick={onRetry} className="k-link" style={{ background: "none", border: 0, color: "var(--hud-ink)", cursor: "pointer", padding: 0 }}>Thử lại</button>}
        </span>
    );
}

export interface Crumb {
    label: string;
    to?: string;
}

function initials(name?: string) {
    const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    const first = parts[0]!.charAt(0);
    const last = parts.length > 1 ? parts[parts.length - 1]!.charAt(0) : "";
    return (first + last).toUpperCase();
}

function AccountMenu({ area }: { area: "builder" | "admin" }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!open) return undefined;
        const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
        window.addEventListener("mousedown", onDown);
        window.addEventListener("keydown", onKey);
        return () => {
            window.removeEventListener("mousedown", onDown);
            window.removeEventListener("keydown", onKey);
        };
    }, [open]);
    return (
        <div ref={ref}>
            <button type="button" className="cs-avatar" aria-label="Tài khoản và đăng xuất" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)}>
                {initials(user?.fullName)}
            </button>
            {open && (
                <div className="cs-menu" role="menu">
                    <div className="cs-menu-who"><span className="k14 k-b">{user?.fullName}</span><span className="k12 k-m">{user?.email}</span></div>
                    <Link role="menuitem" to="/builder/account" onClick={() => setOpen(false)}><Lc name="user" />Tài khoản</Link>
                    {user?.role === "SYSTEM_ADMIN" && (area === "admin"
                        ? <Link role="menuitem" to="/builder" onClick={() => setOpen(false)}><Lc name="building" />Mở Builder</Link>
                        : <Link role="menuitem" to="/admin" onClick={() => setOpen(false)}><Lc name="shield-check" />Quản trị hệ thống</Link>)}
                    <button role="menuitem" type="button" onClick={() => { logout(); navigate("/login"); }}><Lc name="log-out" />Đăng xuất</button>
                </div>
            )}
        </div>
    );
}

interface FrameProps {
    area?: "builder" | "admin";
    crumbs: Crumb[];
    /** Chip cạnh breadcrumb (ví dụ trạng thái xuất bản) */
    chip?: ReactNode;
    nav: ReactNode;
    /** true: trang tự lo cuộn (canvas, bản đồ tràn màn) */
    full?: boolean;
    children: ReactNode;
}

export function ConsoleFrame({ area = "builder", crumbs, chip, nav, full, children }: FrameProps) {
    const [slots, setSlots] = useState<Slots>({ actions: null, status: null });
    const actionsRef = useRef<HTMLDivElement>(null);
    const statusRef = useRef<HTMLSpanElement>(null);
    useEffect(() => setSlots({ actions: actionsRef.current, status: statusRef.current }), []);
    return (
        <SlotContext.Provider value={slots}>
            <div className="cs-app">
                <header className="cs-head">
                    <Link to={area === "admin" ? "/admin" : "/builder"} className="cs-logo" aria-label={area === "admin" ? "Indoor Map, về Tổng quan hệ thống" : "Indoor Map, về Địa điểm của tôi"}>
                        <Lc name="map-pin" size={18} stroke={2.2} />
                    </Link>
                    <nav className="cs-crumbs" aria-label="Vị trí">
                        {crumbs.map((c, i) => i < crumbs.length - 1
                            ? <span key={i} className="k-line">{c.to ? <Link to={c.to}>{c.label}</Link> : <span>{c.label}</span>}<span className="sep" aria-hidden="true">/</span></span>
                            : <b key={i} aria-current="page">{c.label}</b>)}
                    </nav>
                    {chip}
                    <span ref={statusRef} style={{ display: "contents" }} />
                    <div className="cs-right">
                        <div ref={actionsRef} style={{ display: "contents" }} />
                        <AccountMenu area={area} />
                    </div>
                </header>
                <div className="cs-body">
                    {nav}
                    <main className={`cs-main${full ? " is-full" : ""}`}>{children}</main>
                </div>
            </div>
        </SlotContext.Provider>
    );
}

// ---------------------------------------------------------------- sidebar
export function SideItem({ to, icon, mark, label, count, end, sub }: { to: string; icon?: LucideName; mark?: ReactNode; label: string; count?: ReactNode; end?: boolean; sub?: boolean }) {
    return (
        <NavLink to={to} end={end} className={`cs-item${sub ? " is-sub" : ""}`}>
            {mark}{icon && <Lc name={icon} />}{label}{count != null && <span className="cs-count">{count}</span>}
        </NavLink>
    );
}

export function Sidebar({ label, children }: { label: string; children: ReactNode }) {
    return <nav className="cs-side" aria-label={label}>{children}</nav>;
}

export function SideGroup({ children }: { children: ReactNode }) {
    return <div className="cs-group">{children}</div>;
}

export function SideSep() {
    return <div className="cs-sep" role="separator" />;
}

/** Dấu bước: xong = dấu tick, chưa = số thứ tự */
export function StepMark({ n, done }: { n: number; done: boolean }) {
    return done
        ? <span className="cs-mark is-done" aria-label="Đã xong"><Lc name="check" size={16} /></span>
        : <span className="cs-mark" aria-hidden="true">{n}</span>;
}

export function GlobalSidebar() {
    return (
        <Sidebar label="Điều hướng chính">
            <SideGroup>Quản lý</SideGroup>
            <SideItem to="/builder" end icon="building" label="Địa điểm của tôi" />
            <SideItem to="/builder/stats" icon="chart-column" label="Thống kê" />
            <SideItem to="/builder/account" icon="user" label="Tài khoản" />
        </Sidebar>
    );
}
