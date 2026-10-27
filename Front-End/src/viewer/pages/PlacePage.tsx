import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { formatMeters, translateHours } from "@indoor-map/core";
import { pushRecent } from "../../lib/settings";
import { useModel, useVenue } from "../VenueContext";
import FloorMap from "../components/FloorMap";
import Icon from "../components/Icon";
import { Button, ErrorBox, IconButton, Plate } from "../components/ui";

export default function PlacePage() {
    const model = useModel();
    const { slug, position, setPosition, planRoute } = useVenue();
    const navigate = useNavigate();
    const { id } = useParams();
    const place = model.locationsById.get(Number(id));
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (place) pushRecent(slug, place.id);
    }, [place, slug]);
    // Có vị trí thì tính tuyến thật để hiện quãng đường, thời gian, số lần đổi tầng
    const planned = useMemo(() => (position && place ? planRoute(position, place) : null), [position, place, planRoute]);
    const route = planned && !("error" in planned) ? planned : null;

    if (!place) {
        return (
            <div className="wf-screen wf-center">
                <ErrorBox title="Không tìm thấy địa điểm" action={<Button to={`/v/${slug}/map`} variant="secondary">Về bản đồ</Button>} />
            </div>
        );
    }

    const type = model.typeOf(place.type);
    const floor = model.floorsById.get(place.floorId)!;
    const building = model.buildingsById.get(floor.buildingId);
    const meters = route ? route.distance : null;

    const share = async () => {
        const url = `${window.location.origin}/v/${slug}/place/${place.id}`;
        try {
            if (navigator.share) await navigator.share({ title: place.name, text: `${place.name} · ${building?.code} ${floor.name}`, url });
            else {
                await navigator.clipboard.writeText(url);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 2000);
            }
        } catch {
            // người dùng huỷ
        }
    };

    return (
        <div className="wf-screen">
            <div className="wf-mini-map">
                <FloorMap model={model} floorId={place.floorId} selectedId={place.id} user={position} focus={{ lat: place.lat, lng: place.lng, zoom: 20 }}
                    onSelect={p => navigate(`/v/${slug}/place/${p.id}`, { replace: true })} />
                <div className="wf-cover-tools">
                    <IconButton icon="back" label="Quay lại" onClick={() => navigate(-1)} />
                    <IconButton icon="share" label={copied ? "Đã sao chép liên kết" : "Chia sẻ địa điểm"} onClick={share} />
                </div>
            </div>

            <main className="wf-body is-scroll">
                <div className="wf-place-head">
                    <Plate place={place} type={type} size={72} />
                    <div>
                        <div className="wf-kicker">{type.name.toUpperCase()}</div>
                        <h1 className="wf-h1">{place.name}</h1>
                        <div className="wf-muted">{building?.name} · {floor.name}</div>
                    </div>
                </div>

                <div className="wf-figures is-light">
                    <div><b>{meters != null ? formatMeters(meters).replace(/ (m|km)$/, "") : "—"}</b><span>{meters != null ? (meters >= 1000 ? "km từ bạn" : "m từ bạn") : position ? "chưa có lối đi" : "chưa biết vị trí"}</span></div>
                    <div><b>{route ? Math.max(1, Math.round(route.seconds / 60)) : "—"}</b><span>phút đi bộ</span></div>
                    <div><b>{route ? route.legs.length - 1 : "—"}</b><span>lần đổi tầng</span></div>
                </div>

                <dl className="wf-facts">
                    {place.area && <><dt>Khu vực</dt><dd>{place.area}</dd></>}
                    {place.openingHours && <><dt><Icon name="clock" size={16} /> Giờ mở</dt><dd>{translateHours(place.openingHours)}</dd></>}
                    {place.phone && <><dt><Icon name="phone" size={16} /> Điện thoại</dt><dd><a href={`tel:${place.phone.replace(/\s+/g, "")}`}>{place.phone}</a></dd></>}
                    {place.website && <><dt><Icon name="globe" size={16} /> Website</dt><dd><a href={/^https?:/.test(place.website) ? place.website : `https://${place.website}`} target="_blank" rel="noreferrer">{place.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}</a></dd></>}
                    {place.facilities?.length ? <><dt>Tiện ích</dt><dd className="wf-tags">{place.facilities.map(f => <span key={f}>{f}</span>)}</dd></> : null}
                </dl>
                {place.description && <p className="wf-desc">{place.description}</p>}
                {place.imageUrl && <img className="wf-photo" src={place.imageUrl} alt={`Ảnh ${place.name}`} loading="lazy" />}
                {!position && (
                    <button type="button" className="wf-link-btn" onClick={() => setPosition({ floorId: place.floorId, lat: place.lat, lng: place.lng, source: "place", label: place.name, placeId: place.id })}>
                        Tôi đang đứng ở đây
                    </button>
                )}
            </main>

            <footer className="wf-actions">
                <Button icon="arrive" to={`/v/${slug}/route?to=${place.id}`}>Chỉ đường tới đây</Button>
                <Link className="wf-btn wf-btn-secondary" to={`/v/${slug}/map?floor=${place.floorId}&lat=${place.lat}&lng=${place.lng}`}>Bản đồ</Link>
            </footer>
        </div>
    );
}
