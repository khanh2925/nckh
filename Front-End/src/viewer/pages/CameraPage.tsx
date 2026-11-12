import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { angleDiff, positionUncertainty, type Trip } from "@indoor-map/core";
import Lc from "../../design/Lc";
import { cameraErrorMessage, openRearCamera, stopStream } from "../../lib/camera";
import { useModel, useVenue } from "../VenueContext";
import FloorMap from "../components/FloorMap";
import { useTripEngine } from "../useTripEngine";
import { Button, Hud, IconButton, Progress, Row, Sheet } from "../components/ui";
import { clean, minutesOf, stepIcon } from "../format";
import { TripMenu, TripStatusChip } from "./NavigatePage";

// Chỉ đường bằng camera (AR-lite, thử nghiệm):
// - hình nền = camera sau; mũi tên đặc "nằm trên sàn" = hướng đoạn tuyến phía trước − hướng điện thoại (la bàn),
//   kèm số mét tới lượt kế tiếp; góc dưới có bản đồ nhỏ xoay theo hướng đi (bấm để về 2D)
// - vị trí tiến theo bước chân; căn lại bằng mã QR. Chưa có nhận diện cảnh (ghi rõ "Chưa khả dụng").
export default function CameraPage() {
    const { trip, slug } = useVenue();
    if (!trip) return <Navigate to={`/v/${slug}/map`} replace />;
    if (trip.arrived) return <Navigate to={`/v/${slug}/go`} replace />;
    return <CameraNav trip={trip} />;
}

function CameraNav({ trip }: { trip: Trip }) {
    const { slug } = useVenue();
    const model = useModel();
    const navigate = useNavigate();
    const engine = useTripEngine(trip);
    const { view } = engine;
    const video = useRef<HTMLVideoElement>(null);
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [menu, setMenu] = useState(false);
    // Bỏ qua cảnh báo lệch vị trí thì 30 m nữa mới hiện lại (hoặc khi được định vị lại)
    const [snoozeUntil, setSnoozeUntil] = useState<number | null>(null);

    useEffect(() => {
        let stream: MediaStream | null = null;
        let alive = true;
        openRearCamera()
            .then(s => {
                if (!alive) return stopStream(s);
                stream = s;
                if (video.current) {
                    video.current.srcObject = s;
                    void video.current.play().catch(() => undefined);
                }
            })
            .catch(err => alive && setCameraError(cameraErrorMessage(err)));
        return () => {
            alive = false;
            stopStream(stream);
        };
    }, []);

    if (view.atFloorChange) return <Navigate to={`/v/${slug}/go`} replace />;

    const relative = engine.heading != null && engine.routeBearing != null ? angleDiff(engine.routeBearing, engine.heading) : null;
    const offCourse = relative != null && Math.abs(relative) > 100;
    const next = view.next;
    const percent = trip.route.distance > 0 ? (trip.progress / trip.route.distance) * 100 : 100;
    const lost = engine.lost && (snoozeUntil == null || trip.metersSinceFix > snoozeUntil || trip.metersSinceFix < snoozeUntil - 30);
    const fixLabel = trip.lastFixSource === "qr" ? `QR ${trip.from.nodeId ?? ""}`.trim() : clean(trip.from.label) || "chọn trên bản đồ";
    const here = view.here;

    return (
        <div className="wf-screen wf-dark">
            <div className="wf-camera">
                <video ref={video} playsInline muted aria-label="Hình từ camera sau" />
                {cameraError && (
                    <div className="wf-cam-msg">
                        <div className="wf-card is-white" role="alert" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            <Lc name="camera-off" size={24} />
                            <p className="wf-t17">Chưa mở được camera</p>
                            <p className="wf-t15 wf-muted">{cameraError}</p>
                        </div>
                    </div>
                )}

                {!lost && (
                    <div className="wf-ar-floor" aria-hidden="true">
                        {relative != null && (
                            <div className="wf-ar-arrow" style={{ transform: `rotateX(58deg) rotateZ(${relative}deg)` }}>
                                <svg viewBox="0 0 100 160" width="150" height="240">
                                    <polygon points="50,4 96,60 66,60 66,156 34,156 34,60 4,60" fill="currentColor" stroke="#fff" strokeWidth="5" strokeLinejoin="round" />
                                </svg>
                            </div>
                        )}
                        {relative != null && <span className="wf-ar-dist">{Math.round(view.toNext)} m</span>}
                    </div>
                )}
                {!lost && (
                    <Link to={`/v/${slug}/go`} replace className="wf-ar-mini" aria-label="Về bản đồ 2D">
                        <FloorMap model={model} floorId={here?.floorId ?? trip.route.legs[trip.activeLeg]!.floorId} route={trip.route} activeLeg={trip.activeLeg}
                            user={here} heading={engine.heading} headingUp={engine.heading != null} compact showMarkers={false}
                            focus={here ? { lat: here.lat, lng: here.lng, zoom: 20, follow: true } : "floor"} />
                    </Link>
                )}

                {lost ? (
                    <Hud glyph="triangle-alert" num={`±${Math.round(engine.uncertainty)}`} unit="m" text="Vị trí có thể đã lệch" sub={`Định vị cuối: ${fixLabel}`} />
                ) : (
                    <Hud glyph={stepIcon(next?.kind)} num={Math.round(view.toNext)} unit="m" text={next?.title ?? "Đi thẳng"} />
                )}
                {!lost && (
                    <div className="wf-float-chip" style={{ top: 136, maxWidth: "calc(100% - 32px)" }}><TripStatusChip engine={engine} slug={slug} then="camera" prefix="Thử nghiệm" /></div>
                )}
                {!lost && (
                    <div className="wf-ar-tip">
                        {offCourse ? <span className="wf-pill is-light" role="status"><Lc name="undo-2" size={20} />Quay người lại, đường đi ở phía sau</span>
                            : relative == null ? (
                                engine.needPermission
                                    ? <button type="button" className="wf-pill is-light" style={{ border: 0, cursor: "pointer" }} onClick={() => void engine.enableSensors()}><Lc name="compass" size={20} />Bật la bàn để hiện mũi tên</button>
                                    : <span className="wf-pill" role="status">Đang đọc la bàn, xoay nhẹ điện thoại</span>
                            ) : <span className="wf-pill">Giữ máy ngang ngực, nhìn đường khi đi</span>}
                    </div>
                )}
            </div>

            {lost ? (
                <Sheet labelledBy="lost-t">
                    <div className="wf-sheet-head" style={{ alignItems: "center" }}>
                        <h2 id="lost-t" className="wf-t28">Lấy lại vị trí</h2>
                        <IconButton icon="ellipsis" label="Thêm" popup="menu" onClick={() => setMenu(true)} />
                    </div>
                    <div>
                        <Row title={<>Quét mã QR <span className="wf-t15 wf-ok" style={{ marginLeft: 8 }}>Chính xác nhất</span></>} sub={`Mã dán trên cột, biển chỉ dẫn, ±${positionUncertainty(0, "qr")} m`}
                            to={`/v/${slug}/scan?then=camera`} chevron />
                        <Row title="Chọn chỗ đứng trên bản đồ" sub={`Khá chính xác, ±${positionUncertainty(0, "pick")} m ước tính`}
                            to={`/v/${slug}/map?pick=position&floor=${here?.floorId ?? ""}&return=camera`} chevron />
                        <Row title="Nhận diện mốc" off trailing={<span className="wf-t13">Chưa khả dụng</span>} />
                    </div>
                    <div className="wf-stack">
                        <Button variant="secondary" icon="map" to={`/v/${slug}/go`} replace>Về 2D</Button>
                        <Button variant="text" onClick={() => setSnoozeUntil(trip.metersSinceFix + 30)}>Tiếp tục với vị trí hiện tại</Button>
                    </div>
                </Sheet>
            ) : (
                <Sheet label="Tiến trình">
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                        <span className="wf-t28">{minutesOf(view.remainingSeconds)} phút</span>
                        <span className="wf-t15 wf-muted">{Math.round(trip.progress)} / {Math.round(trip.route.distance)} m, tới {trip.to.name}</span>
                    </div>
                    <div>
                        <Progress percent={percent} label="Đã đi" />
                        {next?.detail && <p className="wf-t13" style={{ marginTop: 8 }}>{clean(next.detail)}</p>}
                    </div>
                    <div className="wf-acts">
                        <Button variant="secondary" icon="map" onClick={() => navigate(`/v/${slug}/go`, { replace: true })}>Về 2D</Button>
                        <Button variant="secondary" icon="scan-line" to={`/v/${slug}/scan?then=camera`}>Quét QR</Button>
                        <Button variant="secondary" square icon="ellipsis" label="Thêm" onClick={() => setMenu(true)} />
                    </div>
                </Sheet>
            )}
            <TripMenu engine={engine} open={menu} onClose={() => setMenu(false)} showSimulate />
        </div>
    );
}
