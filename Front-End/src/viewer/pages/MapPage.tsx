import { useCallback, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { positionUncertainty, type LatLng, type Place, type Position, type VenueModel } from "@indoor-map/core";
import Lc from "../../design/Lc";
import { useModel, useVenue } from "../VenueContext";
import FloorMap, { type MapFocus } from "../components/FloorMap";
import { Button, IconButton, Row, Sheet, SheetHead, Status } from "../components/ui";
import { buildingShort, clean, floorFull, floorInSentence, floorLabel, floorShort, groupCounts, groupUi, positionLabel } from "../format";

// Bản đồ trong nhà, bố cục "Khám phá": bản đồ phẳng tràn màn, ô tìm + nút QR nổi, chip danh mục (số thật),
// nút tầng + nút định vị bên phải, bảng trượt có tên toà nhà và các ô danh mục.
// ?pick=position: "Bạn đang ở đâu?" — kéo bản đồ để đặt dấu ngắm. mode="landing": vừa quét tem QR. mode="preview": xem như khách.

type Mode = "explore" | "landing" | "preview";

/** Ô chọn tầng dọc */
function FloorSeg({ model, floorId, onPick }: { model: VenueModel; floorId: number; onPick: (id: number) => void }) {
    const floor = model.floorsById.get(floorId);
    if (!floor) return null;
    const floors = model.floorsOf(floor.buildingId);
    return (
        <div className="wf-seg wf-lift" role="group" aria-label={`Chọn tầng, đang xem ${floorInSentence(floor)}`}>
            {floors.map(f => (
                <button key={f.id} type="button" aria-pressed={f.id === floorId} title={floorFull(f)} aria-label={floorFull(f)} onClick={() => onPick(f.id)}>
                    {floorShort(f.level)}
                </button>
            ))}
        </div>
    );
}

/** Menu đáy "Chọn toà và tầng" (Viewer-FloorPicker) */
export function FloorPicker({ model, floorId, position, onPick, onClose, slug }: {
    model: VenueModel; floorId: number; position: Position | null; onPick: (id: number) => void; onClose: () => void; slug: string;
}) {
    return (
        <>
            <button type="button" className="wf-scrim" aria-label="Đóng" onClick={onClose} />
            <div className="wf-menu" role="dialog" aria-modal="true" aria-labelledby="fp-title">
                <div className="wf-grab" aria-hidden="true" />
                <div className="wf-sheet-head" style={{ alignItems: "center" }}>
                    <h2 id="fp-title" className="wf-t22">Chọn toà và tầng</h2>
                    <IconButton icon="x" label="Đóng" onClick={onClose} />
                </div>
                {model.buildings.map(b => {
                    const floors = [...model.floorsOf(b.id)].reverse();
                    if (!floors.length) return null;
                    const here = position && floors.some(f => f.id === position.floorId) ? model.floorsById.get(position.floorId) : null;
                    return (
                        <section key={b.id} aria-label={clean(b.name)} style={{ marginTop: 8 }}>
                            <h3 className="wf-sec">{clean(b.name)}</h3>
                            <div className="wf-floorset">
                                {floors.map(f => (
                                    <button key={f.id} type="button" className={`wf-chip is-text${f.id === floorId ? " is-on" : " is-flat"}`} aria-pressed={f.id === floorId}
                                        onClick={() => onPick(f.id)}>
                                        {f.id === floorId && <Lc name="check" size={20} />}{floorLabel(f)}
                                    </button>
                                ))}
                            </div>
                            {here && <p className="wf-t13 wf-status" style={{ marginTop: 8, fontWeight: 400 }}><Lc name="locate-fixed" size={20} />Bạn ở {floorInSentence(here)}</p>}
                        </section>
                    );
                })}
                <div style={{ marginTop: 8 }}>
                    <Link to={`/v/${slug}`} className="wf-mi"><Lc name="info" size={20} />Thông tin địa điểm</Link>
                    <Link to="/settings" className="wf-mi" style={{ borderBottom: 0 }}><Lc name="settings" size={20} />Cài đặt</Link>
                </div>
            </div>
        </>
    );
}

export default function MapPage({ mode = "explore", landingCode, landingMissing }: { mode?: Mode; landingCode?: string; landingMissing?: boolean }) {
    const model = useModel();
    const { slug, position, setPosition, trip: anyTrip, fixPosition } = useVenue();
    const trip = anyTrip && !anyTrip.arrived ? anyTrip : null;
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const pick = mode === "explore" && params.get("pick") === "position";
    const returnTo = params.get("return");

    const paramFloor = Number(params.get("floor"));
    const floorId = (model.floorsById.has(paramFloor) && paramFloor) || position?.floorId || model.defaultFloor?.id || model.floors[0]!.id;
    const floor = model.floorsById.get(floorId)!;
    const building = model.buildingsById.get(floor.buildingId);
    const [group, setGroup] = useState<string | null>(null);
    const [picker, setPicker] = useState(false);
    const [hint, setHint] = useState(true);
    const [center, setCenter] = useState<LatLng | null>(null);
    const [focus, setFocus] = useState<MapFocus>(() => {
        const at = Number(params.get("lat"));
        const lng = Number(params.get("lng"));
        if (at && lng) return { lat: at, lng, zoom: 20 };
        if (position && position.floorId === floorId) return { lat: position.lat, lng: position.lng, zoom: 19.5 };
        return "floor";
    });

    const setFloor = (id: number) => {
        const next = new URLSearchParams(params);
        next.set("floor", String(id));
        next.delete("lat");
        next.delete("lng");
        setParams(next, { replace: true });
        setFocus("floor");
        setPicker(false);
    };

    const counts = useMemo(() => groupCounts(model, floorId), [model, floorId]);
    const places = useMemo(
        () => model.locations.filter(l => l.floorId === floorId && (!group || model.typeOf(l.type).groupName === group)),
        [model, floorId, group]
    );
    const onSelect = useCallback((place: Place) => navigate(`/v/${slug}/place/${place.id}`), [navigate, slug]);
    const user = trip ? null : position;
    const accuracy = user ? positionUncertainty(0, user.source, user.accuracy) : null;

    const locate = () => {
        if (!position) {
            navigate(`/v/${slug}/map?pick=position&floor=${floorId}&return=${encodeURIComponent(`map?floor=${floorId}`)}`);
            return;
        }
        if (position.floorId !== floorId) setFloor(position.floorId);
        setFocus({ lat: position.lat, lng: position.lng, zoom: 20 });
    };

    const confirmPick = () => {
        if (!center) return;
        const point = { floorId, lat: center.lat, lng: center.lng, source: "pick" as const, label: "Vị trí chọn trên bản đồ" };
        if (trip) fixPosition(point);
        else setPosition(point);
        navigate(returnTo ? `/v/${slug}/${returnTo}` : `/v/${slug}/map?floor=${floorId}`, { replace: true });
    };

    const back = returnTo ? `/v/${slug}/${returnTo}` : `/v/${slug}/map?floor=${floorId}`;
    const searchTo = `/v/${slug}/search?floor=${floorId}`;
    const sheetId = "map-sheet-title";

    let bar: ReactNode;
    let sheet: ReactNode;
    if (pick) {
        const scanThen = encodeURIComponent(returnTo ?? "map");
        bar = (
            <div className="wf-bar">
                <IconButton kind="map" icon="arrow-left" label="Quay lại" to={back} />
                <div className="wf-field wf-lift is-strong"><h1 className="wf-t17 wf-ell">Bạn đang ở đâu?</h1></div>
            </div>
        );
        sheet = (
            <Sheet labelledBy={sheetId}>
                <SheetHead id={sheetId} as="h2" title="Chọn một cách" right={<span className="wf-t13">Sai số ước tính</span>} />
                <div>
                    <Row title="Quét mã QR" sub="Trên cột, biển chỉ dẫn" to={`/v/${slug}/scan?then=${scanThen}`} trailing={<span className="wf-t15 wf-row-val">±{positionUncertainty(0, "qr")} m</span>} chevron />
                    <Row title="Chọn điểm gần bạn" sub="Quầy, cửa, cửa hàng" to={`/v/${slug}/search?pick=here&return=${scanThen}`} trailing={<span className="wf-t15 wf-row-val">±{positionUncertainty(0, "place")} m</span>} chevron />
                    <Row title="Chỉ trên bản đồ" sub="Đang chọn, kéo bản đồ" trailing={<><span className="wf-t15 wf-row-val">±{positionUncertainty(0, "pick")} m</span><Lc name="check" size={20} /></>} />
                </div>
                <div className="wf-acts"><Button icon="map-pin" onClick={confirmPick} disabled={!center}>Đặt vị trí ở {floorInSentence(floor)}</Button></div>
            </Sheet>
        );
    } else {
        bar = (
            <div className="wf-bar">
                {mode === "landing" && <IconButton kind="map" icon="arrow-left" label="Về bản đồ" to={`/v/${slug}/map?floor=${floorId}`} replace />}
                <Link to={searchTo} role="search" className="wf-field wf-lift"><Lc name="search" size={20} color="var(--ink)" /><span className="wf-ell">Tìm trong {model.venue.name}</span></Link>
                {mode !== "landing" && <IconButton kind="map" icon="scan-line" label="Quét mã QR định vị" to={`/v/${slug}/scan?then=map`} />}
            </div>
        );
        if (mode === "landing") {
            sheet = landingMissing ? (
                <Sheet labelledBy={sheetId}>
                    <div>
                        <Status icon="triangle-alert" tone="warn">Không tìm thấy tem</Status>
                        <h1 id={sheetId} className="wf-t22" style={{ marginTop: 8 }}>Mã {landingCode} không có trên bản đồ</h1>
                        <p className="wf-t15 wf-muted" style={{ marginTop: 8 }}>Tem có thể đã được thay. Quét tem bên cạnh hoặc chọn chỗ đứng trên bản đồ.</p>
                    </div>
                    <div className="wf-stack">
                        <Button icon="scan-line" to={`/v/${slug}/scan?then=map`} replace>Quét tem khác</Button>
                        <Button variant="secondary" to={`/v/${slug}/map?pick=position&floor=${floorId}`} replace>Định vị cách khác</Button>
                    </div>
                </Sheet>
            ) : (
                <Sheet labelledBy={sheetId}>
                    <SheetHead id={sheetId} title="Bạn đang ở đây"
                        sub={position ? `${clean(building?.name)}, ${floorInSentence(floor)}. Sai số ±${Math.round(positionUncertainty(0, position.source, position.accuracy))} m ước tính` : undefined} />
                    {trip && <Row title={`Đang chỉ đường tới ${trip.to.name}`} sub="Vị trí trên tuyến đã được cập nhật" lead={<Lc name="navigation" size={20} />} />}
                    <div className="wf-stack">
                        {trip
                            ? <Button icon="navigation" to={`/v/${slug}/go`} replace>Tiếp tục chỉ đường</Button>
                            : <Button icon="search" to={searchTo}>Tìm nơi cần đến</Button>}
                    </div>
                </Sheet>
            );
        } else {
            const tiles = counts.slice(0, 4);
            sheet = (
                <Sheet labelledBy={sheetId}>
                    <SheetHead
                        title={<button type="button" className="wf-headbtn" onClick={() => setPicker(true)} aria-haspopup="dialog" aria-label={`${clean(building?.name)}, ${floorFull(floor)}. Đổi toà hoặc tầng`}>
                            <span className="wf-t28 wf-ell">{buildingShort(building?.name) || building?.code}</span><Lc name="chevron-down" size={20} color="var(--muted)" />
                        </button>}
                        id={sheetId} sub={floorFull(floor)}
                        right={<Link to={`/v/${slug}/journeys`} className="wf-chip is-flat"><Lc name="workflow" size={20} />Hành trình</Link>} />
                    {trip && (
                        <Row title={`Đang chỉ đường tới ${trip.to.name}`} sub={`Còn ${Math.max(0, Math.round(trip.route.distance - trip.progress))} m`} lead={<Lc name="navigation" size={20} />}
                            to={`/v/${slug}/go`} chevron />
                    )}
                    {!trip && !position && (
                        <Row title="Bạn đang ở đâu?" sub="Quét QR hoặc chọn trên bản đồ để biết khoảng cách" lead={<Lc name="locate-fixed" size={20} />}
                            to={`/v/${slug}/map?pick=position&floor=${floorId}&return=${encodeURIComponent(`map?floor=${floorId}`)}`} chevron />
                    )}
                    {!trip && position && (
                        <Row title={positionLabel(model, position)} sub={`Vị trí của bạn, sai số ±${Math.round(positionUncertainty(0, position.source, position.accuracy))} m ước tính`} lead={<Lc name="locate-fixed" size={20} />}
                            to={`/v/${slug}/map?pick=position&floor=${position.floorId}&return=${encodeURIComponent(`map?floor=${position.floorId}`)}`} trailing={<span className="wf-t15 wf-row-val">Đổi</span>} />
                    )}
                    {tiles.length > 0 ? (
                        <div className="wf-tiles">
                            {tiles.map(t => {
                                const ui = groupUi(t.code);
                                return (
                                    <Link key={t.code} to={`/v/${slug}/search?group=${t.code}&floor=${floorId}`} className="wf-tile">
                                        <Lc name={ui.icon} size={24} />
                                        <span><span className="wf-t17" style={{ display: "block" }}>{ui.label}</span><span className="wf-t13">{t.count} {ui.unit}</span></span>
                                    </Link>
                                );
                            })}
                        </div>
                    ) : <p className="wf-t15 wf-muted">Tầng này chưa có địa điểm nào trên bản đồ.</p>}
                    {trip && <div className="wf-acts"><Button icon="navigation" to={`/v/${slug}/go`}>Tiếp tục chỉ đường</Button></div>}
                </Sheet>
            );
        }
    }

    const draft = model.venue.status && model.venue.status !== "PUBLISHED";
    return (
        <div className="wf-screen">
            {mode === "preview" && (
                <div className="wf-banner" role="status">
                    <p className="wf-t15"><Lc name="eye" size={20} /><span className="wf-ell">{draft ? "Bản nháp, chưa công khai" : "Xem như khách, đã công khai"}</span></p>
                    <Button variant="secondary" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate(`/v/${slug}`))}>Thoát</Button>
                </div>
            )}
            <div className="wf-maparea">
                <FloorMap model={model} floorId={floorId} places={places} onSelect={onSelect} user={user} accuracy={accuracy} focus={focus}
                    route={trip?.route} activeLeg={trip?.activeLeg} destination={trip?.to} onCenterChange={setCenter} showMarkers={!pick} fitPadding={[136, 40]} />
                {pick && <div className="wf-crosshair" aria-hidden="true"><span /></div>}
                {bar}
                {pick ? (
                    hint && (
                        <div className="wf-float-chip" style={{ top: 76 }}>
                            <span className="wf-chip wf-lift" role="note">
                                <Lc name="hand" size={20} /><span>Kéo bản đồ để đặt dấu ngắm</span>
                                <button type="button" className="wf-ib is-clear" style={{ width: 32, height: 32, marginRight: -8 }} aria-label="Ẩn gợi ý" onClick={() => setHint(false)}><Lc name="x" size={20} /></button>
                            </span>
                        </div>
                    )
                ) : counts.length > 0 && (
                    <nav className="wf-chips" aria-label="Lọc theo danh mục">
                        {counts.map(c => {
                            const ui = groupUi(c.code);
                            return (
                                <button key={c.code} type="button" className="wf-chip wf-lift" aria-pressed={group === c.code} onClick={() => setGroup(group === c.code ? null : c.code)}>
                                    <Lc name={ui.icon} size={20} />{ui.label}<span className="wf-chip-count">{c.count}</span>
                                </button>
                            );
                        })}
                    </nav>
                )}
                <div className="wf-side" style={{ top: pick || counts.length > 0 ? 136 : 84 }}>
                    <FloorSeg model={model} floorId={floorId} onPick={setFloor} />
                    {!pick && <IconButton kind="map-sm" icon="locate-fixed" label={position ? "Về vị trí của bạn" : "Bạn đang ở đâu?"} onClick={locate} />}
                </div>
            </div>
            {sheet}
            {picker && <FloorPicker model={model} floorId={floorId} position={position} onPick={setFloor} onClose={() => setPicker(false)} slug={slug} />}
        </div>
    );
}

/** /v/:slug/preview — "Xem như khách" */
export function PreviewPage() {
    return <MapPage mode="preview" />;
}
