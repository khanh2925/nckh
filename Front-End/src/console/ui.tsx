import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Link } from "react-router-dom";

// Bộ giao diện "Cobalt" cho Builder và Admin: giấy trắng lạnh, đường kẻ mảnh 1px, nút chính có bóng phím.

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

interface ButtonProps {
    children: ReactNode;
    variant?: ButtonVariant;
    onClick?: () => void;
    to?: string;
    type?: "button" | "submit";
    disabled?: boolean;
    busy?: boolean;
    small?: boolean;
    icon?: string;
    title?: string;
}

export function Button({ children, variant = "secondary", onClick, to, type = "button", disabled, busy, small, icon, title }: ButtonProps) {
    const className = `cb-btn cb-btn-${variant}${small ? " is-small" : ""}`;
    const content = <>{icon && <i className={`bi ${icon}`} aria-hidden="true" />}{busy ? <span className="cb-spinner is-inline" aria-hidden="true" /> : null}<span>{children}</span></>;
    if (to && !disabled) return <Link to={to} className={className} title={title}>{content}</Link>;
    return <button type={type} className={className} onClick={onClick} disabled={disabled || busy} title={title} aria-busy={busy || undefined}>{content}</button>;
}

interface FieldShellProps {
    label: ReactNode;
    help?: ReactNode;
    error?: string | null;
    children: (id: string) => ReactNode;
}

function FieldShell({ label, help, error, children }: FieldShellProps) {
    const id = useId();
    return (
        <div className={`cb-field${error ? " has-error" : ""}`}>
            <label htmlFor={id}>{label}</label>
            {children(id)}
            {error ? <div className="cb-field-error" role="alert">{error}</div> : help ? <div className="cb-field-help">{help}</div> : null}
        </div>
    );
}

export function Field({ label, help, error, ...input }: { label: ReactNode; help?: ReactNode; error?: string | null } & InputHTMLAttributes<HTMLInputElement>) {
    return <FieldShell label={label} help={help} error={error}>{id => <input id={id} className="cb-input" {...input} />}</FieldShell>;
}

export function TextArea({ label, help, error, ...input }: { label: ReactNode; help?: ReactNode; error?: string | null } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
    return <FieldShell label={label} help={help} error={error}>{id => <textarea id={id} className="cb-input" rows={3} {...input} />}</FieldShell>;
}

export function Select({ label, help, children, ...input }: { label: ReactNode; help?: ReactNode; children: ReactNode } & SelectHTMLAttributes<HTMLSelectElement>) {
    return <FieldShell label={label} help={help}>{id => <select id={id} className="cb-input" {...input}>{children}</select>}</FieldShell>;
}

export function Check({ label, checked, onChange, help }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; help?: ReactNode }) {
    return (
        <label className="cb-check">
            <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
            <span>{label}{help && <small>{help}</small>}</span>
        </label>
    );
}

export function PageHead({ title, sub, actions }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
    return (
        <div className="cb-page-head">
            <div>
                <h1 className="cb-h1">{title}</h1>
                {sub && <p className="cb-muted">{sub}</p>}
            </div>
            {actions && <div className="cb-actions">{actions}</div>}
        </div>
    );
}

export function Card({ title, actions, children, pad = true, className = "" }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; pad?: boolean; className?: string }) {
    return (
        <section className={`cb-card ${className}`}>
            {title && <header className="cb-card-head"><h2 className="cb-h3">{title}</h2>{actions && <div className="cb-actions">{actions}</div>}</header>}
            <div className={pad ? "cb-pad" : ""}>{children}</div>
        </section>
    );
}

export type StatusKind = "ok" | "warn" | "err" | "mut" | "live";
const STATUS_ICON: Record<StatusKind, string> = { ok: "bi-check-lg", warn: "bi-exclamation-triangle", err: "bi-x-circle", mut: "bi-dot", live: "bi-record-circle" };

/** Trạng thái bằng chữ + icon (không chỉ bằng màu) */
export function Status({ kind, children }: { kind: StatusKind; children: ReactNode }) {
    return <span className={`cb-status is-${kind}`}><i className={`bi ${STATUS_ICON[kind]}`} aria-hidden="true" />{children}</span>;
}

export function Kpi({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "live" | "ok" | "warn" | "err" }) {
    return (
        <div className="cb-card cb-kpi">
            <div className="cb-muted">{label}</div>
            <div className={`cb-kpi-value${tone ? ` is-${tone}` : ""}`}>{value}</div>
            {sub && <div className="cb-kpi-sub">{sub}</div>}
        </div>
    );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
    return (
        <div className="cb-empty">
            <div className="cb-h3">{title}</div>
            {children && <p className="cb-muted">{children}</p>}
            {action}
        </div>
    );
}

/** Chức năng có trong thiết kế nhưng backend chưa có API */
export function NotYet({ title, children }: { title: string; children: ReactNode }) {
    return (
        <div className="cb-notyet" role="note">
            <i className="bi bi-hourglass-split" aria-hidden="true" />
            <div><b>{title}</b><p>{children}</p></div>
        </div>
    );
}

export function Spinner({ label = "Đang tải…" }: { label?: string }) {
    return <div className="cb-loading" role="status"><span className="cb-spinner" aria-hidden="true" />{label}</div>;
}

export function ErrorNote({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
    return (
        <div className="cb-alert is-err" role="alert">
            <i className="bi bi-x-circle" aria-hidden="true" />
            <span>{(error as Error)?.message || "Có lỗi xảy ra"}</span>
            {onRetry && <Button small onClick={onRetry}>Thử lại</Button>}
        </div>
    );
}

// ---------------------------------------------------------------- thông báo nhanh + hộp xác nhận
interface Toast {
    id: number;
    text: string;
    kind: "ok" | "err";
}
interface Confirm {
    text: string;
    detail?: string;
    danger?: boolean;
    okLabel?: string;
    resolve: (ok: boolean) => void;
}
interface FeedbackState {
    toast(text: string, kind?: "ok" | "err"): void;
    confirm(text: string, options?: { detail?: string; danger?: boolean; okLabel?: string }): Promise<boolean>;
}
const FeedbackContext = createContext<FeedbackState | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [dialog, setDialog] = useState<Confirm | null>(null);
    const counter = useRef(0);
    const okRef = useRef<HTMLButtonElement>(null);

    const toast = useCallback((text: string, kind: "ok" | "err" = "ok") => {
        const id = ++counter.current;
        setToasts(t => [...t, { id, text, kind }]);
        window.setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), kind === "err" ? 6000 : 3000);
    }, []);
    const confirm = useCallback((text: string, options: { detail?: string; danger?: boolean; okLabel?: string } = {}) =>
        new Promise<boolean>(resolve => setDialog({ text, ...options, resolve })), []);

    useEffect(() => {
        if (!dialog) return undefined;
        okRef.current?.focus();
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                dialog.resolve(false);
                setDialog(null);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [dialog]);

    const close = (ok: boolean) => {
        dialog?.resolve(ok);
        setDialog(null);
    };

    return (
        <FeedbackContext.Provider value={{ toast, confirm }}>
            {children}
            <div className="cb-toasts" aria-live="polite">
                {toasts.map(t => <div key={t.id} className={`cb-toast is-${t.kind}`}><i className={`bi ${t.kind === "ok" ? "bi-check-lg" : "bi-x-circle"}`} aria-hidden="true" />{t.text}</div>)}
            </div>
            {dialog && (
                <div className="cb-modal-backdrop" onClick={() => close(false)}>
                    <div className="cb-modal" role="alertdialog" aria-modal="true" aria-labelledby="cb-confirm-title" onClick={e => e.stopPropagation()}>
                        <h2 id="cb-confirm-title" className="cb-h3">{dialog.text}</h2>
                        {dialog.detail && <p className="cb-muted">{dialog.detail}</p>}
                        <div className="cb-actions is-end">
                            <Button onClick={() => close(false)}>Huỷ</Button>
                            <button ref={okRef} type="button" className={`cb-btn ${dialog.danger ? "cb-btn-danger-solid" : "cb-btn-primary"}`} onClick={() => close(true)}>
                                {dialog.okLabel ?? "Đồng ý"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </FeedbackContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useFeedback(): FeedbackState {
    const value = useContext(FeedbackContext);
    if (!value) throw new Error("useFeedback() phải nằm trong <FeedbackProvider>");
    return value;
}

/** Chạy một thao tác gọi API: hiện lỗi bằng toast, trả về kết quả hoặc null */
// eslint-disable-next-line react-refresh/only-export-components
export function useAction() {
    const { toast } = useFeedback();
    const [busy, setBusy] = useState(false);
    const run = useCallback(async <T,>(fn: () => Promise<T>, success?: string): Promise<T | null> => {
        setBusy(true);
        try {
            const result = await fn();
            if (success) toast(success);
            return result;
        } catch (error) {
            toast((error as Error).message || "Có lỗi xảy ra", "err");
            return null;
        } finally {
            setBusy(false);
        }
    }, [toast]);
    return { busy, run };
}

export function Table({ head, children, minWidth = 640 }: { head: ReactNode[]; children: ReactNode; minWidth?: number }) {
    return (
        <div className="cb-table-wrap">
            <table className="cb-table" style={{ minWidth }}>
                <thead><tr>{head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
                <tbody>{children}</tbody>
            </table>
        </div>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export const COLORS = ["#a83039", "#3f6fb5", "#6d4fb5", "#d9822b", "#c96a8e", "#1f8a8a", "#2a7f62", "#8a5a2b", "#7a8794", "#4a4f55", "#7b5ea7", "#5f6368"];

export function ColorPicker({ value, onChange, label = "Màu" }: { value: string; onChange: (c: string) => void; label?: string }) {
    return (
        <div className="cb-field">
            <span className="cb-label">{label}</span>
            <div className="cb-swatches" role="radiogroup" aria-label={label}>
                {COLORS.map(c => (
                    <button key={c} type="button" role="radio" aria-checked={value.toLowerCase() === c} aria-label={c}
                        className={`cb-swatch${value.toLowerCase() === c ? " is-on" : ""}`} style={{ background: c }} onClick={() => onChange(c)} />
                ))}
                <input type="color" aria-label="Màu khác" value={value} onChange={e => onChange(e.target.value)} className="cb-color-input" />
            </div>
        </div>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export const ICONS = [
    "bi-door-open", "bi-suitcase", "bi-shield-check", "bi-luggage", "bi-ticket-perforated", "bi-fork-knife", "bi-cup-hot", "bi-bag",
    "bi-lamp", "bi-credit-card", "bi-info-lg", "bi-hospital", "bi-badge-wc", "bi-arrow-down-up", "bi-chevron-double-up", "bi-stairs",
    "bi-box-arrow-in-right", "bi-p-square", "bi-easel", "bi-building", "bi-book", "bi-heart-pulse", "bi-tree", "bi-geo-alt"
];

export function IconPicker({ value, onChange }: { value: string; onChange: (icon: string) => void }) {
    return (
        <div className="cb-field">
            <span className="cb-label">Biểu tượng</span>
            <div className="cb-icons" role="radiogroup" aria-label="Biểu tượng">
                {ICONS.map(icon => (
                    <button key={icon} type="button" role="radio" aria-checked={value === icon} aria-label={icon}
                        className={`cb-icon-choice${value === icon ? " is-on" : ""}`} onClick={() => onChange(icon)}>
                        <i className={`bi ${icon}`} aria-hidden="true" />
                    </button>
                ))}
            </div>
        </div>
    );
}
