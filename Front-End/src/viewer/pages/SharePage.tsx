import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import QRCode from "qrcode";
import Lc from "../../design/Lc";
import { useModel, useVenue } from "../VenueContext";
import FloorMap from "../components/FloorMap";
import { Button, ErrorScreen, IconButton, Segmented, Sheet } from "../components/ui";
import { MAP } from "../mapTheme";
import { FromToBar } from "./RoutePage";

// Chia sẻ tuyến (Viewer-Share): link /v/<slug>/shared?den=<id điểm đến>&tu=qr:<mã> | diem:<id>.
// Chỉ gửi điểm trên bản đồ (mã QR hoặc địa điểm), không bao giờ gửi toạ độ thật của khách.
export default function SharePage() {
    const model = useModel();
    const { slug, position, planRoute } = useVenue();
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const to = model.locationsById.get(Number(params.get("to")));
    const fromParam = position?.source === "qr" && position.nodeId ? `qr:${position.nodeId}` : position?.source === "place" && position.placeId ? `diem:${position.placeId}` : null;
    const fromName = position?.source === "qr" ? `điểm QR ${position.nodeId}` : position?.label ?? "";
    const [scope, setScope] = useState<"both" | "dest">(fromParam ? "both" : "dest");
    const [copied, setCopied] = useState(false);
    const [qr, setQr] = useState<string | null>(null);
    const planned = useMemo(() => (position && to ? planRoute(position, to) : null), [position, to, planRoute]);
    const route = planned && !("error" in planned) ? planned : null;

    const url = useMemo(() => {
        if (!to) return "";
        const q = new URLSearchParams({ den: String(to.id) });
        if (scope === "both" && fromParam) q.set("tu", fromParam);
        return `${window.location.origin}/v/${slug}/shared?${q.toString()}`;
    }, [to, scope, fromParam, slug]);

    useEffect(() => {
        if (!url) return;
        let alive = true;
        void QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: MAP.graphite, light: MAP.surface } })
            .then(svg => alive && setQr(svg))
            .catch(() => alive && setQr(null));
        return () => {
            alive = false;
        };
    }, [url]);

    if (!to) {
        return <ErrorScreen status="Không tìm thấy" title="Chưa có tuyến để chia sẻ" back={`/v/${slug}/map`} headerTitle={model.venue.name}
            foot={<Button to={`/v/${slug}/search?pick=to`} icon="search">Chọn điểm đến</Button>} />;
    }

    const close = () => (window.history.length > 1 ? navigate(-1) : navigate(`/v/${slug}/route?to=${to.id}`));
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2500);
        } catch {
            setCopied(false);
        }
    };
    const share = async () => {
        try {
            await navigator.share({ title: `Tuyến tới ${to.name}`, url });
        } catch {
            // người dùng huỷ
        }
    };
    const canShare = typeof navigator.share === "function";
    const leg = route?.legs[0];

    return (
        <div className="wf-screen">
            <div className="wf-maparea" aria-hidden="true">
                <FloorMap model={model} floorId={leg?.floorId ?? to.floorId} route={route} activeLeg={0} user={position} destination={to}
                    focus={leg ? { bounds: leg.points } : { lat: to.lat, lng: to.lng, zoom: 19.5 }} showMarkers={false} compact fitPadding={[104, 32]} />
                <FromToBar model={model} position={position} to={to} slug={slug} back={close} />
            </div>
            <button type="button" className="wf-scrim" aria-label="Đóng" onClick={close} />
            <Sheet over labelledBy="sh-t">
                <div className="wf-sheet-head" style={{ alignItems: "center" }}>
                    <h2 id="sh-t" className="wf-t28">Chia sẻ tuyến đường</h2>
                    <IconButton icon="x" label="Đóng" onClick={close} />
                </div>
                <Segmented label="Gửi những gì" value={scope} onChange={setScope}
                    options={[{ value: "both", label: "Điểm đi và điểm đến", disabled: !fromParam }, { value: "dest", label: "Chỉ điểm đến" }]} />
                <div className="wf-card" style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <Lc name="link" size={20} color="var(--muted)" />
                    <span className="wf-t15" style={{ wordBreak: "break-all", minWidth: 0 }}>{url.replace(/^https?:\/\//, "")}</span>
                </div>
                <p className="wf-t13 wf-status" style={{ fontWeight: 400, alignItems: "flex-start" }}>
                    <Lc name="info" size={20} />
                    {scope === "both" && fromParam
                        ? `Chỉ gửi ${fromName} và ${to.name} trên bản đồ, không gửi vị trí thật của bạn.`
                        : `Chỉ gửi ${to.name}. Người nhận tự chọn điểm đi.${position && !fromParam ? " Vị trí chọn tay trên bản đồ không được gửi." : ""}`}
                </p>
                {qr && (
                    <div style={{ display: "flex", alignItems: "center", gap: 16, borderTop: "1px solid var(--surface-2)", paddingTop: 16 }}>
                        <span className="wf-qr-img" role="img" aria-label="Mã QR của link" dangerouslySetInnerHTML={{ __html: qr }} />
                        <div style={{ minWidth: 0 }}><p className="wf-t17">Cho người bên cạnh quét</p><p className="wf-t13">Mở tuyến này trên máy họ</p></div>
                    </div>
                )}
                <div className="wf-acts">
                    <Button icon={copied ? "check" : "copy"} onClick={() => void copy()}>{copied ? "Đã sao chép" : "Sao chép link"}</Button>
                    {canShare && <Button variant="secondary" square icon="share" label="Chia sẻ qua ứng dụng khác" onClick={() => void share()} />}
                </div>
            </Sheet>
        </div>
    );
}
