import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router-dom";
import { plateText, type LocationTypeDto, type Place } from "@indoor-map/core";
import Lc, { type LucideName } from "../../design/Lc";

// Thành phần dùng chung của bộ giao diện khách (gen/ckit.py). Chỉ dùng lớp wf-* trong styles/wayfind.css.

interface IconButtonProps {
    icon: LucideName;
    label: string;
    to?: string;
    onClick?: () => void;
    /** ib = 44 nền xám (màn danh sách); map = 52 nền trắng nổi (thanh bản đồ); map-sm = 44 nổi */
    kind?: "ib" | "map" | "map-sm";
    on?: boolean;
    clear?: boolean;
    disabled?: boolean;
    replace?: boolean;
    expanded?: boolean;
    popup?: "menu" | "dialog" | "listbox";
}

/** Nút chỉ có icon. Có "to" thì là liên kết. */
export function IconButton({ icon, label, to, onClick, kind = "ib", on, clear, disabled, replace, expanded, popup }: IconButtonProps) {
    const base = kind === "ib" ? "wf-ib" : `wf-mbtn wf-lift${kind === "map-sm" ? " is-sm" : ""}`;
    const className = `${base}${on ? " is-on" : ""}${clear ? " is-clear" : ""}`;
    const content = <Lc name={icon} size={20} />;
    if (to && !disabled) {
        return <Link to={to} replace={replace} className={className} aria-label={label} title={label} onClick={onClick}>{content}</Link>;
    }
    return (
        <button type="button" className={className} aria-label={label} title={label} onClick={onClick} disabled={disabled}
            aria-pressed={on === undefined ? undefined : on} aria-expanded={expanded} aria-haspopup={popup}>
            {content}
        </button>
    );
}

interface ButtonProps {
    children?: ReactNode;
    to?: string;
    href?: string;
    onClick?: () => void;
    variant?: "primary" | "secondary" | "text";
    icon?: LucideName;
    /** rộng hết khung */
    block?: boolean;
    /** nút vuông 52 chỉ có icon (cần label) */
    square?: boolean;
    label?: string;
    danger?: boolean;
    disabled?: boolean;
    replace?: boolean;
    type?: "button" | "submit";
    state?: unknown;
}

/** Nút 52: chính (vàng, luôn ở đáy), phụ (xám), chữ (gạch chân, 44) */
export function Button({ children, to, href, onClick, variant = "primary", icon, block, square, label, danger, disabled, replace, type = "button", state }: ButtonProps) {
    const v = variant === "primary" ? "wf-btn-p" : variant === "secondary" ? "wf-btn-s" : "wf-btn-t";
    const className = `wf-btn ${v}${block ? " wf-btn-block" : ""}${square ? " wf-btn-sq" : ""}${danger ? " wf-btn-danger" : ""}`;
    const content = <>{icon && <Lc name={icon} size={20} />}{children != null && <span>{children}</span>}</>;
    const aria = square ? { "aria-label": label, title: label } : {};
    if (to && !disabled) return <Link to={to} replace={replace} state={state} className={className} onClick={onClick} {...aria}>{content}</Link>;
    if (href && !disabled) return <a href={href} className={className} {...aria}>{content}</a>;
    return <button type={type} className={className} onClick={onClick} disabled={disabled} {...aria}>{content}</button>;
}

/** Header màn danh sách: nút quay lại 44 + tiêu đề cỡ 22 + (tuỳ chọn) một nút bên phải */
export function TopBar({ title, back, onBack, right }: { title: ReactNode; back?: string; onBack?: () => void; right?: ReactNode }) {
    return (
        <header className="wf-hdr">
            {(back || onBack) && <IconButton icon="arrow-left" label="Quay lại" to={back} onClick={onBack} />}
            <h1 className="wf-t22">{title}</h1>
            {right}
        </header>
    );
}

/** Bảng trượt có tay nắm */
export function Sheet({ children, label, labelledBy, over, style }: { children: ReactNode; label?: string; labelledBy?: string; over?: boolean; style?: CSSProperties }) {
    return (
        <section className={`wf-sheet${over ? " is-over" : ""}`} aria-label={label} aria-labelledby={labelledBy} style={style}>
            <div className="wf-grab" aria-hidden="true" />
            {children}
        </section>
    );
}

/** Tiêu đề bảng trượt: t28 + chú thích, phần phải tuỳ ý */
export function SheetHead({ title, sub, id, right, kicker, as = "h1" }: { title: ReactNode; sub?: ReactNode; id?: string; right?: ReactNode; kicker?: ReactNode; as?: "h1" | "h2" }) {
    const H = as;
    return (
        <div className="wf-sheet-head">
            <div>
                {kicker}
                <H id={id} className="wf-t28">{title}</H>
                {sub && <p className="wf-t13" style={{ marginTop: 4 }}>{sub}</p>}
            </div>
            {right}
        </div>
    );
}

/** Dòng trạng thái: icon + chữ màu trạng thái */
export function Status({ icon, tone, children }: { icon: LucideName; tone?: "ok" | "warn" | "danger"; children: ReactNode }) {
    return <p className={`wf-t15 wf-status${tone ? ` wf-${tone}` : " wf-muted"}`}><Lc name={icon} size={20} />{children}</p>;
}

interface RowProps {
    title: ReactNode;
    sub?: ReactNode;
    lead?: ReactNode;
    trailing?: ReactNode;
    to?: string;
    onClick?: () => void;
    chevron?: boolean;
    off?: boolean;
    titleId?: string;
}

/** Dòng danh sách: (icon) + tiêu đề t17 + chú thích t13 + phần phải */
export function Row({ title, sub, lead, trailing, to, onClick, chevron, off, titleId }: RowProps) {
    const inner = (
        <>
            {lead}
            <span className="wf-row-text">
                <span id={titleId} className="wf-t17">{title}</span>
                {sub && <span className="wf-t13">{sub}</span>}
            </span>
            {trailing}
            {chevron && <Lc name="chevron-right" size={20} color="var(--muted)" />}
        </>
    );
    const className = `wf-row${off ? " is-off" : ""}`;
    if (to) return <Link to={to} className={className} onClick={onClick}>{inner}</Link>;
    if (onClick) return <button type="button" className={className} onClick={onClick}>{inner}</button>;
    return <div className={className}>{inner}</div>;
}

/** Lựa chọn một trong nhiều (radio) */
export function Option({ title, sub, checked, onSelect, trailing, to }: { title: ReactNode; sub?: ReactNode; checked: boolean; onSelect?: () => void; trailing?: ReactNode; to?: string }) {
    const inner = (
        <>
            <span className="wf-radio" aria-hidden="true" />
            <span className="wf-row-text"><span className="wf-t17">{title}</span>{sub && <span className="wf-t13">{sub}</span>}</span>
            {trailing}
        </>
    );
    if (to) return <Link to={to} className="wf-opt" role="radio" aria-checked={checked}>{inner}</Link>;
    return <button type="button" className="wf-opt" role="radio" aria-checked={checked} onClick={onSelect}>{inner}</button>;
}

/** Nhóm nút ngang (tuỳ chọn tuyến, iPhone/Android) */
export function Segmented<T extends string>({ options, value, onChange, label }: { options: { value: T; label: string; disabled?: boolean }[]; value: T; onChange: (v: T) => void; label: string }) {
    return (
        <div className="wf-segh" role="radiogroup" aria-label={label}>
            {options.map(o => (
                <button key={o.value} type="button" role="radio" aria-checked={o.value === value} disabled={o.disabled} onClick={() => onChange(o.value)}>{o.label}</button>
            ))}
        </div>
    );
}

/** Công tắc 48×28 */
export function Toggle({ checked, onChange, labelledBy, label }: { checked: boolean; onChange: (v: boolean) => void; labelledBy?: string; label?: string }) {
    return <button type="button" role="switch" aria-checked={checked} aria-labelledby={labelledBy} aria-label={label} className="wf-sw" onClick={() => onChange(!checked)} />;
}

/** HUD than chì: ô vàng có mũi tên + số lớn + chỉ dẫn */
export function Hud({ glyph, num, unit, text, sub, right }: { glyph: LucideName; num: ReactNode; unit?: string; text: ReactNode; sub?: ReactNode; right?: ReactNode }) {
    return (
        <header className="wf-hud" role="status" aria-live="polite">
            <span className="wf-hud-glyph" aria-hidden="true"><Lc name={glyph} size={32} stroke={2} /></span>
            <div className="wf-hud-text">
                <div className="wf-t44">{num}{unit && <small>{unit}</small>}</div>
                <div className="wf-t17">{text}</div>
                {sub && <div className="wf-t13" style={{ marginTop: 2 }}>{sub}</div>}
            </div>
            {right}
        </header>
    );
}

/** Chấm tiến độ các bước */
export function Dots({ count, current }: { count: number; current: number }) {
    const parts: ReactNode[] = [];
    for (let i = 0; i < count; i++) {
        parts.push(<i key={`d${i}`} className={i === current ? "on" : ""} />);
        if (i < count - 1) parts.push(<b key={`l${i}`} />);
    }
    return <div className="wf-dots" aria-hidden="true">{parts}</div>;
}

export function Progress({ percent, label }: { percent: number; label: string }) {
    const value = Math.max(0, Math.min(100, Math.round(percent)));
    return <div className="wf-progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}><div style={{ width: `${value}%` }} /></div>;
}

/** Ô biển của một địa điểm (kiểu ghim bản đồ, bo 4): cửa ra = số vàng trên than chì; loại khác = pictogram trên than chì */
export function Plate({ place, type, size = 36 }: { place: Pick<Place, "type" | "name">; type: LocationTypeDto; size?: number }) {
    const text = plateText(place);
    const style: CSSProperties = { width: size, height: size, borderRadius: 4, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "var(--graphite)", color: place.type === "gate" ? "var(--signal)" : "var(--surface)", fontWeight: 700, fontSize: size >= 44 ? 17 : 13 };
    if (place.type === "gate" && text) return <span aria-hidden="true" style={style}>{text}</span>;
    return <span aria-hidden="true" style={style}><i className={`bi ${type.icon || "bi-geo-alt"}`} style={{ fontSize: size * 0.45 }} /></span>;
}

/** Khung xương khi đang tải (không có số liệu giả) */
export function Loading({ text = "Đang tải bản đồ…" }: { text?: string }) {
    return (
        <div className="wf-loading" role="status" aria-live="polite">
            <p className="wf-t15 wf-muted">{text}</p>
            <div className="wf-skel" style={{ height: 28, width: "55%" }} />
            <div className="wf-tiles">
                {[0, 1, 2, 3].map(i => <div key={i} className="wf-skel is-box" style={{ height: 108 }} />)}
            </div>
        </div>
    );
}

/** Khối lỗi: dòng trạng thái đỏ + tiêu đề t28 + lời giải thích + (tuỳ chọn) hành động */
export function ErrorBox({ title, status = "Có lỗi", children, action, icon = "circle-alert" }: { title: string; status?: string; children?: ReactNode; action?: ReactNode; icon?: LucideName }) {
    return (
        <div role="alert" style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
            <Status icon={icon} tone="danger">{status}</Status>
            <h2 className="wf-t28">{title}</h2>
            {children && <p className="wf-t15 wf-muted">{children}</p>}
            {action && <div style={{ marginTop: 16 }}>{action}</div>}
        </div>
    );
}

/** Màn lỗi khung danh sách (Viewer-Error): header + khối lỗi + nút ở đáy */
export function ErrorScreen({ title, status, message, headerTitle = "Indoor Map", back, block, foot, icon }: {
    title: string; status: string; message?: ReactNode; headerTitle?: string; back?: string; block?: ReactNode; foot?: ReactNode; icon?: LucideName;
}) {
    return (
        <div className="wf-screen">
            <TopBar title={headerTitle} back={back} />
            <main className="wf-main" style={{ paddingTop: 24 }}>
                <ErrorBox title={title} status={status} icon={icon}>{message}</ErrorBox>
                {block}
            </main>
            {foot && <div className="wf-foot">{foot}</div>}
        </div>
    );
}

/** Màn "Chưa khả dụng": tính năng cần máy chủ chưa có. Không có số liệu giả. */
export function Unavailable({ children }: { children: ReactNode }) {
    return (
        <div className="wf-card is-white" role="note" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Status icon="info">Chưa khả dụng</Status>
            <p className="wf-t15 wf-muted">{children}</p>
        </div>
    );
}
