import { useCallback, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { floorChip, formatMeters, searchPlaces, type LatLng, type Place } from "@indoor-map/core";
import { useModel, useVenue } from "../VenueContext";
import FloorMap, { type MapFocus } from "../components/FloorMap";
import Icon from "../components/Icon";
import { Button, IconButton, Plate } from "../components/ui";

// Bản đồ trong nhà. Chế độ ?pick=position: chọn vị trí của tôi bằng cách kéo bản đồ (dấu ngắm ở giữa).
export default function MapPage() {
    const model = useModel();
    const { slug, position, setPosition, trip: anyTrip, fixPosition } = useVenue();
    const trip = anyTrip && !anyTrip.arrived ? anyTrip : null;
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const pick = params.get("pick") === "position";
    const returnTo = params.get("return");

    const paramFloor = Number(params.get("floor"));
    const floorId = (model.floorsById.has(paramFloor) && paramFloor) || position?.floorId || model.defaultFloor?.id || model.floors[0]!.id;
    const floor = model.floorsById.get(floorId)!;
    const building = model.buildingsById.get(floor.buildingId);
    const [group, setGroup] = useState<string | null>(null);
    const [buildingMenu, setBuildingMenu] = useState(false);
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
    };

    const places = useMemo(
        () => model.locations.filter(l => l.floorId === floorId && (!group || model.typeOf(l.type).groupName === group)),
        [model, floorId, group]
    );
    const nearby = useMemo(() => {
        const near = position && position.floorId === floorId ? position : null;
        return searchPlaces(model, "", { group, floorId: near ? null : floorId, near, limit: 3 });
    }, [model, group, floorId, position]);

    const onSelect = useCallback((place: Place) => navigate(`/v/${slug}/place/${place.id}`), [navigate, slug]);
    const user = trip ? null : position;

    const confirmPick = () => {
        if (!center) return;
        const point = { floorId, lat: center.lat, lng: center.lng, source: "pick" as const, label: "Vị trí chọn trên bản đồ" };
        if (trip) fixPosition(point);
        else setPosition(point);
        navigate(returnTo ? `/v/${slug}/${returnTo}` : `/v/${slug}/map?floor=${floorId}`, { replace: true });
    };

    return (
        <div className="wf-screen">
            <header className="wf-topbar">
                <IconButton icon="back" label="Quay lại" to={pick && returnTo ? `/v/${slug}/${returnTo}` : `/v/${slug}`} />
                <div className="wf-topbar-text">
                    <div className="wf-kicker">{model.venue.name.toUpperCase()}</div>
                    <h1 className="wf-title">{pick ? "Chọn vị trí của bạn" : `${building?.code} · ${floor.name}`}</h1>
                </div>
                <button type="button" className="wf-select-btn" aria-expanded={buildingMenu} aria-haspopup="listbox" onClick={() => setBuildingMenu(o => !o)}>
                    {building?.code} <span aria-hidden="true">▾</span>
                </button>
                {buildingMenu && (
                    <ul className="wf-menu" role="listbox" aria-label="Chọn toà nhà">
                        {model.buildings.map(b => {
                            const first = model.floorsOf(b.id).find(f => f.level === 1) ?? model.floorsOf(b.id)[0];
                            return (
                                <li key={b.id}>
                                    <button type="button" role="option" aria-selected={b.id === building?.id} disabled={!first}
                                        onClick={() => {
                                            setBuildingMenu(false);
                                            if (first) setFloor(first.id);
                                        }}>
                                        <b>{b.code}</b> {b.name}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </header>

            <div className="wf-map-area">
                <FloorMap model={model} floorId={floorId} places={places} onSelect={onSelect} user={user} focus={focus}
                    route={trip?.route} activeLeg={trip?.activeLeg} destination={trip?.to} onCenterChange={setCenter} showMarkers={!pick} />

                {pick && <div className="wf-crosshair" aria-hidden="true"><span /></div>}

                {trip && !pick && (
                    <Link to={`/v/${slug}/go`} className="wf-trip-pill"><span className="wf-dot" />Đang chỉ đường tới <b>{trip.to.name}</b> · tiếp tục</Link>
                )}

                <div className="wf-floor-switch" role="group" aria-label="Chọn tầng">
                    {model.floorsOf(floor.buildingId).map(f => (
                        <button key={f.id} type="button" aria-pressed={f.id === floorId} title={f.name} onClick={() => setFloor(f.id)}>
                            {floorChip(f.level)}
                        </button>
                    ))}
                </div>
                {!pick && (
                    <div className="wf-map-tools is-right">
                        {position && position.floorId === floorId && (
                            <IconButton icon="locate" label="Về vị trí của tôi" size={48} onClick={() => setFocus({ lat: position.lat, lng: position.lng, zoom: 20 })} />
                        )}
                        <IconButton icon="qr" label="Định vị bằng mã QR" to={`/v/${slug}/scan?then=map`} variant="is-live" size={48} />
                    </div>
                )}
            </div>

            {pick ? (
                <div className="wf-sheet">
                    <p className="wf-muted">Kéo bản đồ để dấu ngắm nằm đúng chỗ bạn đứng, đổi tầng nếu cần.</p>
                    <div className="wf-row-actions">
                        <Button to={`/v/${slug}/scan?then=${returnTo ? encodeURIComponent(returnTo) : "map"}`} variant="secondary" full={false} icon="qr">Quét QR</Button>
                        <Button onClick={confirmPick} icon="target" disabled={!center}>Tôi đang ở đây</Button>
                    </div>
                </div>
            ) : (
                <div className="wf-sheet">
                    <span className="wf-grabber" aria-hidden="true" />
                    <Link to={`/v/${slug}/search?floor=${floorId}`} className="wf-search is-link">
                        <span className="wf-search-placeholder">Cửa ra, quầy thủ tục, nhà vệ sinh…</span>
                        <span className="wf-search-icon"><Icon name="search" /></span>
                    </Link>
                    <div className="wf-seg" role="group" aria-label="Lọc theo loại">
                        <button type="button" aria-pressed={group === null} onClick={() => setGroup(null)}>Tất cả</button>
                        {model.groups.map(g => (
                            <button key={g.code} type="button" aria-pressed={group === g.code} onClick={() => setGroup(g.code === group ? null : g.code)}>{g.label}</button>
                        ))}
                    </div>
                    <div className="wf-list">
                        {nearby.map(({ place, meters }) => (
                            <Link key={place.id} to={`/v/${slug}/place/${place.id}`} className="wf-list-row">
                                <Plate place={place} type={model.typeOf(place.type)} size={36} />
                                <span className="wf-list-text">
                                    <b>{place.name}</b>
                                    <small>{model.floorsById.get(place.floorId)?.buildingCode} · {model.floorsById.get(place.floorId)?.name}</small>
                                </span>
                                {meters != null && <span className="wf-figure-sm">{formatMeters(meters)}</span>}
                            </Link>
                        ))}
                        {!position && (
                            <Link to={`/v/${slug}/map?pick=position&floor=${floorId}&return=${encodeURIComponent(`map?floor=${floorId}`)}`} className="wf-list-row is-hint">
                                <Icon name="target" /><span className="wf-list-text"><b>Bạn đang ở đâu?</b><small>Chọn trên bản đồ hoặc quét QR để biết khoảng cách</small></span>
                            </Link>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
