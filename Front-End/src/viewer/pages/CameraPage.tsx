import { useEffect, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { angleDiff, type Trip } from "@indoor-map/core";
import { cameraErrorMessage, openRearCamera, stopStream } from "../../lib/camera";
import { useModel, useVenue } from "../VenueContext";
import { useTripEngine } from "../useTripEngine";
import FloorMap from "../components/FloorMap";
import Icon from "../components/Icon";
import { IconButton } from "../components/ui";
import { SensorBar } from "./NavigatePage";

// Chỉ đường bằng camera (AR-lite, giai đoạn 2 — thử nghiệm):
// - hình nền = camera sau
// - mũi tên "nằm trên sàn" chỉ hướng cần đi = hướng đoạn tuyến phía trước − hướng điện thoại (la bàn)
// - vị trí tiến theo bước chân; căn lại bằng mã QR. Chưa có nhận diện cảnh bằng AI.
export default function CameraPage() {
    const { trip, slug } = useVenue();
    if (!trip) return <Navigate to={`/v/${slug}/map`} replace />;
    if (trip.arrived) return <Navigate to={`/v/${slug}/go`} replace />;
    return <CameraNav trip={trip} />;
}

function CameraNav({ trip }: { trip: Trip }) {
    const model = useModel();
    const { slug } = useVenue();
    const engine = useTripEngine(trip);
    const { view } = engine;
    const video = useRef<HTMLVideoElement>(null);
    const [cameraError, setCameraError] = useState<string | null>(null);
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
    const here = view.here;
    const percent = trip.route.distance > 0 ? Math.min(100, (trip.progress / trip.route.distance) * 100) : 100;

    return (
        <div className="wf-screen is-dark">
            <div className="wf-camera is-ar">
                <video ref={video} playsInline muted aria-label="Hình từ camera sau" />
                {cameraError && <div className="wf-camera-error"><Icon name="camera" size={32} /><p>{cameraError}</p></div>}

                {/* Mũi tên trên sàn: xoay theo hướng cần đi so với hướng điện thoại */}
                <div className="wf-ar-floor" aria-hidden="true">
                    {relative != null ? (
                        <div className="wf-ar-arrow" style={{ transform: `rotateX(58deg) rotateZ(${relative}deg)` }}>
                            <svg viewBox="0 0 100 160" width="150" height="240"><polygon points="50,0 100,60 68,60 68,160 32,160 32,60 0,60" /></svg>
                        </div>
                    ) : (
                        <div className="wf-ar-wait">{engine.needPermission ? "Bật la bàn để hiện mũi tên" : "Đang đọc la bàn… xoay nhẹ điện thoại"}</div>
                    )}
                </div>
                {relative != null && <div className="wf-ar-distance">{Math.round(view.toNext)} m</div>}
                {offCourse && <div className="wf-ar-turn">Quay người lại — đường đi ở phía sau</div>}

                <div className="wf-ar-banner">
                    <span className="wf-ar-banner-icon"><Icon name={next?.kind ?? "straight"} size={30} stroke={2.8} /></span>
                    <span className="wf-ar-banner-text"><b>{next ? `${next.title}` : "Đi thẳng"}</b><small>còn {Math.round(view.toNext)} m · {next?.detail}</small></span>
                    <Link to={`/v/${slug}/go`} className="wf-ar-banner-2d" aria-label="Về bản đồ 2D">2D</Link>
                </div>
                <div className="wf-map-badges is-ar"><SensorBar engine={engine} /></div>

                <div className="wf-ar-bottom">
                    <Link to={`/v/${slug}/go`} className="wf-ar-minimap" aria-label="Mở bản đồ 2D">
                        <FloorMap model={model} floorId={here?.floorId ?? trip.route.legs[trip.activeLeg]!.floorId} route={trip.route} activeLeg={trip.activeLeg}
                            user={here} heading={engine.heading} headingUp focus={here ? { lat: here.lat, lng: here.lng, zoom: 19.5 } : "floor"} compact showMarkers={false} />
                    </Link>
                    <div className="wf-ar-controls">
                        <div className="wf-ar-progress">
                            <div><span>{Math.round(trip.progress)} / {trip.route.distance} m</span><span>còn {Math.max(1, Math.round(view.remainingSeconds / 60))} phút</span></div>
                            <div className="wf-progress"><span style={{ width: `${percent}%` }} /></div>
                        </div>
                        <div className="wf-row-actions">
                            <IconButton icon="qr" label="Quét QR để căn lại" to={`/v/${slug}/scan?then=camera`} />
                            <button type="button" className="wf-btn wf-btn-secondary" onClick={() => engine.setSimulating(!engine.simulating)}>
                                {engine.simulating ? "Dừng mô phỏng" : "Mô phỏng"}
                            </button>
                        </div>
                    </div>
                </div>
                <p className="wf-ar-safety">Giữ máy ngang ngực · không nhìn màn hình khi đi thang</p>

                {engine.lost && (snoozeUntil == null || trip.metersSinceFix > snoozeUntil || trip.metersSinceFix < snoozeUntil - 30) && (
                    <div className="wf-lost" role="alertdialog" aria-labelledby="lost-title">
                        <div className="wf-lost-head">
                            <b id="lost-title">Vị trí có thể đã lệch ±{Math.round(engine.uncertainty)} m</b>
                            <small>Đã đi {Math.round(trip.metersSinceFix)} m bằng bước chân kể từ lần định vị cuối. Căn lại để mũi tên chính xác:</small>
                        </div>
                        <Link to={`/v/${slug}/scan?then=camera`} className="wf-choice is-live"><Icon name="qr" size={24} /><span><b>Quét mã QR gần nhất</b><small>Mã dán trên cột, biển chỉ dẫn · chính xác ~1 m</small></span></Link>
                        <Link to={`/v/${slug}/map?pick=position&floor=${here?.floorId ?? ""}&return=camera`} className="wf-choice"><Icon name="target" size={24} /><span><b>Chỉ vị trí trên bản đồ</b><small>Kéo bản đồ tới chỗ bạn đứng</small></span></Link>
                        <button type="button" className="wf-btn wf-btn-secondary is-full" onClick={() => setSnoozeUntil(trip.metersSinceFix + 30)}>Tiếp tục với vị trí hiện tại</button>
                    </div>
                )}
            </div>
        </div>
    );
}
