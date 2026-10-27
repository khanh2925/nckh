import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { plateText, type LocationTypeDto, type Place } from "@indoor-map/core";
import Icon, { type IconName } from "./Icon";

interface IconButtonProps {
    icon: IconName;
    label: string;
    to?: string;
    onClick?: () => void;
    variant?: "" | "is-live" | "is-ink" | "is-ghost";
    size?: number;
    disabled?: boolean;
}

/** Nút vuông có icon, viền mực 2px. Có "to" thì là liên kết. */
export function IconButton({ icon, label, to, onClick, variant = "", size, disabled }: IconButtonProps) {
    const className = `wf-icon-btn ${variant}`;
    const style = size ? { width: size, height: size } : undefined;
    if (to) {
        return <Link to={to} className={className} style={style} aria-label={label} title={label}><Icon name={icon} /></Link>;
    }
    return (
        <button type="button" className={className} style={style} aria-label={label} title={label} onClick={onClick} disabled={disabled}>
            <Icon name={icon} />
        </button>
    );
}

interface ButtonProps {
    children: ReactNode;
    to?: string;
    onClick?: () => void;
    variant?: "primary" | "secondary" | "danger";
    icon?: IconName;
    full?: boolean;
    disabled?: boolean;
    replace?: boolean;
}

export function Button({ children, to, onClick, variant = "primary", icon, full = true, disabled, replace }: ButtonProps) {
    const className = `wf-btn wf-btn-${variant}${full ? " is-full" : ""}`;
    const content = <>{icon && <Icon name={icon} size={18} stroke={2.6} />}<span>{children}</span></>;
    if (to) return <Link to={to} replace={replace} className={className}>{content}</Link>;
    return <button type="button" className={className} onClick={onClick} disabled={disabled}>{content}</button>;
}

/** Thanh trên: nút trái, dòng nhỏ (kicker) + tiêu đề, phần phải tuỳ ý */
export function TopBar({ kicker, title, left, right }: { kicker?: ReactNode; title: ReactNode; left?: ReactNode; right?: ReactNode }) {
    return (
        <header className="wf-topbar">
            {left}
            <div className="wf-topbar-text">
                {kicker && <div className="wf-kicker">{kicker}</div>}
                <h1 className="wf-title">{title}</h1>
            </div>
            {right}
        </header>
    );
}

/** Biển của một địa điểm: cửa ra = số trên nền mực chữ hổ phách; loại khác = ô màu + icon */
export function Plate({ place, type, size = 44 }: { place: Pick<Place, "type" | "name">; type: LocationTypeDto; size?: number }) {
    const text = plateText(place);
    if (place.type === "gate" && text) {
        return <span className="wf-plate is-gate" style={{ width: size, height: size, fontSize: size > 50 ? 22 : 12 }}>{text}</span>;
    }
    return (
        <span className="wf-plate" style={{ width: size, height: size, background: type.color || "#5f6368" }}>
            {text === "WC" ? <b>WC</b> : <i className={`bi ${type.icon || "bi-geo-alt"}`} />}
        </span>
    );
}

export function SectionKicker({ children, right }: { children: ReactNode; right?: ReactNode }) {
    return <div className="wf-section-kicker"><span>{children}</span>{right}</div>;
}

export function Toggle({ checked, onChange, labelledBy }: { checked: boolean; onChange: (v: boolean) => void; labelledBy: string }) {
    return (
        <button type="button" role="switch" aria-checked={checked} aria-labelledby={labelledBy}
            className={`wf-switch${checked ? " is-on" : ""}`} onClick={() => onChange(!checked)}>
            <span />
        </button>
    );
}

export function Loading({ text = "Đang tải bản đồ…" }: { text?: string }) {
    return <div className="wf-loading" role="status"><span className="wf-loading-bar" /><span>{text}</span></div>;
}

export function ErrorBox({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
    return (
        <div className="wf-error" role="alert">
            <div className="wf-error-title">{title}</div>
            {children && <p>{children}</p>}
            {action}
        </div>
    );
}
