import { useMemo, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import Lc from "../../design/Lc";
import { requestSensorPermission, useSensorPermission } from "../../lib/sensors";
import { useModel, useVenue } from "../VenueContext";
import FloorMap from "../components/FloorMap";
import { Button, Row, Segmented, Sheet, Status } from "../components/ui";
import { FromToBar } from "./RoutePage";

const STEPS = {
    iphone: ["Mở Cài đặt, Safari, Nâng cao, Dữ liệu trang web", "Xoá dữ liệu của trang này", "Mở lại link, chọn Cho phép"],
    android: ["Bấm biểu tượng ổ khoá cạnh địa chỉ trang", "Chọn Quyền, bật Cảm biến chuyển động", "Tải lại trang"]
};

// Giải thích trước khi xin quyền cảm biến (Viewer-Permission). iOS bắt buộc xin bằng một cú bấm: requestSensorPermission() trong onClick.
// /v/:slug/permission?to=<id>&then=go|camera
export default function PermissionPage() {
    const model = useModel();
    const { slug, position, planRoute, startTrip } = useVenue();
    const permission = useSensorPermission();
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const to = model.locationsById.get(Number(params.get("to")));
    const then = params.get("then") === "camera" ? "camera" : "go";
    const [os, setOs] = useState<"iphone" | "android">(() => (/android/i.test(navigator.userAgent) ? "android" : "iphone"));
    const [asking, setAsking] = useState(false);
    const planned = useMemo(() => (position && to ? planRoute(position, to) : null), [position, to, planRoute]);
    const route = planned && !("error" in planned) ? planned : null;

    if (!to || !position) return <Navigate to={to ? `/v/${slug}/route?to=${to.id}` : `/v/${slug}/map`} replace />;

    const go = () => {
        const result = startTrip(position, to);
        if (result && !("error" in result)) navigate(`/v/${slug}/${then}`, { replace: true });
        else navigate(`/v/${slug}/route?to=${to.id}`, { replace: true });
    };
    const ask = async () => {
        setAsking(true);
        const state = await requestSensorPermission();
        setAsking(false);
        if (state === "granted") go();
    };
    const leg = route?.legs[0];
    const denied = permission === "denied";

    return (
        <div className="wf-screen">
            <div className="wf-maparea" aria-hidden="true">
                <FloorMap model={model} floorId={leg?.floorId ?? position.floorId} route={route} activeLeg={0} user={position} destination={to}
                    focus={leg ? { bounds: leg.points } : { lat: position.lat, lng: position.lng, zoom: 19.5 }} showMarkers={false} compact fitPadding={[104, 32]} />
                <FromToBar model={model} position={position} to={to} slug={slug} back={() => navigate(`/v/${slug}/route?to=${to.id}`, { replace: true })} />
            </div>
            <div className="wf-scrim" aria-hidden="true" />
            <Sheet over labelledBy="pm-t">
                {denied ? (
                    <>
                        <div>
                            <Status icon="triangle-alert" tone="warn">Chưa có quyền chuyển động</Status>
                            <h2 id="pm-t" className="wf-t28" style={{ marginTop: 8 }}>Bật lại trong trình duyệt</h2>
                        </div>
                        <Segmented label="Loại điện thoại" value={os} onChange={setOs} options={[{ value: "iphone", label: "iPhone" }, { value: "android", label: "Android" }]} />
                        <ol className="wf-t15" style={{ margin: 0, paddingLeft: 24, display: "flex", flexDirection: "column", gap: 8 }}>
                            {STEPS[os].map(s => <li key={s}>{s}</li>)}
                        </ol>
                        <Row title="Vẫn đi được bằng QR" sub="Quét tem ở đầu mỗi chặng để cập nhật vị trí" />
                        <div className="wf-stack">
                            <Button icon="qr-code" onClick={go}>Đi bằng QR</Button>
                            <Button variant="text" onClick={() => void ask()} disabled={asking}>Đã bật, thử lại</Button>
                        </div>
                    </>
                ) : (
                    <>
                        <div>
                            <h2 id="pm-t" className="wf-t28">Cho phép chuyển động và hướng</h2>
                            <p className="wf-t15 wf-muted" style={{ marginTop: 8 }}>Để biết bạn đã đi bao xa giữa các tem QR.</p>
                        </div>
                        <div>
                            <Row title="Chuyển động" sub="Đếm bước chân" />
                            <Row title="Hướng" sub="Xoay bản đồ theo hướng bạn nhìn" />
                            {then === "camera" && <Row title="Camera" sub="Trình duyệt sẽ hỏi riêng khi mở camera" />}
                        </div>
                        <p className="wf-t13 wf-status" style={{ fontWeight: 400 }}><Lc name="lock" size={20} />Xử lý trên máy, không lưu, không gửi đi</p>
                        <div className="wf-stack">
                            <Button onClick={() => void ask()} disabled={asking}>Cho phép</Button>
                            <Button variant="text" onClick={go}>Để sau, chỉ dùng QR</Button>
                        </div>
                    </>
                )}
            </Sheet>
        </div>
    );
}
