import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { formatMeters, positionUncertainty, type Place, type PlannedRoute, type Position, type VenueModel } from "@indoor-map/core";
import Lc from "../../design/Lc";
import { needsSensorPermission, useSensorPermission } from "../../lib/sensors";
import { updateSettings, useSettings } from "../../lib/settings";
import { useModel, useVenue } from "../VenueContext";
import FloorMap from "../components/FloorMap";
import { Button, Dots, ErrorScreen, IconButton, Row, Segmented, Sheet, Status } from "../components/ui";
import { clean, floorChangeText, floorFull, floorInSentence, floorLabel, floorShort, minutesOf, positionLabel, stepIcon } from "../format";

/** Thanh đi/đến nổi trên bản đồ (Client-Route): quay lại + "Từ …" + "Đến …" + đảo chiều */
export function FromToBar({ model, position, to, slug, onSwap, swapDisabled, back }: {
    model: VenueModel; position: Position | null; to: Place; slug: string; onSwap?: () => void; swapDisabled?: boolean; back: () => void;
}) {
    const toFloor = model.floorsById.get(to.floorId);
    return (
        <header className="wf-bar" style={{ alignItems: "stretch" }}>
            <div className="wf-lift" style={{ flex: 1, minWidth: 0, borderRadius: 16, background: "var(--surface)", padding: "8px 8px 8px 4px", display: "flex", alignItems: "center", gap: 8 }}>
                <IconButton icon="arrow-left" label="Quay lại" clear onClick={back} />
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                    <Link to={`/v/${slug}/search?pick=from&to=${to.id}`} className="wf-t15 wf-muted wf-ell" aria-label="Đổi điểm đi">
                        {position ? `Từ ${positionLabel(model, position)}` : "Chọn điểm đi"}
                    </Link>
                    <Link to={`/v/${slug}/search?pick=to`} className="wf-t17 wf-ell" aria-label="Đổi điểm đến">Đến {to.name}{toFloor ? `, ${floorLabel(toFloor)}` : ""}</Link>
                </div>
                {onSwap && <IconButton icon="arrow-up-down" label="Đảo chiều" onClick={onSwap} disabled={swapDisabled} />}
            </div>
        </header>
    );
}

/** Ba cách biết điểm đi, kèm sai số thật của từng cách (pdr.positionUncertainty) */
export function WhereFromRows({ slug, returnPath, floorId, to }: { slug: string; returnPath: string; floorId: number; to?: Place }) {
    const back = encodeURIComponent(returnPath);
    const err = (s: "qr" | "place" | "pick") => <span className="wf-t15 wf-row-val">±{positionUncertainty(0, s)} m</span>;
    return (
        <div>
            <Row title="Quét mã QR gần bạn" sub="Trên cột, biển chỉ dẫn" to={`/v/${slug}/scan?then=${back}`} trailing={err("qr")} chevron />
            <Row title="Chọn điểm gần bạn" sub="Quầy, cửa, cửa hàng" to={to ? `/v/${slug}/search?pick=from&to=${to.id}` : `/v/${slug}/search?pick=here&return=${back}`} trailing={err("place")} chevron />
            <Row title="Chỉ trên bản đồ" sub="Kéo dấu ngắm tới chỗ bạn đứng" to={`/v/${slug}/map?pick=position&floor=${floorId}&return=${back}`} trailing={err("pick")} chevron />
        </div>
    );
}

function legCaption(model: VenueModel, route: PlannedRoute, index: number, to: Place): string {
    const leg = route.legs[index];
    if (!leg) return "";
    const floor = model.floorsById.get(leg.floorId);
    const end = index < route.legs.length - 1 ? `tới ${(leg.connector ?? "thang").toLowerCase()}` : `tới ${to.name}`;
    return `Chặng ${index + 1}/${route.legs.length}, ${floorInSentence(floor)} ${end}`;
}

// Xem tuyến trước khi đi: điểm đi/đến, bản đồ từng chặng, thời gian, tuỳ chọn tuyến, chỉ dẫn từng bước.
export default function RoutePage() {
    const model = useModel();
    const { slug, position, setPosition, planRoute, startTrip, trip } = useVenue();
    const settings = useSettings();
    const permission = useSensorPermission();
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const to = model.locationsById.get(Number(params.get("to")));
    const [legView, setLegView] = useState(0);
    // Mặc định chỉ hiện 2 bước đầu để bản đồ không bị che; mở rộng khi khách muốn xem hết
    const [allSteps, setAllSteps] = useState(false);

    const planned = useMemo(
        () => (position && to ? planRoute(position, to) : null),
        // settings.avoidStairs: tính lại khi đổi tuỳ chọn
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [position, to, planRoute, settings.avoidStairs]
    );
    const route = planned && !("error" in planned) ? planned : null;
    const legIndex = route ? Math.min(legView, route.legs.length - 1) : 0;
    const leg = route?.legs[legIndex];
    const returnHere = `route?to=${to?.id ?? ""}`;
    const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate(to ? `/v/${slug}/place/${to.id}` : `/v/${slug}/map`));

    const begin = (then: "go" | "camera") => {
        if (!position || !to) return;
        if (needsSensorPermission && permission !== "granted") {
            navigate(`/v/${slug}/permission?to=${to.id}&then=${then}`);
            return;
        }
        const result = startTrip(position, to);
        if (result && !("error" in result)) navigate(`/v/${slug}/${then}`);
    };

    if (!to) {
        return (
            <ErrorScreen status="Chưa chọn điểm đến" icon="flag" title="Bạn muốn đến đâu?" headerTitle={model.venue.name} back={`/v/${slug}/map`}
                foot={<Button to={`/v/${slug}/search?pick=to`} icon="search">Tìm điểm đến</Button>} />
        );
    }

    const swap = () => {
        if (!position?.placeId) return;
        const backId = position.placeId;
        setPosition({ floorId: to.floorId, lat: to.lat, lng: to.lng, source: "place", label: to.name, placeId: to.id });
        setLegView(0);
        navigate(`/v/${slug}/route?to=${backId}`, { replace: true });
    };

    const mapFloor = leg?.floorId ?? position?.floorId ?? to.floorId;
    const focus = leg ? { bounds: leg.points } : position && position.floorId === to.floorId ? { bounds: [position, to] } : { lat: to.lat, lng: to.lng, zoom: 19.5 };
    const changes = route ? floorChangeText(route) : null;
    const legSteps = route ? route.steps.filter(s => s.legIndex === legIndex) : [];

    return (
        <div className="wf-screen">
            <div className="wf-maparea">
                <FloorMap model={model} floorId={mapFloor} route={route} activeLeg={legIndex} user={legIndex === 0 ? position : null}
                    accuracy={position ? positionUncertainty(0, position.source) : null} destination={to} focus={focus} showMarkers={false} fitPadding={[104, 32]} />
                <FromToBar model={model} position={position} to={to} slug={slug} onSwap={swap} swapDisabled={!position?.placeId} back={goBack} />
                {route && (
                    <div className="wf-side" style={{ top: 112 }}>
                        {route.legs.length > 1 && (
                            <div className="wf-seg wf-lift" role="group" aria-label="Xem chặng">
                                {[...route.legs.keys()].reverse().map(i => {
                                    const f = model.floorsById.get(route.legs[i]!.floorId);
                                    return <button key={i} type="button" aria-pressed={i === legIndex} aria-label={`Chặng ${i + 1}, ${floorFull(f)}`} onClick={() => setLegView(i)}>{f ? floorShort(f.level) : i + 1}</button>;
                                })}
                            </div>
                        )}
                        <IconButton kind="map-sm" icon="camera" label="Chỉ đường bằng camera" onClick={() => begin("camera")} />
                    </div>
                )}
            </div>

            {!position ? (
                <Sheet labelledBy="rt-where">
                    <div>
                        <h2 id="rt-where" className="wf-t28">Bạn đang ở đâu?</h2>
                        <p className="wf-t13" style={{ marginTop: 4 }}>Trong nhà không có GPS. Chọn một cách để biết điểm đi.</p>
                    </div>
                    <WhereFromRows slug={slug} returnPath={returnHere} floorId={to.floorId} to={to} />
                </Sheet>
            ) : planned && "error" in planned ? (
                <Sheet labelledBy="rt-err">
                    <div role="alert">
                        <Status icon="circle-alert" tone="danger">Không tìm được đường</Status>
                        <h2 id="rt-err" className="wf-t22" style={{ marginTop: 8 }}>{clean(planned.error)}</h2>
                        <p className="wf-t13" style={{ marginTop: 8 }}>Điểm đi giữ nguyên: {positionLabel(model, position)}</p>
                    </div>
                    <div className="wf-stack">
                        <Button variant="secondary" to={`/v/${slug}/search?pick=to`}>Chọn điểm đến khác</Button>
                        {settings.avoidStairs
                            ? <Button onClick={() => updateSettings({ avoidStairs: false })}>Cho phép thang cuốn, thang bộ</Button>
                            : <Button to={`/v/${slug}/search?pick=from&to=${to.id}`}>Chọn điểm đi khác</Button>}
                    </div>
                </Sheet>
            ) : route && leg && changes ? (
                <Sheet labelledBy="rt-t">
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                        <h1 id="rt-t" className="wf-t44">{minutesOf(route.seconds)}<small>phút</small></h1>
                        <span className="wf-t17 wf-muted">{formatMeters(route.distance)}</span>
                        <span className="wf-t13" style={{ marginLeft: "auto", whiteSpace: "nowrap" }}>{changes.value === "0" ? "đi bộ, ước tính" : `${changes.value} ${changes.label}`}</span>
                    </div>
                    <Segmented label="Tuỳ chọn tuyến" value={settings.avoidStairs ? "lift" : "short"}
                        onChange={v => updateSettings({ avoidStairs: v === "lift" })}
                        options={[{ value: "short", label: "Ngắn nhất" }, { value: "lift", label: "Chỉ thang máy" }]} />
                    <div>
                        {route.legs.length > 1 && <Dots count={route.legs.length} current={legIndex} />}
                        <p className="wf-t13" style={{ marginTop: route.legs.length > 1 ? 8 : 0 }}>{legCaption(model, route, legIndex, to)}</p>
                        <ol className="wf-steps" aria-label="Các bước">
                            {(allSteps ? legSteps : legSteps.slice(0, 2)).map((step, i) => (
                                <li key={`${step.at}-${i}`}>
                                    <Row lead={<Lc name={stepIcon(step.kind)} size={20} />} title={step.title} sub={step.detail ? clean(step.detail) : undefined}
                                        trailing={step.distance > 0 && !step.kind.startsWith("floor") ? <span className="wf-t15 wf-row-val">{formatMeters(step.distance)}</span> : undefined} />
                                </li>
                            ))}
                        </ol>
                        {legSteps.length > 2 && (
                            <button type="button" className="wf-btn wf-btn-t" style={{ marginLeft: -8 }} aria-expanded={allSteps} onClick={() => setAllSteps(v => !v)}>
                                {allSteps ? "Thu gọn" : `Xem tất cả ${legSteps.length} bước`}
                            </button>
                        )}
                    </div>
                    <div className="wf-acts">
                        <Button icon="navigation" onClick={() => begin("go")}>{trip && trip.to.id === to.id && !trip.arrived ? "Đi lại từ đầu" : "Bắt đầu đi"}</Button>
                        <Button variant="secondary" square icon="share" label="Chia sẻ tuyến" to={`/v/${slug}/share?to=${to.id}`} />
                    </div>
                </Sheet>
            ) : null}
        </div>
    );
}
