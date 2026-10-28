import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import QRCode from "qrcode";
import { analyzeVenue } from "@indoor-map/core";
import { venueApi } from "../../console/api";
import { HeaderActions } from "../../console/Shell";
import { Button, NotYet, useAction, useFeedback } from "../../console/ui";
import Lc from "../../design/Lc";
import { GuestLink } from "../FloorList";
import { useWorkspace } from "../Workspace";
import "./workspace.css";

type Level = "block" | "warn" | "ok";
interface Check {
    level: Level;
    title: string;
    detail: string;
    to: string;
}

// Xuất bản: kiểm tra bản nháp (tính ngay trên trình duyệt), xuất bản, gỡ xuất bản, mã QR vào bản đồ.
export default function PublishPage() {
    const { venueId, data, model, patch } = useWorkspace();
    const { confirm, toast } = useFeedback();
    const { busy, run } = useAction();
    const report = useMemo(() => analyzeVenue(model), [model]);
    const [qr, setQr] = useState<string | null>(null);
    const url = `${window.location.origin}/v/${data.venue.slug}`;
    const status = data.venue.status;

    useEffect(() => {
        void QRCode.toString(url, { type: "svg", margin: 1 }).then(setQr);
    }, [url]);

    const total = model.locations.length;
    const unreachable = report.unreachable.length + report.isolated.length;
    const base = `/builder/v/${venueId}`;
    const checks: Check[] = [
        model.floors.length === 0
            ? { level: "block", title: "Chưa có tầng nào", detail: "Thêm toà nhà và tầng trước khi xuất bản", to: `${base}/buildings` }
            : report.floorsWithoutPlan.length
                ? { level: "warn", title: `${report.floorsWithoutPlan.length} tầng thiếu mặt bằng`, detail: "Khách thấy điểm trên nền trống ở các tầng đó", to: `${base}/plan?floor=${report.floorsWithoutPlan[0]}` }
                : { level: "ok", title: "Mặt bằng mỗi tầng", detail: "", to: `${base}/plan` },
        total === 0
            ? { level: "block", title: "Chưa có điểm quan tâm nào", detail: "Khách không tìm được gì", to: `${base}/editor` }
            : { level: "ok", title: "Có điểm để tìm", detail: "", to: `${base}/editor` },
        !report.nodes
            ? { level: "block", title: "Chưa có lối đi", detail: "Không chỉ đường được tới điểm nào", to: `${base}/walkways` }
            : unreachable
                ? { level: unreachable / Math.max(total, 1) > 0.1 ? "block" : "warn", title: `${unreachable} điểm không tới được`, detail: "Sẽ không được chỉ đường tới các điểm này", to: `${base}/walkways` }
                : { level: "ok", title: "Mọi điểm tới được", detail: "", to: `${base}/walkways` },
        report.looseConnectors.length
            ? { level: "warn", title: `${report.looseConnectors.length} thang chưa nối tầng`, detail: "Khách không đổi tầng được ở các thang này", to: `${base}/walkways` }
            : { level: "ok", title: "Thang nối tầng", detail: "", to: `${base}/walkways` },
        data.venue.description && data.venue.outline?.length
            ? { level: "ok", title: "Thông tin địa điểm", detail: "", to: `${base}/settings` }
            : { level: "warn", title: "Thiếu thông tin địa điểm", detail: `${data.venue.description ? "" : "Thiếu mô tả. "}${data.venue.outline?.length ? "" : "Thiếu vùng bao, bản đồ chọn địa điểm chỉ hiện một chấm."}`.trim(), to: `${base}/settings` }
    ];
    const blocks = checks.filter(c => c.level === "block");
    const warns = checks.filter(c => c.level === "warn");
    const oks = checks.filter(c => c.level === "ok");

    const publish = async (force = false) => {
        if (force && !(await confirm("Vẫn xuất bản khi còn mục chặn?", { detail: "Khách sẽ gặp chỗ không tìm được đường hoặc tầng trống.", okLabel: "Vẫn xuất bản" }))) return;
        const saved = await run(() => venueApi.publish(venueId), "Đã xuất bản, khách xem được ngay");
        if (saved) patch("venue", { ...data.venue, ...saved });
    };
    const unpublish = async () => {
        if (!(await confirm(`Gỡ xuất bản ${data.venue.name}?`, { danger: true, okLabel: "Gỡ xuất bản", detail: "Đường dẫn và mã QR đã in sẽ báo không tìm thấy cho tới khi xuất bản lại." }))) return;
        const saved = await run(() => venueApi.unpublish(venueId), "Đã gỡ xuất bản");
        if (saved) patch("venue", { ...data.venue, ...saved });
    };
    const downloadPng = async () => {
        const href = await QRCode.toDataURL(url, { margin: 2, width: 1024 });
        const a = document.createElement("a");
        a.href = href;
        a.download = `qr-${data.venue.slug}.png`;
        a.click();
    };
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(url);
            toast("Đã sao chép đường dẫn");
        } catch {
            toast("Không sao chép được, hãy chọn và sao chép tay", "err");
        }
    };

    const group = (label: string, list: Check[], color: string) => list.length > 0 && (
        <tbody>
            <tr className="ws-tbl-grp"><th colSpan={2} scope="colgroup" style={{ color }}>{label} {list.length}</th></tr>
            {list.map(c => (
                <tr key={c.title}>
                    <td><div className="k-b">{c.title}</div>{c.detail && <div className="k12 k-m">{c.detail}</div>}</td>
                    <td className="is-act"><Link to={c.to} className="k-btn t sm">Sửa</Link></td>
                </tr>
            ))}
        </tbody>
    );

    return (
        <div className="k-page">
            <HeaderActions><GuestLink venue={data.venue} /></HeaderActions>
            <h1 className="k24">Xuất bản</h1>
            <div className="ws-split is-aside">
                <div className="k-stack" style={{ gap: 24, minWidth: 0 }}>
                    <section aria-labelledby="dr-t" className="k-card">
                        <div className="k-line" style={{ gap: 16, flexWrap: "wrap" }}>
                            <div style={{ minWidth: 0 }}>
                                <h2 id="dr-t" className="k16">{status === "PUBLISHED" ? "Đang công khai" : status === "HIDDEN" ? "Bị ẩn" : "Bản nháp"}</h2>
                                <div className="k14 k-m">{status === "PUBLISHED" ? "Chỉnh sửa hiện cho khách ngay khi lưu." : "Khách chưa xem được bản đồ này."}</div>
                            </div>
                            <div className="k-line ws-right">
                                <Button to={`${base}/diff`}>Xem khác biệt</Button>
                                {status !== "PUBLISHED" && (
                                    <Button variant="primary" busy={busy} disabled={status === "HIDDEN" || blocks.length > 0} title={blocks.length ? "Còn mục chặn" : undefined} onClick={() => void publish()}>Xuất bản</Button>
                                )}
                            </div>
                        </div>
                        <div className="k-grid4">
                            <Stat n={model.buildings.length} label="toà nhà" />
                            <Stat n={model.floors.length} label="tầng" />
                            <Stat n={total.toLocaleString("vi-VN")} label="điểm" />
                            <Stat n={`${Math.round(report.meters).toLocaleString("vi-VN")} m`} label="lối đi" />
                        </div>
                        {status !== "PUBLISHED" && (
                            <div style={{ borderTop: "1px solid var(--rule)", paddingTop: 16 }}>
                                {status === "HIDDEN" ? (
                                    <div className="k-line k14 k-danger"><Lc name="eye-off" size={16} />Địa điểm đang bị quản trị hệ thống ẩn.</div>
                                ) : blocks.length ? (
                                    <div className="k-line k14 k-danger">
                                        <Lc name="circle-alert" size={16} /><span>Còn {blocks.length} mục chặn, chưa xuất bản được.</span>
                                        <button type="button" className="k-btn t sm ws-right" style={{ marginRight: -12 }} onClick={() => void publish(true)}>Vẫn xuất bản…</button>
                                    </div>
                                ) : <div className="k-line k14 k-ok"><Lc name="circle-check" size={16} />Sẵn sàng xuất bản.</div>}
                            </div>
                        )}
                    </section>

                    <section aria-labelledby="ck-t" className="k-card ws-card0">
                        <div className="ws-cardhead">
                            <h2 id="ck-t" className="k16">Kiểm tra bản nháp</h2>
                            <span className="k12 k-m ws-right">
                                {blocks.length > 0 && <span className="k-danger k-b">{blocks.length} chặn, </span>}
                                {warns.length > 0 && <span className="k-warn k-b">{warns.length} cảnh báo, </span>}
                                {oks.length} đạt
                            </span>
                        </div>
                        <table className="k-tbl">
                            {group("Chặn", blocks, "var(--danger)")}
                            {group("Cảnh báo", warns, "var(--warn)")}
                        </table>
                        {oks.length > 0 && (
                            <div className="ws-cardfoot k12 k-m"><Lc name="check" size={16} color="var(--ok)" />{oks.length} mục đạt: {oks.map(c => c.title.toLowerCase()).join(", ")}</div>
                        )}
                    </section>
                </div>

                <aside className="k-stack" style={{ gap: 24 }}>
                    {status === "HIDDEN" ? (
                        <section aria-labelledby="sth-t" className="k-card">
                            <div className="k-line"><h2 id="sth-t" className="k16">Bản công khai</h2><span className="k-badge k-danger ws-right"><Lc name="eye-off" size={14} />Bị ẩn</span></div>
                            <div className="k-note" role="status"><Lc name="eye-off" size={16} color="var(--danger)" /><div><b className="k-b">Quản trị hệ thống đã ẩn địa điểm này.</b></div></div>
                            <p className="k14 k-m">Khách không mở được bản đồ. Bạn vẫn sửa bản nháp được.</p>
                        </section>
                    ) : (
                        <section aria-labelledby="st-t" className="k-card">
                            <div className="k-line"><h2 id="st-t" className="k16">Bản công khai</h2>
                                {status === "PUBLISHED" ? <span className="k-badge k-ok ws-right"><Lc name="circle-check" size={14} />Đang công khai</span> : <span className="k12 k-m ws-right">Chưa công khai</span>}
                            </div>
                            <div className="k-line" style={{ gap: 16 }}>
                                <div className="ws-qrsvg" style={{ padding: 8, border: "1px solid var(--rule)", borderRadius: 6, width: 104, height: 104, flexShrink: 0 }}
                                    dangerouslySetInnerHTML={qr ? { __html: qr } : undefined} />
                                <div style={{ minWidth: 0 }}>
                                    <div className="k12 k-m">Mã QR vào bản đồ</div>
                                    <div className="k14 k-b" style={{ wordBreak: "break-all" }}>{url.replace(/^https?:\/\//, "")}</div>
                                </div>
                            </div>
                            <div className="k-grid2" style={{ gap: 8 }}>
                                <button type="button" className="k-btn sm" onClick={() => void downloadPng()}><Lc name="download" size={16} />Tải PNG</button>
                                <button type="button" className="k-btn sm" onClick={() => void copy()}><Lc name="copy" size={16} />Sao chép</button>
                            </div>
                            <p className="k12 k-m">Mã này chỉ mở bản đồ. Mã biết khách đứng đâu nằm ở <Link to={`${base}/qr`} className="k-link">Mã QR định vị</Link>.</p>
                            {status === "PUBLISHED" && (
                                <div style={{ borderTop: "1px solid var(--rule)", paddingTop: 8 }}>
                                    <button type="button" className="k-btn d sm" style={{ marginLeft: -12 }} disabled={busy} onClick={() => void unpublish()}>Gỡ xuất bản…</button>
                                </div>
                            )}
                        </section>
                    )}
                    <section aria-labelledby="hi-t" className="k-card ws-card0">
                        <div className="ws-cardhead"><h2 id="hi-t" className="k16">Lịch sử phát hành</h2></div>
                        <div style={{ padding: 16 }}>
                            <NotYet>Backend chưa lưu phiên bản: chưa xem lại hay khôi phục được bản cũ.{data.venue.updatedAt ? ` Lần lưu gần nhất ${new Date(data.venue.updatedAt).toLocaleString("vi-VN")}.` : ""}</NotYet>
                        </div>
                    </section>
                </aside>
            </div>
        </div>
    );
}

function Stat({ n, label }: { n: number | string; label: string }) {
    return <div className="k-kpi"><span className="k28">{n}</span><span className="k12 k-m">{label}</span></div>;
}
