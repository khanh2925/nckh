import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { Floor, VenueDto, VenueModel } from "@indoor-map/core";
import Lc from "../design/Lc";
import "./pages/workspace.css";

// Mảnh giao diện dùng chung cho các màn trong workspace: chọn tầng, nút xem như khách, hộp thoại, menu thao tác.

/** Tên tầng kèm mã toà khi địa điểm có nhiều toà */
// eslint-disable-next-line react-refresh/only-export-components
export function floorLabel(model: VenueModel, floor: Floor | undefined, sep = " / "): string {
    if (!floor) return "";
    return model.buildings.length > 1 ? `${floor.buildingCode}${sep}${floor.name}` : floor.name;
}

/** Cột trái: các tầng theo toà nhà, kèm số đếm tuỳ trang (hàng .ws-tl như bản thiết kế) */
export default function FloorList({ model, floorId, onSelect, count, buildingId }: {
    model: VenueModel; floorId: number | null; onSelect(id: number): void; count?: (floorId: number) => string | number; buildingId?: number;
}) {
    const buildings = buildingId != null ? model.buildings.filter(b => b.id === buildingId) : model.buildings;
    return (
        <>
            {buildings.map(b => {
                const floors = model.floorsOf(b.id);
                if (!floors.length) return null;
                return (
                    <div key={b.id} role="group" aria-label={`${b.code} ${b.name}`}>
                        {buildingId == null && model.buildings.length > 1 && <div className="k12 k-m k-b" style={{ padding: "8px 8px 4px" }}>{b.code} {b.name}</div>}
                        {floors.map(f => (
                            <button key={f.id} type="button" className="ws-tl" aria-current={f.id === floorId} onClick={() => onSelect(f.id)}>
                                <span className="ws-ellipsis">{f.name}</span>
                                <span className="n k12 k-m">{!f.plan ? "chưa có mặt bằng" : count ? count(f.id) : ""}</span>
                            </button>
                        ))}
                    </div>
                );
            })}
        </>
    );
}

/** Chọn tầng dạng chip nổi trên canvas: một hàng chip tầng của toà đang xem, toà khác chọn ở ô bên trái */
export function FloorChips({ model, floorId, onSelect }: { model: VenueModel; floorId: number | null; onSelect(id: number): void }) {
    const current = floorId != null ? model.floorsById.get(floorId) : undefined;
    const building = model.buildings.find(b => b.id === current?.buildingId) ?? model.buildings[0];
    return (
        <div role="group" aria-label="Chọn tầng" className="ws-float is-tl" style={{ gap: 8, flexWrap: "nowrap", maxWidth: "calc(100% - 32px)", overflowX: "auto" }}>
            {model.buildings.length > 1 && building && (
                <>
                    <label htmlFor="ws-building" className="sr-only">Toà nhà</label>
                    <select id="ws-building" className="k-input" style={{ width: "auto", height: 32, flexShrink: 0 }} value={building.id}
                        onChange={e => { const first = model.floorsOf(Number(e.target.value))[0]; if (first) onSelect(first.id); }}>
                        {model.buildings.map(b => <option key={b.id} value={b.id}>{b.code} {b.name}</option>)}
                    </select>
                </>
            )}
            {building && model.floorsOf(building.id).map(f => (
                <button key={f.id} type="button" className="k-chip" style={{ flexShrink: 0 }} aria-pressed={f.id === floorId} onClick={() => onSelect(f.id)}>{f.name}</button>
            ))}
        </div>
    );
}

/** Chọn toà và tầng dạng ô chọn */
export function FloorSelect({ model, floorId, onSelect, id = "floor", width = 240, label = "Toà và tầng" }: {
    model: VenueModel; floorId: number | null; onSelect(id: number): void; id?: string; width?: number; label?: string;
}) {
    return (
        <>
            <label htmlFor={id} className="sr-only">{label}</label>
            <select id={id} className="k-input" style={{ width }} value={floorId ?? ""} onChange={e => onSelect(Number(e.target.value))}>
                {model.buildings.flatMap(b => model.floorsOf(b.id)).map(f => <option key={f.id} value={f.id}>{model.buildings.length > 1 ? `${f.buildingCode} – ${f.name}` : f.name}</option>)}
            </select>
        </>
    );
}

/** Nút "Xem như khách" trên header (chỉ khi đã công khai: bản nháp chưa có trang cho khách) */
export function GuestLink({ venue }: { venue: VenueDto }) {
    if (venue.status !== "PUBLISHED") return null;
    return <a className="cb-btn cb-btn-secondary" href={`/v/${venue.slug}`} target="_blank" rel="noreferrer">Xem như khách</a>;
}

/** Hộp thoại theo bộ k-* (Esc hoặc bấm nền để đóng) */
export function Dialog({ title, children, actions, onClose, onSubmit, alert, wide }: {
    title: ReactNode; children: ReactNode; actions: ReactNode; onClose(): void; onSubmit?: (e: FormEvent) => void; alert?: boolean; wide?: boolean;
}) {
    const id = useId();
    const box = useRef<HTMLDivElement & HTMLFormElement>(null);
    const close = useRef(onClose);
    useEffect(() => {
        close.current = onClose;
    }, [onClose]);
    useEffect(() => {
        const first = box.current?.querySelector<HTMLElement>("input:not([type=hidden]), select, textarea");
        (first ?? box.current)?.focus();
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && close.current();
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);
    return (
        <div className="k-scrim" onMouseDown={e => e.target === e.currentTarget && onClose()}>
            {onSubmit ? (
                <form ref={box} tabIndex={-1} className="k-dlg" role={alert ? "alertdialog" : "dialog"} aria-modal="true" aria-labelledby={id} style={wide ? { width: 560 } : undefined}
                    onSubmit={e => { e.preventDefault(); onSubmit(e); }}>
                    <h2 id={id} className="k20">{title}</h2>
                    {children}
                    <div className="k-line" style={{ justifyContent: "flex-end" }}>{actions}</div>
                </form>
            ) : (
                <div ref={box} tabIndex={-1} className="k-dlg" role={alert ? "alertdialog" : "dialog"} aria-modal="true" aria-labelledby={id} style={wide ? { width: 560 } : undefined}>
                    <h2 id={id} className="k20">{title}</h2>
                    {children}
                    <div className="k-line" style={{ justifyContent: "flex-end" }}>{actions}</div>
                </div>
            )}
        </div>
    );
}

/** Nút ⋯ mở menu thao tác của một hàng */
export function RowMenu({ label, children, trigger }: { label: string; children: ReactNode; trigger?: ReactNode }) {
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
        <div ref={ref} className="ws-menuwrap">
            {trigger
                ? <button type="button" className="k-btn" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)}>{trigger}<Lc name="chevron-down" size={16} color="var(--muted)" /></button>
                : <button type="button" className="k-ib sm t" aria-label={label} title={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)}><Lc name="ellipsis" size={16} /></button>}
            {open && <div role="menu" className="ws-menu" onClick={() => setOpen(false)}>{children}</div>}
        </div>
    );
}
