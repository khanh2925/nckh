import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type * as Leaflet from "leaflet";
import { distance, normalizeText, type LatLng, type VenueDto } from "@indoor-map/core";
import L from "../../lib/leaflet";
import { api } from "../../lib/data";
import Lc from "../../design/Lc";
import { ErrorBox, IconButton, Loading, Row, Sheet } from "../components/ui";
import { MAP, lucideSvg } from "../mapTheme";

// Chọn địa điểm (Main): bản đồ khuôn viên phẳng, mỗi địa điểm đã xuất bản là vùng bao + ô biển; bảng trượt là danh sách.
function VenuesMap({ venues, me }: { venues: VenueDto[]; me: LatLng | null }) {
    const box = useRef<HTMLDivElement>(null);
    const mapRef = useRef<Leaflet.Map | null>(null);
    const layer = useRef<Leaflet.LayerGroup | null>(null);

    useEffect(() => {
        if (!box.current) return undefined;
        const map = L.map(box.current, { zoomControl: false, attributionControl: true, center: [10.8165, 106.66], zoom: 13, rotateControl: false });
        map.attributionControl?.setPrefix(false);
        L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
            subdomains: "abcd", maxZoom: 20, className: "wf-tiles-base", attribution: "&copy; OpenStreetMap &copy; CARTO"
        }).addTo(map);
        layer.current = L.layerGroup().addTo(map);
        mapRef.current = map;
        return () => {
            map.remove();
            mapRef.current = null;
        };
    }, []);

    useEffect(() => {
        const map = mapRef.current;
        const group = layer.current;
        if (!map || !group) return;
        group.clearLayers();
        const points: Leaflet.LatLng[] = [];
        venues.forEach(v => {
            if (v.centerLat == null || v.centerLng == null) return;
            const at = L.latLng(v.centerLat, v.centerLng);
            points.push(at);
            if (v.outline?.length) group.addLayer(L.polygon(v.outline, { color: MAP.graphite, weight: 2, fillColor: MAP.graphite, fillOpacity: 0.08, interactive: false }));
            const el = document.createElement("span");
            el.className = "wf-venue-pin";
            el.innerHTML = `<span class="wf-pin">${lucideSvg("map-pin", 14, MAP.surface, 2)}</span>`;
            el.appendChild(document.createTextNode(v.name));
            group.addLayer(L.marker(at, { icon: L.divIcon({ className: "", html: el, iconSize: [0, 0], iconAnchor: [0, 0] }), interactive: false }));
        });
        if (me) {
            const el = document.createElement("span");
            el.className = "wf-user";
            el.style.width = "40px";
            el.style.height = "40px";
            el.innerHTML = '<span class="wf-user-dot"></span>';
            group.addLayer(L.marker([me.lat, me.lng], { icon: L.divIcon({ className: "", html: el, iconSize: [40, 40], iconAnchor: [20, 20] }), interactive: false }));
            points.push(L.latLng(me.lat, me.lng));
        }
        if (points.length === 1) map.setView(points[0]!, 15);
        else if (points.length > 1) map.fitBounds(L.latLngBounds(points), { paddingTopLeft: [40, 100], paddingBottomRight: [40, 40], maxZoom: 15 });
    }, [venues, me]);

    return <div ref={box} className="wf-map" />;
}

export default function HomePage() {
    const [venues, setVenues] = useState<VenueDto[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState("");
    const [me, setMe] = useState<LatLng | null>(null);
    const [locating, setLocating] = useState(false);

    useEffect(() => {
        api.fetchVenues()
            .then(list => setVenues(list.filter(v => !v.status || v.status === "PUBLISHED")))
            .catch(() => setError("Không tải được danh sách địa điểm"));
    }, []);

    const locate = () => {
        if (!navigator.geolocation) return;
        setLocating(true);
        navigator.geolocation.getCurrentPosition(
            p => {
                setMe({ lat: p.coords.latitude, lng: p.coords.longitude });
                setLocating(false);
            },
            () => setLocating(false),
            { enableHighAccuracy: false, timeout: 8000 }
        );
    };

    const list = useMemo(() => {
        const words = normalizeText(query);
        const items = (venues ?? [])
            .filter(v => !words || normalizeText(`${v.name} ${v.description ?? ""}`).includes(words))
            .map(v => ({ v, m: me && v.centerLat != null && v.centerLng != null ? distance(me, { lat: v.centerLat, lng: v.centerLng }) : null }));
        if (me) items.sort((a, b) => (a.m ?? Infinity) - (b.m ?? Infinity));
        return items;
    }, [venues, query, me]);

    const facts = (v: VenueDto) => [
        v.buildingCount != null ? `${v.buildingCount} toà nhà` : null,
        v.floorCount != null ? `${v.floorCount} tầng` : null,
        v.locationCount != null ? `${v.locationCount} điểm` : null
    ].filter(Boolean).join(", ");

    return (
        <div className="wf-screen">
            <div className="wf-maparea">
                {venues && <VenuesMap venues={venues} me={me} />}
                <div className="wf-bar">
                    <label role="search" className="wf-field wf-lift">
                        <Lc name="search" size={20} color="var(--ink)" />
                        <span className="sr-only">Tìm địa điểm</span>
                        <input type="search" enterKeyHint="search" autoComplete="off" value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm địa điểm" />
                    </label>
                    <IconButton kind="map" icon="scan-line" label="Quét mã QR tại địa điểm" to="/scan" />
                </div>
                <div className="wf-side is-top">
                    <IconButton kind="map-sm" icon="locate-fixed" label={locating ? "Đang lấy vị trí" : "Xếp theo vị trí của tôi"} onClick={locate} disabled={locating} />
                    <IconButton kind="map-sm" icon="settings" label="Cài đặt" to="/settings" />
                </div>
            </div>
            <Sheet labelledBy="home-t">
                <div>
                    <h1 id="home-t" className="wf-t28">Chọn địa điểm</h1>
                    {venues && <p className="wf-t13" style={{ marginTop: 4 }}>{venues.length} địa điểm{me ? ", gần bạn trước" : ""}</p>}
                </div>
                {error && <ErrorBox status="Không tải được" title={error}>Kiểm tra kết nối mạng rồi tải lại trang.</ErrorBox>}
                {!venues && !error && <Loading text="Đang tải danh sách…" />}
                {venues && list.length === 0 && <p className="wf-t15 wf-muted">Không có địa điểm khớp “{query}”.</p>}
                {list.length > 0 && (
                    <div>
                        {list.map(({ v, m }) => (
                            <Row key={v.id} title={v.name} sub={facts(v) || undefined} to={`/v/${v.slug}`}
                                trailing={m != null ? <span className="wf-t15 wf-row-val">{m >= 1000 ? `${(m / 1000).toFixed(1).replace(".", ",")} km` : `${Math.round(m)} m`}</span> : undefined} chevron />
                        ))}
                    </div>
                )}
                <Link to="/builder" className="wf-t13" style={{ textDecoration: "underline", textUnderlineOffset: 3 }}>Bạn quản lý một toà nhà? Dựng bản đồ với Builder</Link>
            </Sheet>
        </div>
    );
}
