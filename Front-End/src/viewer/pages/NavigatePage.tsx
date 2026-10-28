import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { formatMeters, searchPlaces, type Trip } from "@indoor-map/core";
import Lc from "../../design/Lc";
import { getSettings } from "../../lib/settings";
import { useModel, useVenue } from "../VenueContext";
import { useTripEngine, canSimulateByDefault, type TripEngine } from "../useTripEngine";
import FloorMap from "../components/FloorMap";
import { Button, Hud, IconButton, Progress, Row, Sheet, Status } from "../components/ui";
import { clean, decimal, floorInSentence, floorLabel, minutesOf, placeWhere, stepIcon } from "../format";

// Đang đi (2D): HUD than chì có mũi tên lượt kế tiếp + quãng còn lại, bản đồ phẳng xoay theo hướng đi, bảng tiến độ.
// Tới chỗ thang: Chuyển tầng. Tới nơi: Đã tới.
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

/** Chip trạng thái định vị: nguồn định vị + số bước + sai số; bật cảm biến; cảnh báo lệch */
export function TripStatusChip({ engine, slug, then, prefix }: { engine: TripEngine; slug: string; then: "go" | "camera"; prefix?: string }) {
    if (engine.needPermission && !engine.simulating) {
        return (
            <button type="button" className="wf-chip wf-lift" onClick={() => void engine.enableSensors()}>
                <Lc name="compass" size={20} /><span>Bật la bàn và đếm bước</span>
            </button>
        );
    }
    if (engine.lost) {
        return (
            <Link to={`/v/${slug}/scan?then=${then}`} className="wf-chip wf-lift">
                <Lc name="triangle-alert" size={20} color="var(--warn)" /><span>Có thể đã lệch ±{Math.round(engine.uncertainty)} m, quét QR</span>
            </Link>
        );
    }
    const source = engine.trip.lastFixSource;
    const from = source === "qr" ? `QR ${engine.trip.from.nodeId ?? ""}`.trim() : source === "pick" ? "Chọn trên bản đồ" : clean(engine.trip.from.label) || "Địa điểm";
    const text = engine.simulating
        ? `Mô phỏng đi bộ ${decimal(1.3, 1)} m/s`
        : `${from}${engine.stepsLive ? `, ${engine.steps} bước` : ""}, ±${Math.round(engine.uncertainty)} m`;
    return (
        <span className="wf-chip wf-lift" role="status">
            {prefix ? <span className="wf-warn">{prefix}</span> : <Lc name={source === "qr" ? "qr-code" : "map-pin"} size={20} />}<span>{text}</span>
        </span>
    );
}

/** Menu "Thêm" + hộp xác nhận kết thúc, dùng chung cho Đang đi, Chuyển tầng, Camera */
export function TripMenu({ engine, open, onClose, onAlign, showSimulate }: {
    engine: TripEngine; open: boolean; onClose: () => void; onAlign?: () => void; showSimulate?: boolean;
}) {
    const { slug, endTrip } = useVenue();
    const navigate = useNavigate();
    const [confirm, setConfirm] = useState(false);
    const { trip, view } = engine;
    const here = view.here;
    if (!open && !confirm) return null;
    const close = () => {
        setConfirm(false);
        onClose();
    };
    return (
        <>
            <button type="button" className="wf-scrim" aria-label="Đóng" onClick={close} />
            {confirm ? (
                <div className="wf-dlg" role="alertdialog" aria-modal="true" aria-labelledby="kt-t" aria-describedby="kt-d">
                    <h2 id="kt-t" className="wf-t22">Kết thúc chỉ đường?</h2>
                    <p id="kt-d" className="wf-t15 wf-muted">Còn {formatMeters(view.remaining)} tới {trip.to.name}.</p>
                    <div className="wf-acts">
                        <Button variant="secondary" danger onClick={() => { endTrip(); navigate(`/v/${slug}/place/${trip.to.id}`, { replace: true }); }}>Kết thúc</Button>
                        <Button onClick={close}>Tiếp tục đi</Button>
                    </div>
                </div>
            ) : (
                <div className="wf-menu" role="menu" aria-label="Thêm">
                    <div className="wf-grab" aria-hidden="true" />
                    <Link role="menuitem" className="wf-mi" to={`/v/${slug}/route?to=${trip.to.id}`}><Lc name="list" size={20} />Xem các bước</Link>
                    {onAlign && engine.canAlign && (
                        <button role="menuitem" type="button" className="wf-mi" onClick={() => { onClose(); onAlign(); }}><Lc name="compass" size={20} />Căn hướng la bàn</button>
                    )}
                    {showSimulate && (
                        <button role="menuitem" type="button" className="wf-mi" onClick={() => { engine.setSimulating(!engine.simulating); onClose(); }}>
                            <Lc name="footprints" size={20} />{engine.simulating ? "Dừng mô phỏng đi bộ" : "Mô phỏng đi bộ"}
                        </button>
                    )}
                    <Link role="menuitem" className="wf-mi" to={`/v/${slug}/map?pick=position&floor=${here?.floorId ?? trip.to.floorId}&return=go`}><Lc name="map-pin" size={20} />Tôi không ở chỗ này</Link>
                    <Link role="menuitem" className="wf-mi" to="/settings"><Lc name="settings" size={20} />Cài đặt chỉ đường</Link>
                    <Link role="menuitem" className="wf-mi" to={`/v/${slug}/report`}><Lc name="flag" size={20} />Báo sai đường</Link>
                    <button role="menuitem" type="button" className="wf-mi is-danger" onClick={() => setConfirm(true)}><Lc name="x" size={20} />Kết thúc chỉ đường…</button>
                    <Button variant="secondary" block onClick={close}>Đóng</Button>
                </div>
            )}
        </>
    );
}

function TwoD({ engine }: { engine: TripEngine }) {
    const model = useModel();
    const { slug } = useVenue();
    const { trip, view } = engine;
    const [headingUp, setHeadingUp] = useState(true);
    const [aligning, setAligning] = useState(false);
    const [menu, setMenu] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);
    useEffect(() => {
        if (!notice) return undefined;
        const t = window.setTimeout(() => setNotice(null), 3500);
        return () => window.clearTimeout(t);
    }, [notice]);
    const next = view.next;
    const after = trip.route.steps[view.stepIndex + 2];
    const here = view.here;
    const floorId = here?.floorId ?? trip.route.legs[trip.activeLeg]!.floorId;
    const percent = trip.route.distance > 0 ? (trip.progress / trip.route.distance) * 100 : 100;
    const simulateInline = engine.simulating || canSimulateByDefault || !engine.stepsLive;

    return (
        <div className="wf-screen">
            <div className="wf-maparea">
                <FloorMap model={model} floorId={floorId} route={trip.route} activeLeg={trip.activeLeg} destination={trip.to}
                    user={here} accuracy={engine.uncertainty} heading={engine.heading} headingUp={headingUp && engine.heading != null}
                    focus={here ? { lat: here.lat, lng: here.lng, zoom: 20 } : "floor"} />
                <Hud glyph={stepIcon(next?.kind)} num={Math.round(view.toNext)} unit="m" text={next?.title ?? "Đi thẳng"} />
                <div className="wf-float-chip" style={{ top: 136 }}>
                    {notice ? <span className="wf-chip wf-lift" role="status"><Lc name="check" size={20} /><span>{notice}</span></span> : <TripStatusChip engine={engine} slug={slug} then="go" />}
                </div>
                <div className="wf-side is-bottom">
                    {engine.heading != null && (
                        <IconButton kind="map-sm" icon="compass" on={headingUp} label={headingUp ? "Bản đồ theo hướng đi, bấm để quay về hướng Bắc" : "Bản đồ hướng Bắc, bấm để xoay theo hướng đi"}
                            onClick={() => setHeadingUp(h => !h)} />
                    )}
                    <IconButton kind="map-sm" icon="camera" label="Chỉ đường bằng camera" to={`/v/${slug}/camera`} />
                </div>
            </div>

            {aligning ? (
                <Sheet labelledBy="al-t">
                    <div>
                        <h2 id="al-t" className="wf-t28">Căn hướng la bàn</h2>
                        <p className="wf-t15 wf-muted" style={{ marginTop: 8 }}>
                            Cầm máy thẳng trước ngực, quay người theo hướng thật của đoạn đường vàng ngay trước chấm của bạn, rồi bấm Xong.
                        </p>
                    </div>
                    <div className="wf-acts">
                        <Button variant="secondary" onClick={() => setAligning(false)}>Huỷ</Button>
                        {engine.headingOffset !== 0 && <Button variant="secondary" onClick={() => { engine.resetHeading(); setAligning(false); setNotice("Đã bỏ bù hướng"); }}>Bỏ bù</Button>}
                        <Button icon="check" onClick={() => {
                            const offset = engine.alignHeading();
                            setAligning(false);
                            setNotice(offset == null ? "Chưa có la bàn, thử lại sau vài giây" : `Đã căn hướng, bù ${offset > 0 ? "+" : ""}${offset}°`);
                        }}>Xong</Button>
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
                        {next?.detail && <p className="wf-t13" style={{ marginTop: 8 }}>{capitalize(clean(next.detail))}{after && after.kind === "arrive" ? `, tới ${trip.to.name}` : ""}</p>}
                    </div>
                    <div className="wf-acts">
                        <Button variant="secondary" icon="scan-line" to={`/v/${slug}/scan?then=go`}>Quét QR</Button>
                        {simulateInline && (
                            <Button variant="secondary" icon="footprints" onClick={() => engine.setSimulating(!engine.simulating)}>{engine.simulating ? "Dừng" : "Mô phỏng"}</Button>
                        )}
                        {simulateInline
                            ? <Button variant="secondary" square icon="ellipsis" label="Thêm" onClick={() => setMenu(true)} />
                            : <Button variant="secondary" icon="ellipsis" onClick={() => setMenu(true)}>Thêm</Button>}
                    </div>
                </Sheet>
            )}
            <TripMenu engine={engine} open={menu} onClose={() => setMenu(false)} onAlign={() => setAligning(true)} showSimulate={!simulateInline} />
        </div>
    );
}

const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

function FloorChange({ engine }: { engine: TripEngine }) {
    const model = useModel();
    const { slug, confirmFloorChange } = useVenue();
    const { trip, view } = engine;
    const [menu, setMenu] = useState(false);
    const step = view.step;
    const leg = trip.route.legs[trip.activeLeg]!;
    const nextLeg = trip.route.legs[trip.activeLeg + 1];
    const fromFloor = model.floorsById.get(leg.floorId);
    const toFloor = nextLeg ? model.floorsById.get(nextLeg.floorId) : undefined;
    const end = leg.points[leg.points.length - 1]!;
    const up = step?.kind !== "floor-down";
    const connector = leg.connector ?? "Thang";
    const endCode = end.id && model.nodesById.get(end.id)?.connector ? end.id : null;

    return (
        <div className="wf-screen">
            <div className="wf-maparea">
                <FloorMap model={model} floorId={leg.floorId} route={trip.route} activeLeg={trip.activeLeg} user={view.here} accuracy={engine.uncertainty}
                    heading={engine.heading} focus={{ lat: end.lat, lng: end.lng, zoom: 20.5 }} showMarkers={false} />
                <Hud glyph="arrow-up-down" num={floorLabel(toFloor)} text={step?.title ?? `${connector} ${up ? "lên" : "xuống"}`}
                    sub={nextLeg ? `Chặng ${trip.activeLeg + 2}/${trip.route.legs.length}, rồi đi ${formatMeters(nextLeg.distance)}` : undefined} />
            </div>
            <Sheet labelledBy="fc-t">
                <div className="wf-sheet-head">
                    <div>
                        <h1 id="fc-t" className="wf-t28">{up ? "Lên" : "Xuống"} {floorInSentence(toFloor)}</h1>
                        <p className="wf-t13" style={{ marginTop: 4 }}>Dùng {connector.toLowerCase()}</p>
                    </div>
                    <IconButton icon="ellipsis" label="Thêm" popup="menu" onClick={() => setMenu(true)} />
                </div>
                <div className="wf-card" style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ flex: 1, minWidth: 0 }}><p className="wf-t13">Đang ở</p><p className="wf-t17">{floorLabel(fromFloor)}</p></div>
                    <Lc name="arrow-right" size={20} color="var(--muted)" />
                    <div style={{ flex: 1, minWidth: 0 }}><p className="wf-t13">{up ? "Lên" : "Xuống"}</p><p className="wf-t17">{floorLabel(toFloor)}</p></div>
                </div>
                {connector !== "Thang máy" && !getSettings().avoidStairs && (
                    <Row title={`Không đi được ${connector.toLowerCase()}?`} sub="Bật Chỉ dùng thang máy trong Cài đặt" to="/settings" chevron />
                )}
                <p className="wf-t13" style={{ textAlign: "center" }}>Xác nhận tay chỉ đổi tầng, sai số ±{Math.round(engine.uncertainty)} m ước tính</p>
                <div className="wf-stack">
                    <Button variant="secondary" icon="scan-line" to={`/v/${slug}/scan?then=go`}>{endCode ? `Quét mã ${endCode} ở cửa thang` : "Quét mã QR ở cửa thang"}</Button>
                    <Button icon="check" onClick={confirmFloorChange}>Tôi đã {up ? "lên" : "xuống"} {floorInSentence(toFloor)}</Button>
                </div>
            </Sheet>
            <TripMenu engine={engine} open={menu} onClose={() => setMenu(false)} />
        </div>
    );
}

function Arrived({ trip }: { trip: Trip }) {
    const model = useModel();
    const { slug, endTrip, setPosition } = useVenue();
    const navigate = useNavigate();
    const [shared, setShared] = useState(false);
    const seconds = Math.max(0, Math.round(((trip.arrivedAt ?? trip.startedAt) - trip.startedAt) / 1000));
    const floor = model.floorsById.get(trip.to.floorId);
    const nearby = useMemo(() => {
        const hits = searchPlaces(model, "", { near: trip.to, floorId: trip.to.floorId, limit: 12 }).filter(h => h.place.id !== trip.to.id);
        return hits.find(h => h.place.type === "restroom") ?? hits[0] ?? null;
    }, [model, trip.to]);
    const finish = (to: string) => {
        setPosition({ floorId: trip.to.floorId, lat: trip.to.lat, lng: trip.to.lng, source: "place", label: trip.to.name, placeId: trip.to.id });
        endTrip();
        navigate(to, { replace: true });
    };
    const share = async () => {
        const url = `${window.location.origin}/v/${slug}/place/${trip.to.id}`;
        try {
            if (navigator.share) await navigator.share({ title: trip.to.name, url });
            else {
                await navigator.clipboard.writeText(url);
                setShared(true);
            }
        } catch {
            // huỷ
        }
    };

    return (
        <div className="wf-screen">
            <div className="wf-maparea">
                <FloorMap model={model} floorId={trip.to.floorId} selectedId={trip.to.id} user={trip.to} focus={{ lat: trip.to.lat, lng: trip.to.lng, zoom: 20.5 }} />
                <Hud glyph="circle-check" num="Đã tới" text={`${trip.to.name}, ${floor?.buildingCode ?? ""} ${floorLabel(floor)}`.trim()} />
            </div>
            <Sheet labelledBy="ar-t">
                <div>
                    <Status icon="circle-check" tone="ok">Đã tới</Status>
                    <h1 id="ar-t" className="wf-t28" style={{ marginTop: 4 }}>{trip.to.name}</h1>
                    <p className="wf-t13" style={{ marginTop: 4 }}>{placeWhere(model, trip.to)}</p>
                </div>
                <div className="wf-stats">
                    <div><p className="wf-t17">{formatMeters(trip.progress)}</p><p className="wf-t13">đã đi</p></div>
                    <div><p className="wf-t17">{seconds < 60 ? `${seconds} giây` : `${minutesOf(seconds)} phút`}</p><p className="wf-t13">thời gian</p></div>
                    <div><p className="wf-t17">{trip.qrFixes}</p><p className="wf-t13">lần quét QR</p></div>
                </div>
                <section aria-labelledby="ar-next">
                    <h2 id="ar-next" className="wf-sec">Tiếp theo</h2>
                    <Row title="Tìm nơi khác gần đây" sub={nearby ? `${nearby.place.name} ${formatMeters(nearby.meters)}` : undefined} onClick={() => finish(`/v/${slug}/search`)} chevron />
                    <Row title={shared ? "Đã sao chép liên kết" : "Chia sẻ vị trí này"} onClick={() => void share()} />
                </section>
                <div className="wf-acts"><Button onClick={() => finish(`/v/${slug}/map?floor=${trip.to.floorId}`)}>Xong, về bản đồ</Button></div>
            </Sheet>
        </div>
    );
}
