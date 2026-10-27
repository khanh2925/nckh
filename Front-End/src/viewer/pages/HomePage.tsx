import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type * as Leaflet from "leaflet";
import { distance, normalizeText, type LatLng, type VenueDto } from "@indoor-map/core";
import L from "../../lib/leaflet";
import { api } from "../../lib/data";
import Icon from "../components/Icon";
import { ErrorBox, IconButton, Loading, SectionKicker } from "../components/ui";

const KIND_LABEL: Record<string, string> = {
    airport: "Sân bay", hospital: "Bệnh viện", school: "Trường học", mall: "Trung tâm thương mại", park: "Công viên", office: "Văn phòng", other: "Địa điểm"
};

// Bản đồ ngoài trời nhỏ: mỗi địa điểm là một biển vuông tại tâm
function VenuesMap({ venues, me }: { venues: VenueDto[]; me: LatLng | null }) {
    const box = useRef<HTMLDivElement>(null);
    const mapRef = useRef<Leaflet.Map | null>(null);
    const layer = useRef<Leaflet.LayerGroup | null>(null);

    useEffect(() => {
        if (!box.current) return undefined;
        const map = L.map(box.current, { zoomControl: false, attributionControl: true, center: [10.8165, 106.66], zoom: 13, rotateControl: false });
        L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
            subdomains: "abcd", maxZoom: 20, attribution: "&copy; OpenStreetMap &copy; CARTO"
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
            if (v.outline?.length) group.addLayer(L.polygon(v.outline, { color: "#2A54E8", weight: 2, fillOpacity: 0.1, interactive: false }));
            const el = document.createElement("span");
            el.className = "wf-venue-pin";
            el.textContent = v.name;
            group.addLayer(L.marker(at, { icon: L.divIcon({ className: "", html: el, iconSize: [0, 0], iconAnchor: [0, 0] }), interactive: false }));
        });
        if (me) {
            const el = document.createElement("span");
            el.className = "wf-user";
            el.innerHTML = '<span class="wf-user-dot"></span>';
            group.addLayer(L.marker([me.lat, me.lng], { icon: L.divIcon({ className: "", html: el, iconSize: [64, 64], iconAnchor: [32, 32] }), interactive: false }));
            points.push(L.latLng(me.lat, me.lng));
        }
        if (points.length === 1) map.setView(points[0]!, 15);
        else if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 15 });
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
            .catch(() => setError("Không tải được danh sách địa điểm."));
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
            .map(v => ({ v, km: me && v.centerLat != null && v.centerLng != null ? distance(me, { lat: v.centerLat, lng: v.centerLng }) : null }));
        if (me) items.sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity));
        return items;
    }, [venues, query, me]);

    return (
        <div className="wf-screen">
            <header className="wf-topbar wf-brandbar">
                <div className="wf-brand">INDOOR MAP</div>
                <div className="wf-status"><span className="wf-dot" />{venues ? `${venues.length} địa điểm` : "Đang tải…"}</div>
                <IconButton icon="gear" label="Cài đặt" to="/settings" />
            </header>

            <div className="wf-hero-map">
                {venues && <VenuesMap venues={venues} me={me} />}
                <div className="wf-map-tools is-right">
                    <IconButton icon="locate" label={locating ? "Đang lấy vị trí…" : "Sắp xếp theo vị trí của tôi"} onClick={locate} disabled={locating} size={48} />
                </div>
            </div>

            <main className="wf-body">
                <div className="wf-heading-row">
                    <h2 className="wf-h1">Chọn địa điểm</h2>
                    <span className="wf-muted">{me ? "gần bạn trước" : "theo tên"}</span>
                </div>
                <label className="wf-search">
                    <span className="sr-only">Tìm địa điểm</span>
                    <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Tên sân bay, bệnh viện, trường…" />
                    <span className="wf-search-icon"><Icon name="search" /></span>
                </label>

                {error && <ErrorBox title={error}>Kiểm tra kết nối mạng rồi tải lại trang.</ErrorBox>}
                {!venues && !error && <Loading text="Đang tải danh sách…" />}
                {venues && list.length === 0 && <p className="wf-muted">Không có địa điểm khớp “{query}”.</p>}

                <div className="wf-stack">
                    {list.map(({ v, km }) => (
                        <Link key={v.id} to={`/v/${v.slug}`} className="wf-card wf-venue-card">
                            <div className="wf-venue-text">
                                <div className="wf-kicker">
                                    {(KIND_LABEL[v.kind ?? "other"] ?? "Địa điểm").toUpperCase()}
                                    {v.buildingCount != null && ` · ${v.buildingCount} toà nhà`}{v.floorCount != null && ` · ${v.floorCount} tầng`}
                                </div>
                                <div className="wf-card-title">{v.name}</div>
                                <div className="wf-muted">{v.locationCount ?? 0} địa điểm · chỉ đường đa tầng</div>
                            </div>
                            <div className="wf-venue-figure">
                                {km != null ? <><b>{km >= 1000 ? (km / 1000).toFixed(1).replace(".", ",") : Math.round(km)}</b><span>{km >= 1000 ? "km" : "m"}</span></> : <Icon name="building" size={26} />}
                            </div>
                        </Link>
                    ))}
                </div>

                <Link to="/scan" className="wf-card wf-hint-card">
                    <Icon name="qr" />
                    <span>Đang đứng trong toà nhà? <b>Quét mã QR định vị</b> dán trên cột để mở đúng tầng và vị trí.</span>
                </Link>
                <SectionKicker>Bạn quản lý một toà nhà?</SectionKicker>
                <Link to="/builder" className="wf-link">Tự dựng bản đồ trong nhà cho địa điểm của bạn →</Link>
                <p className="wf-footnote">{api.source === "static" ? "Dữ liệu: bản chụp tĩnh" : "Dữ liệu: máy chủ"}{me ? " · đang dùng vị trí GPS để sắp xếp" : ""}</p>
            </main>
        </div>
    );
}
