import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { formatMeters, positionUncertainty, translateHours } from "@indoor-map/core";
import Lc from "../../design/Lc";
import { pushRecent } from "../../lib/settings";
import { useModel, useVenue } from "../VenueContext";
import FloorMap from "../components/FloorMap";
import { Button, ErrorScreen, IconButton, Row, Sheet, Status } from "../components/ui";
import { clean, floorChangeText, floorFull, floorShort, minutesOf, positionLabel } from "../format";

export default function PlacePage() {
    const model = useModel();
    const { slug, position, setPosition, planRoute } = useVenue();
    const navigate = useNavigate();
    const { id } = useParams();
    const place = model.locationsById.get(Number(id));
    const [copied, setCopied] = useState(false);
    const [viewFloor, setViewFloor] = useState<number | null>(null);

    useEffect(() => {
        if (place) pushRecent(slug, place.id);
    }, [place, slug]);
    // Có vị trí thì tính tuyến thật để hiện quãng đường, thời gian, số lần đổi tầng
    const planned = useMemo(() => (position && place ? planRoute(position, place) : null), [position, place, planRoute]);
    const route = planned && !("error" in planned) ? planned : null;

    if (!place) {
        return (
            <ErrorScreen status="Không tìm thấy" title="Điểm này không còn trên bản đồ" message="Có thể điểm đã bị xoá hoặc đổi tên." back={`/v/${slug}/map`}
                headerTitle={model.venue.name} foot={<Button to={`/v/${slug}/search`} icon="search">Tìm địa điểm</Button>} />
        );
    }

    const type = model.typeOf(place.type);
    const floor = model.floorsById.get(place.floorId)!;
    const shownFloor = viewFloor ?? place.floorId;
    const floors = model.floorsOf(floor.buildingId);
    const changes = route ? floorChangeText(route) : null;
    const here = encodeURIComponent(`place/${place.id}`);

    const share = async () => {
        const url = `${window.location.origin}/v/${slug}/place/${place.id}`;
        try {
            if (navigator.share) await navigator.share({ title: place.name, text: `${place.name}, ${floor.buildingCode} ${floorFull(floor)}`, url });
            else {
                await navigator.clipboard.writeText(url);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 2000);
            }
        } catch {
            // người dùng huỷ
        }
    };

    const website = place.website ? (/^https?:/.test(place.website) ? place.website : `https://${place.website}`) : null;

    return (
        <div className="wf-screen">
            <div className="wf-maparea">
                <FloorMap model={model} floorId={shownFloor} selectedId={place.id} user={position} accuracy={position ? positionUncertainty(0, position.source, position.accuracy) : null}
                    focus={shownFloor === place.floorId ? { lat: place.lat, lng: place.lng, zoom: 20 } : "floor"} fitPadding={[84, 40]}
                    onSelect={p => navigate(`/v/${slug}/place/${p.id}`, { replace: true })} />
                <div className="wf-bar">
                    <IconButton kind="map" icon="arrow-left" label="Quay lại" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate(`/v/${slug}/map`))} />
                    <Link to={`/v/${slug}/search`} role="search" className="wf-field wf-lift is-strong"><Lc name="search" size={20} /><span className="wf-ell">{place.name}</span></Link>
                </div>
                <div className="wf-side is-top">
                    {floors.length > 1 && (
                        <div className="wf-seg wf-lift" role="group" aria-label="Chọn tầng">
                            {floors.map(f => (
                                <button key={f.id} type="button" aria-pressed={f.id === shownFloor} aria-label={floorFull(f)} title={floorFull(f)} onClick={() => setViewFloor(f.id)}>{floorShort(f.level)}</button>
                            ))}
                        </div>
                    )}
                    <IconButton kind="map-sm" icon="locate-fixed" label={position ? "Về vị trí của bạn" : "Bạn đang ở đâu?"}
                        to={position ? undefined : `/v/${slug}/map?pick=position&floor=${place.floorId}&return=${here}`}
                        onClick={position ? () => setViewFloor(position.floorId) : undefined} />
                </div>
            </div>

            <Sheet labelledBy="pl-title">
                <div>
                    <h1 id="pl-title" className="wf-t28">{place.name}</h1>
                    <p className="wf-t13" style={{ marginTop: 4 }}>{[type.name, floorFull(floor), clean(place.area)].filter(Boolean).join(", ")}</p>
                </div>

                {route && changes && (
                    <div className="wf-stats is-plain">
                        <div><p className="wf-t17">{formatMeters(route.distance)}</p><p className="wf-t13">quãng đường</p></div>
                        <div><p className="wf-t17">{minutesOf(route.seconds)} phút</p><p className="wf-t13">đi bộ</p></div>
                        <div><p className="wf-t17">{changes.value}</p><p className="wf-t13">{changes.label}</p></div>
                    </div>
                )}
                {planned && "error" in planned && <Status icon="triangle-alert" tone="warn">{planned.error}</Status>}

                {position ? (
                    <Row title={`Từ ${positionLabel(model, position)}`} sub={`Sai số ±${Math.round(positionUncertainty(0, position.source, position.accuracy))} m ước tính`}
                        trailing={<Link className="wf-link wf-t15" to={`/v/${slug}/map?pick=position&floor=${position.floorId}&return=${here}`}>Đổi vị trí</Link>} />
                ) : (
                    <Row title="Bạn đang ở đâu?" sub="Để biết quãng đường và thời gian đi" lead={<Lc name="locate-fixed" size={20} />}
                        to={`/v/${slug}/map?pick=position&floor=${place.floorId}&return=${here}`} chevron />
                )}

                <dl className="wf-dl">
                    {place.area && <div className="wf-kv"><dt>Khu vực</dt><dd>{clean(place.area)}</dd></div>}
                    {place.openingHours && <div className="wf-kv"><dt>Giờ mở</dt><dd>{translateHours(place.openingHours)}</dd></div>}
                    {place.phone && <div className="wf-kv"><dt>Điện thoại</dt><dd><a href={`tel:${place.phone.replace(/\s+/g, "")}`}>{place.phone}</a></dd></div>}
                    {website && <div className="wf-kv"><dt>Website</dt><dd><a href={website} target="_blank" rel="noreferrer">{website.replace(/^https?:\/\//, "").replace(/\/$/, "")}</a></dd></div>}
                    {place.facilities?.length ? <div className="wf-kv"><dt>Tiện ích</dt><dd>{place.facilities.join(", ")}</dd></div> : null}
                </dl>
                {place.description && <p className="wf-t15 wf-muted">{clean(place.description)}</p>}
                {place.imageUrl && <img className="wf-photo" src={place.imageUrl} alt={`Ảnh ${place.name}`} loading="lazy" />}
                {!position && (
                    <Button variant="text" onClick={() => setPosition({ floorId: place.floorId, lat: place.lat, lng: place.lng, source: "place", label: place.name, placeId: place.id })}>
                        Tôi đang đứng ở đây
                    </Button>
                )}

                <div className="wf-acts">
                    <Button icon="navigation" to={`/v/${slug}/route?to=${place.id}`}>Chỉ đường tới đây</Button>
                    <Button variant="secondary" square icon={copied ? "check" : "share"} label={copied ? "Đã sao chép liên kết" : "Chia sẻ địa điểm"} onClick={() => void share()} />
                </div>
            </Sheet>
        </div>
    );
}
