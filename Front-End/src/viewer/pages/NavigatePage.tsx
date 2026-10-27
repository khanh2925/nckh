import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { formatMeters, type Trip } from "@indoor-map/core";
import { useModel, useVenue } from "../VenueContext";
import { useTripEngine, canSimulateByDefault, type TripEngine } from "../useTripEngine";
import FloorMap from "../components/FloorMap";
import Icon from "../components/Icon";
import { Button, IconButton } from "../components/ui";

// Đang đi (2D): banner lượt rẽ kế tiếp, bản đồ theo hướng đi, tiến độ.
// Tới chỗ thang: màn Chuyển tầng. Tới nơi: màn Đã đến.
export default function NavigatePage() {
    const { trip, slug } = useVenue();
    if (!trip) return <Navigate to={`/v/${slug}/map`} replace />;
    return <Navigating trip={trip} />;
}

function Navigating({ trip }: { trip: Trip }) {
    const engine = useTripEngine(trip);
    if (trip.arrived) return <Arrived trip={trip} />;
    if (engine.view.atFloorChange) return <FloorChange engine={engine} />;
    return <TwoD engine={engine} />;
}

export function SensorBar({ engine }: { engine: TripEngine }) {
    if (engine.needPermission && !engine.simulating) {
        return (
            <button type="button" className="wf-sensor-bar is-action" onClick={() => void engine.enableSensors()}>
                <Icon name="compass" size={16} />Bật la bàn &amp; đếm bước chân
            </button>
        );
    }
    return (
        <div className="wf-sensor-bar">
            <span className={`wf-dot${engine.lost ? " is-warn" : ""}`} />
            {engine.simulating
                ? "Mô phỏng đi bộ 1,3 m/s"
                : `Định vị: ${engine.trip.lastFixSource === "qr" ? "QR" : engine.trip.lastFixSource === "pick" ? "chọn tay" : "địa điểm"}${engine.stepsLive ? ` + bước chân · ${engine.steps} bước` : ""} · ±${Math.round(engine.uncertainty)} m`}
        </div>
    );
}

function TwoD({ engine }: { engine: TripEngine }) {
    const model = useModel();
    const { slug, endTrip } = useVenue();
    const navigate = useNavigate();
    const { trip, view } = engine;
    const [headingUp, setHeadingUp] = useState(true);
    const next = view.next;
    const here = view.here;
    const floorId = here?.floorId ?? trip.route.legs[trip.activeLeg]!.floorId;
    const percent = trip.route.distance > 0 ? Math.min(100, (trip.progress / trip.route.distance) * 100) : 100;

    return (
        <div className="wf-screen">
            <div className="wf-turn-banner" aria-live="polite">
                <div className="wf-turn-icon">
                    <Icon name={next?.kind ?? "straight"} size={40} stroke={2.8} />
                    <span>{next?.kind === "arrive" ? "ĐẾN NƠI" : next?.kind?.startsWith("floor") ? "ĐỔI TẦNG" : next ? next.title.split(" tại ")[0]!.toUpperCase() : "ĐI THẲNG"}</span>
                </div>
                <div className="wf-turn-text">
                    <div className="wf-turn-dist">{Math.round(view.toNext)} <small>m</small></div>
                    <div className="wf-turn-title">{next?.title.includes(" tại ") ? `tại ${next.title.split(" tại ")[1]}` : next?.title}</div>
                    <div className="wf-turn-detail">{next?.detail}</div>
                </div>
                <Link to={`/v/${slug}/route?to=${trip.to.id}`} className="wf-turn-more" aria-label="Xem tất cả các bước"><Icon name="list" /></Link>
            </div>

            <div className="wf-map-area">
                <FloorMap model={model} floorId={floorId} route={trip.route} activeLeg={trip.activeLeg} destination={trip.to}
                    user={here} heading={engine.heading} headingUp={headingUp && engine.heading != null}
                    focus={here ? { lat: here.lat, lng: here.lng, zoom: 20 } : "floor"} />
                <div className="wf-map-badges">
                    <SensorBar engine={engine} />
                    {engine.lost && (
                        <Link to={`/v/${slug}/scan?then=go`} className="wf-sensor-bar is-warn">Vị trí có thể đã lệch — quét QR để căn lại</Link>
                    )}
                </div>
                <div className="wf-map-tools is-right is-top">
                    <IconButton icon="compass" label={headingUp ? "Bản đồ theo hướng Bắc" : "Bản đồ theo hướng đi"} onClick={() => setHeadingUp(h => !h)}
                        variant={headingUp ? "is-ink" : ""} />
                </div>
                <div className="wf-map-tools is-right">
                    <IconButton icon="qr" label="Định vị lại bằng mã QR" to={`/v/${slug}/scan?then=go`} size={48} />
                    <IconButton icon="camera" label="Chỉ đường bằng camera" to={`/v/${slug}/camera`} variant="is-live" size={48} />
                </div>
                <div className="wf-floor-tag">{model.floorsById.get(floorId)?.buildingCode} · {model.floorsById.get(floorId)?.name.split(" · ")[0]}</div>
            </div>

            <div className="wf-sheet">
                <div className="wf-progress-text">
                    <span>Đã đi <b>{Math.round(trip.progress)} m</b> / {trip.route.distance} m</span>
                    <span>còn <b>{Math.max(1, Math.round(view.remainingSeconds / 60))} phút</b> · {trip.to.name}</span>
                </div>
                <div className="wf-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)}><span style={{ width: `${percent}%` }} /></div>
                <div className="wf-row-actions">
                    <Button variant="secondary" full={false} onClick={() => { endTrip(); navigate(`/v/${slug}/place/${trip.to.id}`, { replace: true }); }}>Kết thúc</Button>
                    {engine.simulating || canSimulateByDefault || !engine.stepsLive ? (
                        <Button icon={engine.simulating ? "close" : "walk"} onClick={() => engine.setSimulating(!engine.simulating)}>
                            {engine.simulating ? "Dừng mô phỏng" : "Mô phỏng đi bộ"}
                        </Button>
                    ) : (
                        <Button icon="walk" variant="secondary" onClick={() => engine.trip && navigate(`/v/${slug}/map?pick=position&floor=${floorId}&return=go`)}>
                            Tôi không ở đây
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}

function FloorChange({ engine }: { engine: TripEngine }) {
    const model = useModel();
    const { slug, confirmFloorChange } = useVenue();
    const { trip, view } = engine;
    const step = view.step;
    const leg = trip.route.legs[trip.activeLeg]!;
    const nextLeg = trip.route.legs[trip.activeLeg + 1];
    const fromFloor = model.floorsById.get(leg.floorId);
    const toFloor = nextLeg ? model.floorsById.get(nextLeg.floorId) : undefined;
    const end = leg.points[leg.points.length - 1]!;
    const up = step?.kind === "floor-up";
    const lift = model.locations
        .filter(l => l.floorId === leg.floorId && l.type === "elevator")
        .map(l => ({ l, d: Math.hypot(l.lat - end.lat, l.lng - end.lng) * 111_000 }))
        .sort((a, b) => a.d - b.d)[0];

    return (
        <div className="wf-screen">
            <header className="wf-topbar">
                <IconButton icon="back" label="Về bản đồ" to={`/v/${slug}/route?to=${trip.to.id}`} />
                <div className="wf-topbar-text">
                    <div className="wf-kicker">CHẶNG {trip.activeLeg + 1} → {trip.activeLeg + 2} · {trip.to.name.toUpperCase()}</div>
                    <h1 className="wf-title">Chuyển tầng</h1>
                </div>
            </header>
            <div className="wf-route-map is-short">
                <FloorMap model={model} floorId={leg.floorId} route={trip.route} activeLeg={trip.activeLeg} user={view.here} focus={{ lat: end.lat, lng: end.lng, zoom: 20.5 }} showMarkers={false} />
                <div className="wf-leg-badge"><span>{fromFloor?.name.split(" · ")[0]?.toUpperCase()}</span><b>→ {toFloor?.name.split(" · ")[0]?.toUpperCase()}</b></div>
            </div>
            <main className="wf-body">
                <div className="wf-ink-card">
                    <span className="wf-ink-icon"><Icon name={up ? "floor-up" : "floor-down"} size={34} stroke={2.6} /></span>
                    <span><b>{step?.title}</b><small>{leg.connector ?? "Thang"} · {up ? "lên" : "xuống"} {toFloor?.name}</small></span>
                </div>
                <div className="wf-fromto-floors">
                    <div><small>ĐANG Ở</small><b>{fromFloor?.name}</b></div>
                    <Icon name="straight" size={18} style={{ transform: "rotate(90deg)" }} />
                    <div className="is-next"><small>SAU KHI {up ? "LÊN" : "XUỐNG"}</small><b>{toFloor?.name}</b></div>
                </div>
                <p className="wf-muted">Bản đồ chuyển sang tầng mới khi bạn bấm xác nhận hoặc quét mã QR ở đầu thang. Sau đó đi tiếp {formatMeters(nextLeg?.distance)} tới {trip.to.name}.</p>
                {leg.connector !== "Thang máy" && lift && (
                    <div className="wf-note is-row">
                        <Icon name="walk" />
                        <span>Không dùng được {leg.connector?.toLowerCase()}? Bật “Tránh thang cuốn &amp; thang bộ” để đi bằng thang máy ({lift.l.name}).</span>
                        <Link to="/settings" className="wf-link">Cài đặt</Link>
                    </div>
                )}
            </main>
            <footer className="wf-actions">
                <Button to={`/v/${slug}/scan?then=go`} variant="secondary" full={false} icon="qr">Quét QR</Button>
                <Button icon="check" onClick={confirmFloorChange}>Tôi đã {up ? "lên" : "xuống"} {toFloor?.name.split(" · ")[0]}</Button>
            </footer>
        </div>
    );
}

function Arrived({ trip }: { trip: Trip }) {
    const model = useModel();
    const { slug, endTrip, setPosition } = useVenue();
    const navigate = useNavigate();
    const seconds = Math.round(((trip.arrivedAt ?? trip.startedAt) - trip.startedAt) / 1000);
    const floor = model.floorsById.get(trip.to.floorId);
    const finish = (to: string) => {
        setPosition({ floorId: trip.to.floorId, lat: trip.to.lat, lng: trip.to.lng, source: "place", label: trip.to.name, placeId: trip.to.id });
        endTrip();
        navigate(to, { replace: true });
    };
    const share = async () => {
        const url = `${window.location.origin}/v/${slug}/place/${trip.to.id}`;
        try {
            if (navigator.share) await navigator.share({ title: trip.to.name, url });
            else await navigator.clipboard.writeText(url);
        } catch {
            // huỷ
        }
    };

    return (
        <div className="wf-screen">
            <div className="wf-route-map is-short">
                <FloorMap model={model} floorId={trip.to.floorId} selectedId={trip.to.id} user={trip.to} focus={{ lat: trip.to.lat, lng: trip.to.lng, zoom: 20.5 }} />
            </div>
            <div className="wf-arrived">
                <span className="wf-arrived-check"><Icon name="check" size={32} stroke={3} /></span>
                <div><small>ĐÃ ĐẾN NƠI</small><h1>{trip.to.name}</h1><span>{floor?.buildingCode} · {floor?.name}</span></div>
            </div>
            <div className="wf-figures is-light">
                <div><b>{Math.round(trip.progress)}</b><span>mét đã đi</span></div>
                <div><b>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</b><span>phút</span></div>
                <div><b>{trip.qrFixes}</b><span>lần quét QR</span></div>
            </div>
            <main className="wf-body">
                <button type="button" className="wf-choice" onClick={() => finish(`/v/${slug}/search`)}><Icon name="search" size={22} /><span><b>Tìm nơi khác gần đây</b><small>Xếp theo khoảng cách từ {trip.to.name}</small></span></button>
                <button type="button" className="wf-choice" onClick={() => void share()}><Icon name="share" size={22} /><span><b>Chia sẻ địa điểm này</b><small>Gửi liên kết cho người đi cùng</small></span></button>
            </main>
            <footer className="wf-actions">
                <Button icon="check" onClick={() => finish(`/v/${slug}/map?floor=${trip.to.floorId}`)}>Xong</Button>
            </footer>
        </div>
    );
}
