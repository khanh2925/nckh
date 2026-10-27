import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { formatMeters } from "@indoor-map/core";
import { useSettings } from "../../lib/settings";
import { useModel, useVenue } from "../VenueContext";
import FloorMap from "../components/FloorMap";
import Icon from "../components/Icon";
import { Button, ErrorBox, IconButton } from "../components/ui";

// Xem tuyến trước khi đi: điểm đi/đến, bản đồ từng chặng, tóm tắt, chỉ dẫn từng bước.
export default function RoutePage() {
    const model = useModel();
    const { slug, position, setPosition, planRoute, startTrip, trip } = useVenue();
    const settings = useSettings();
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const to = model.locationsById.get(Number(params.get("to")));
    const [legView, setLegView] = useState(0);

    const planned = useMemo(
        () => (position && to ? planRoute(position, to) : null),
        // settings.avoidStairs: tính lại khi đổi tuỳ chọn
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [position, to, planRoute, settings.avoidStairs]
    );
    const route = planned && !("error" in planned) ? planned : null;
    const leg = route?.legs[Math.min(legView, route.legs.length - 1)];
    const floorChanges = route ? route.legs.length - 1 : 0;
    const returnHere = encodeURIComponent(`route?to=${to?.id ?? ""}`);

    const start = () => {
        if (!position || !to) return;
        const result = startTrip(position, to);
        if (result && !("error" in result)) navigate(`/v/${slug}/go`);
    };

    if (!to) {
        return (
            <div className="wf-screen wf-center">
                <ErrorBox title="Chưa chọn điểm đến" action={<Button to={`/v/${slug}/search?pick=to`} variant="secondary" icon="search">Tìm điểm đến</Button>} />
            </div>
        );
    }

    return (
        <div className="wf-screen">
            <header className="wf-topbar wf-route-head">
                <IconButton icon="back" label="Quay lại" onClick={() => navigate(-1)} />
                <div className="wf-fromto">
                    <Link to={`/v/${slug}/search?pick=from&to=${to.id}`} className="wf-fromto-row">
                        <span className="wf-fromto-dot is-from" />
                        <span className="wf-fromto-text"><span>Từ</span> {position ? (position.label ?? (position.source === "qr" ? `Mã QR ${position.nodeId ?? ""}` : "Vị trí của bạn")) : "Chọn điểm xuất phát"}</span>
                    </Link>
                    <Link to={`/v/${slug}/search?pick=to`} className="wf-fromto-row">
                        <span className="wf-fromto-dot is-to" />
                        <span className="wf-fromto-text"><span>Đến</span> {to.name}</span>
                    </Link>
                </div>
                <IconButton icon="swap" label="Đảo chiều" disabled={!position?.placeId}
                    onClick={() => {
                        if (!position?.placeId) return;
                        const back = position.placeId;
                        setPosition({ floorId: to.floorId, lat: to.lat, lng: to.lng, source: "place", label: to.name, placeId: to.id });
                        setLegView(0);
                        navigate(`/v/${slug}/route?to=${back}`, { replace: true });
                    }} />
            </header>

            {!position ? (
                <main className="wf-body">
                    <h2 className="wf-h2">Bạn đang ở đâu?</h2>
                    <p className="wf-muted">Trong nhà không có GPS. Chọn một cách để biết điểm xuất phát:</p>
                    <div className="wf-stack">
                        <Link to={`/v/${slug}/scan?then=${returnHere}`} className="wf-choice is-live"><Icon name="qr" size={24} /><span><b>Quét mã QR gần nhất</b><small>Chính xác nhất, ~1 m. Mã dán trên cột, biển chỉ dẫn.</small></span></Link>
                        <Link to={`/v/${slug}/search?pick=from&to=${to.id}`} className="wf-choice"><Icon name="search" size={24} /><span><b>Chọn địa điểm gần bạn</b><small>Ví dụ: “Cửa 5”, “Highlands”.</small></span></Link>
                        <Link to={`/v/${slug}/map?pick=position&floor=${to.floorId}&return=${returnHere}`} className="wf-choice"><Icon name="target" size={24} /><span><b>Chỉ trên bản đồ</b><small>Kéo bản đồ tới chỗ bạn đứng.</small></span></Link>
                    </div>
                </main>
            ) : planned && "error" in planned ? (
                <main className="wf-body">
                    <ErrorBox title="Không tìm được đường"
                        action={settings.avoidStairs ? <Button to="/settings" variant="secondary">Mở Cài đặt</Button> : <Button to={`/v/${slug}/search?pick=from&to=${to.id}`} variant="secondary" icon="search">Chọn điểm xuất phát khác</Button>}>
                        {planned.error}
                    </ErrorBox>
                </main>
            ) : route && leg ? (
                <>
                    <div className="wf-route-map">
                        <FloorMap model={model} floorId={leg.floorId} route={route} activeLeg={legView} user={legView === 0 ? position : null}
                            destination={to} focus={{ ...leg.points[Math.floor(leg.points.length / 2)]!, zoom: 19 }} showMarkers={false} />
                        <div className="wf-leg-badge"><span>CHẶNG {legView + 1}/{route.legs.length}</span><b>{model.floorsById.get(leg.floorId)?.buildingCode} · {model.floorsById.get(leg.floorId)?.name.split(" · ")[0]}</b></div>
                        {route.legs.length > 1 && (
                            <div className="wf-leg-tabs" role="tablist" aria-label="Chặng">
                                {route.legs.map((l, i) => (
                                    <button key={i} type="button" role="tab" aria-selected={i === legView} onClick={() => setLegView(i)}>
                                        {i + 1}<small>{model.floorsById.get(l.floorId)?.level}</small>
                                    </button>
                                ))}
                            </div>
                        )}
                        <div className="wf-mode-switch">
                            <span className="is-on">2D</span>
                            <Link to={`/v/${slug}/camera`} onClick={e => { e.preventDefault(); const r = startTrip(position, to); if (r && !("error" in r)) navigate(`/v/${slug}/camera`); }}>Camera</Link>
                        </div>
                    </div>
                    <div className="wf-figures">
                        <div><b>{route.distance}</b><span>mét</span></div>
                        <div><b>{Math.max(1, Math.round(route.seconds / 60))}</b><span>phút</span></div>
                        <div><b>{floorChanges}</b><span>{floorChanges ? (route.legs[0]?.connector ?? "thang").toLowerCase() : "đổi tầng"}</span></div>
                    </div>
                    <main className="wf-body is-scroll">
                        {settings.avoidStairs && <p className="wf-note">Đang tránh thang cuốn & thang bộ (chỉ dùng thang máy).</p>}
                        <ol className="wf-steps">
                            {route.steps.map((step, i) => (
                                <li key={i} className={`wf-step${step.kind.startsWith("floor") ? " is-floor" : ""}${step.kind === "arrive" ? " is-arrive" : ""}${i === 0 ? " is-first" : ""}`}>
                                    <span className="wf-step-icon"><Icon name={step.kind} size={24} stroke={2.6} /></span>
                                    <span className="wf-step-text"><b>{step.title}</b><small>{step.detail}</small></span>
                                    <span className="wf-step-figure">{step.kind.startsWith("floor") ? (step.kind === "floor-up" ? "↑" : "↓") : step.distance ? formatMeters(step.distance).replace(" m", "") : ""}</span>
                                </li>
                            ))}
                        </ol>
                    </main>
                    <footer className="wf-actions">
                        <Button icon="play" onClick={start}>{trip && trip.to.id === to.id ? "Đi lại từ đầu" : "Bắt đầu đi"}</Button>
                        <IconButton icon="qr" label="Định vị lại bằng QR" to={`/v/${slug}/scan?then=${returnHere}`} size={52} />
                    </footer>
                </>
            ) : null}
        </div>
    );
}
