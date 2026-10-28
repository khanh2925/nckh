import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { VenueDto } from "@indoor-map/core";
import { venueApi } from "../../console/api";
import { HeaderActions } from "../../console/Shell";
import { Button, ErrorNote, Status } from "../../console/ui";
import Lc from "../../design/Lc";
import "./global.css";

// eslint-disable-next-line react-refresh/only-export-components
export const KIND_LABEL: Record<string, string> = {
    airport: "Sân bay", hospital: "Bệnh viện", school: "Trường học", mall: "Trung tâm thương mại", park: "Công viên", office: "Văn phòng", other: "Khác"
};

export function VenueStatus({ status }: { status?: string }) {
    if (status === "PUBLISHED") return <Status kind="ok">Công khai</Status>;
    if (status === "HIDDEN") return <Status kind="err">Bị ẩn bởi quản trị</Status>;
    return <Status kind="mut">Bản nháp</Status>;
}

// Tiến độ dựng: chỉ các mục đọc được từ danh sách địa điểm (số toà nhà, tầng, điểm, trạng thái)
const STEPS: { label: string; done: (v: VenueDto) => boolean; path: string; next: string }[] = [
    { label: "Toà nhà", done: v => (v.buildingCount ?? 0) > 0, path: "buildings", next: "Tiếp tục: Toà nhà" },
    { label: "Tầng", done: v => (v.floorCount ?? 0) > 0, path: "buildings", next: "Tiếp tục: Tầng" },
    { label: "Điểm", done: v => (v.locationCount ?? 0) > 0, path: "editor", next: "Tiếp tục: Điểm" },
    { label: "Xuất bản", done: v => v.status === "PUBLISHED", path: "publish", next: "Tiếp tục: Xuất bản" }
];

function Progress({ venue }: { venue: VenueDto }) {
    const states = STEPS.map(s => s.done(venue));
    const done = states.filter(Boolean).length;
    const nextIndex = states.indexOf(false);
    return (
        <>
            <span className="k14 k-b">{done}/{STEPS.length} bước</span>
            <div className="kg-prog" aria-hidden="true">
                {states.map((ok, i) => <span key={i} className={ok ? "is-done" : i === nextIndex ? "is-next" : ""} />)}
            </div>
            <ol className="sr-only" aria-label="Các bước dựng bản đồ">
                {STEPS.map((s, i) => <li key={s.label}>{s.label}: {states[i] ? "xong" : "chưa xong"}</li>)}
            </ol>
            <span className="k12 k-m kg-sub">{nextIndex < 0 ? "Đã xong các bước" : `Còn: ${STEPS[nextIndex]!.label.toLowerCase()}`}</span>
        </>
    );
}

function statusNote(v: VenueDto) {
    if (v.status === "PUBLISHED") return "Khách đang xem được";
    if (v.status === "HIDDEN") return "Khách không mở được";
    return "Chưa có bản công khai";
}

function MoreMenu({ venue }: { venue: VenueDto }) {
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
    const base = `/builder/v/${venue.id}`;
    return (
        <div className="kg-menu-wrap" ref={ref}>
            <button type="button" className="k-ib sm t" aria-label={`Thao tác khác với ${venue.name}`} title="Thao tác khác"
                aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)}>
                <Lc name="ellipsis" size={16} />
            </button>
            {open && (
                <div className="kg-menu" role="menu">
                    {venue.status === "PUBLISHED" && <a role="menuitem" href={`/v/${venue.slug}`} target="_blank" rel="noreferrer"><Lc name="eye" size={16} />Xem như khách</a>}
                    <Link role="menuitem" to={`${base}/test`}><Lc name="route" size={16} />Thử chỉ đường</Link>
                    <Link role="menuitem" to={`${base}/qr`}><Lc name="qr-code" size={16} />Mã QR định vị</Link>
                    <Link role="menuitem" to={`${base}/settings`}><Lc name="settings" size={16} />Cài đặt địa điểm</Link>
                </div>
            )}
        </div>
    );
}

function action(v: VenueDto): [string, string] {
    const base = `/builder/v/${v.id}`;
    if (v.status === "HIDDEN") return ["Mở cài đặt địa điểm", `${base}/settings`];
    const next = STEPS.find(s => !s.done(v));
    return next ? [next.next, `${base}/${next.path}`] : ["Mở không gian làm việc", `${base}/buildings`];
}

function SkeletonRows() {
    return (
        <>
            {[180, 140, 160].map((w, i) => (
                <tr key={i}>
                    <td><div className="k-stack" style={{ gap: 8 }}><span className="k-skel" style={{ width: w, height: 16 }} /><span className="k-skel" style={{ width: w + 40, height: 12 }} /></div></td>
                    <td><span className="k-skel" style={{ width: 96, height: 12 }} /></td>
                    <td><span className="k-skel" style={{ width: 140, height: 12 }} /></td>
                    <td className="num"><span className="k-skel" style={{ width: 24, height: 12, marginLeft: "auto" }} /></td>
                    <td className="num"><span className="k-skel" style={{ width: 24, height: 12, marginLeft: "auto" }} /></td>
                    <td className="num"><span className="k-skel" style={{ width: 32, height: 12, marginLeft: "auto" }} /></td>
                    <td><span className="k-skel" style={{ width: 160, height: 32, marginLeft: "auto" }} /></td>
                </tr>
            ))}
        </>
    );
}

export default function VenuesPage() {
    const [venues, setVenues] = useState<VenueDto[] | null>(null);
    const [error, setError] = useState<unknown>(null);
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        let alive = true;
        venueApi.mine().then(list => {
            if (!alive) return;
            setVenues(list);
            setError(null);
        }).catch(e => alive && setError(e));
        return () => {
            alive = false;
        };
    }, [attempt]);

    const empty = venues !== null && venues.length === 0;

    return (
        <>
            <HeaderActions><Button variant="primary" to="/builder/new">Tạo địa điểm</Button></HeaderActions>
            <div className="k-title">
                <h1 className="k24">Địa điểm của tôi</h1>
                {venues && venues.length > 0 && <span className="k14 k-m">{venues.length} địa điểm</span>}
            </div>
            {error ? <ErrorNote error={error} onRetry={() => setAttempt(a => a + 1)} /> : null}
            {empty ? (
                <div className="k-card kg-empty">
                    <h2 className="k16">Chưa có địa điểm nào</h2>
                    <p className="k14 k-m">Bắt đầu bằng tên và phạm vi địa điểm.</p>
                    <div style={{ marginTop: 8 }}><Button to="/builder/new">Tạo địa điểm đầu tiên</Button></div>
                </div>
            ) : !error && (
                <div className="k-card kg-flat">
                    <table className="k-tbl" aria-label="Danh sách địa điểm" aria-busy={!venues || undefined}>
                        <thead>
                            <tr>
                                <th scope="col">Địa điểm</th><th scope="col">Trạng thái</th><th scope="col">Tiến độ dựng</th>
                                <th scope="col" className="num">Toà nhà</th><th scope="col" className="num">Tầng</th><th scope="col" className="num">Điểm quan tâm</th>
                                <th scope="col"><span className="sr-only">Thao tác</span></th>
                            </tr>
                        </thead>
                        <tbody>
                            {!venues ? <SkeletonRows /> : venues.map(v => {
                                const [label, to] = action(v);
                                return (
                                    <tr key={v.id}>
                                        <td>
                                            <Link to={`/builder/v/${v.id}/buildings`} className="k14 k-b">{v.name}</Link>
                                            <span className="k12 k-m" style={{ display: "block" }}>
                                                {KIND_LABEL[v.kind ?? "other"] ?? v.kind}, {window.location.host}/v/{v.slug}
                                                {v.status === "PUBLISHED" && (
                                                    <span role="img" aria-label="Đường dẫn đã khoá sau lần xuất bản đầu" title="Đường dẫn đã khoá sau lần xuất bản đầu" style={{ display: "inline-flex", verticalAlign: -2, marginLeft: 4 }}>
                                                        <Lc name="lock" size={12} color="var(--muted)" />
                                                    </span>
                                                )}
                                            </span>
                                        </td>
                                        <td><VenueStatus status={v.status} /><span className="k12 k-m kg-sub">{statusNote(v)}</span></td>
                                        <td style={{ width: 160 }}><Progress venue={v} /></td>
                                        <td className="num">{v.buildingCount ?? 0}</td>
                                        <td className="num">{v.floorCount ?? 0}</td>
                                        <td className="num">{v.locationCount ?? 0}</td>
                                        <td><div className="kg-acts"><Button small to={to}>{label}</Button><MoreMenu venue={v} /></div></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </>
    );
}
