import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import QRCode from "qrcode";
import { analyzeVenue } from "@indoor-map/core";
import { venueApi } from "../../console/api";
import { Button, Card, NotYet, PageHead, Status, useAction, useFeedback, type StatusKind } from "../../console/ui";
import { useWorkspace } from "../Workspace";
import { VenueStatus } from "./VenuesPage";

interface Check {
    kind: StatusKind;
    title: string;
    detail: string;
    to: string;
}

// Xuất bản: danh sách kiểm tra trước khi xuất bản (tính ngay trên bản nháp), bật/tắt hiển thị cho khách.
export default function PublishPage() {
    const { venueId, data, model, patch } = useWorkspace();
    const { confirm } = useFeedback();
    const { busy, run } = useAction();
    const report = useMemo(() => analyzeVenue(model), [model]);
    const [qr, setQr] = useState<string | null>(null);
    const url = `${window.location.origin}/v/${data.venue.slug}`;

    useEffect(() => {
        void QRCode.toString(url, { type: "svg", margin: 1 }).then(setQr);
    }, [url]);

    const total = model.locations.length;
    const reachable = total - report.unreachable.length - report.isolated.length;
    const base = `/builder/v/${venueId}`;
    const checks: Check[] = [
        {
            kind: model.floors.length === 0 ? "err" : report.floorsWithoutPlan.length ? "warn" : "ok",
            title: "Mặt bằng đã căn chỉnh cho mọi tầng",
            detail: model.floors.length === 0 ? "Chưa có tầng nào." : report.floorsWithoutPlan.length ? `${report.floorsWithoutPlan.length}/${model.floors.length} tầng chưa có mặt bằng hoặc chưa chấm mốc — khách chỉ thấy nền bản đồ ngoài trời ở các tầng đó.` : `${model.floors.length}/${model.floors.length} tầng.`,
            to: `${base}/plan`
        },
        {
            kind: total === 0 ? "err" : "ok",
            title: "Có địa điểm để tìm",
            detail: total === 0 ? "Chưa có điểm quan tâm nào." : `${total} địa điểm · ${data.types.length} loại.`,
            to: `${base}/editor`
        },
        {
            kind: total === 0 ? "mut" : reachable === total ? "ok" : reachable / total >= 0.9 ? "warn" : "err",
            title: "Địa điểm tới được bằng lối đi",
            detail: total ? `${reachable}/${total} (${Math.round((reachable / total) * 100)}%) · ${report.unreachable.length} không có lối đi trong 60 m · ${report.isolated.length} nối vào mảnh rời.` : "—",
            to: `${base}/walkways`
        },
        {
            kind: report.looseConnectors.length ? "warn" : report.nodes ? "ok" : "err",
            title: "Thang nối tầng",
            detail: report.nodes ? (report.looseConnectors.length ? `${report.looseConnectors.length} nút thang chưa nối sang tầng khác.` : "Mọi nút thang đã nối tầng.") : "Chưa có lối đi.",
            to: `${base}/walkways`
        },
        {
            kind: data.venue.description && data.venue.outline?.length ? "ok" : "warn",
            title: "Thông tin địa điểm",
            detail: `${data.venue.description ? "Có mô tả" : "Thiếu mô tả"} · ${data.venue.outline?.length ? "có vùng bao" : "thiếu vùng bao (bản đồ chọn địa điểm sẽ chỉ hiện một điểm)"}.`,
            to: `${base}/buildings`
        }
    ];
    const blocking = checks.some(c => c.kind === "err");
    const status = data.venue.status;

    const publish = async () => {
        if (blocking && !(await confirm("Vẫn xuất bản khi còn lỗi?", { detail: "Khách sẽ gặp chỗ không tìm được đường hoặc tầng trống." }))) return;
        const saved = await run(() => venueApi.publish(venueId), "Đã xuất bản — khách xem được ngay");
        if (saved) patch("venue", { ...data.venue, ...saved });
    };
    const unpublish = async () => {
        if (!(await confirm("Tạm ẩn với khách?", { okLabel: "Tạm ẩn", detail: "Đường dẫn và mã QR đã in sẽ báo “không tìm thấy” cho tới khi xuất bản lại." }))) return;
        const saved = await run(() => venueApi.unpublish(venueId), "Đã chuyển về bản nháp");
        if (saved) patch("venue", { ...data.venue, ...saved });
    };

    return (
        <div className="cb-main" style={{ maxWidth: 1240 }}>
            <PageHead title="Xuất bản" sub={<>Khi xuất bản, khách thấy bản đồ tại <span className="cb-mono">{url.replace(/^https?:\/\//, "")}</span>. Mọi chỉnh sửa trong trình biên tập hiện cho khách ngay (chưa có bản nháp tách riêng).</>}
                actions={<>
                    {status === "PUBLISHED" && <a className="cb-btn" href={`/v/${data.venue.slug}`} target="_blank" rel="noreferrer">Xem như khách</a>}
                    {status === "PUBLISHED"
                        ? <Button variant="danger" busy={busy} onClick={() => void unpublish()}>Tạm ẩn với khách</Button>
                        : <Button variant="primary" busy={busy} disabled={status === "HIDDEN"} onClick={() => void publish()}>Xuất bản</Button>}
                </>} />
            {status === "HIDDEN" && <div className="cb-alert is-err"><i className="bi bi-x-circle" aria-hidden="true" /><span>Địa điểm đang bị quản trị hệ thống ẩn. Liên hệ quản trị hệ thống để được xem xét lại.</span></div>}
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 360px", gap: 20, alignItems: "start" }}>
                <div className="cb-stack">
                    <Card title="Kiểm tra trước khi xuất bản" pad={false}>
                        <ul style={{ listStyle: "none", margin: 0, padding: "4px 18px" }}>
                            {checks.map(c => (
                                <li key={c.title} style={{ display: "flex", gap: 12, padding: "12px 0", borderBottom: "1px solid #E4E7EC", alignItems: "flex-start" }}>
                                    <span style={{ paddingTop: 2 }}><Status kind={c.kind}>{""}</Status></span>
                                    <div style={{ flex: 1 }}><div style={{ fontWeight: 500 }}>{c.title}</div><div className="cb-muted">{c.detail}</div></div>
                                    <Link to={c.to} style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap" }}>Sửa →</Link>
                                </li>
                            ))}
                        </ul>
                    </Card>
                    <NotYet title="Lịch sử phiên bản & ghi chú xuất bản">Backend chưa lưu phiên bản; hiện mỗi lần lưu là cập nhật trực tiếp. Sẽ thêm khi có API phiên bản (khôi phục bản cũ, ghi chú thay đổi).</NotYet>
                </div>
                <div className="cb-stack">
                    <Card title="Trạng thái" actions={<VenueStatus status={status} />}>
                        <div className="cb-kv">
                            <span>Đường dẫn</span><span className="cb-mono">/v/{data.venue.slug}</span>
                            <span>Toà nhà · tầng</span><span>{model.buildings.length} · {model.floors.length}</span>
                            <span>Địa điểm</span><span>{total}</span>
                            <span>Lối đi</span><span>{report.nodes} nút · {Math.round(report.meters)} m</span>
                            <span>Cập nhật</span><span>{data.venue.updatedAt ? new Date(data.venue.updatedAt).toLocaleString("vi-VN") : "—"}</span>
                        </div>
                    </Card>
                    <Card title="Mã QR vào bản đồ">
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textAlign: "center" }}>
                            {qr && <span style={{ width: 150, height: 150, display: "block" }} dangerouslySetInnerHTML={{ __html: qr }} />}
                            <span className="cb-mono">{url.replace(/^https?:\/\//, "")}</span>
                            <p className="cb-muted">Dán ở lối vào, bảng thông tin. Khác mã QR định vị: mã này chỉ mở bản đồ, không biết khách đứng ở đâu.</p>
                            <div className="cb-actions">
                                <Button small onClick={() => void navigator.clipboard?.writeText(url)}>Sao chép link</Button>
                                <Button small to={`${base}/qr`}>Mã QR định vị →</Button>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
