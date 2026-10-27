import { Link } from "react-router-dom";
import { floorChip } from "@indoor-map/core";
import { useModel, useVenue } from "../VenueContext";
import FloorMap from "../components/FloorMap";
import { Button, IconButton, SectionKicker } from "../components/ui";

const KIND_LABEL: Record<string, string> = {
    airport: "SÂN BAY", hospital: "BỆNH VIỆN", school: "TRƯỜNG HỌC", mall: "TRUNG TÂM THƯƠNG MẠI", park: "CÔNG VIÊN", office: "VĂN PHÒNG"
};

function updatedText(iso?: string): string {
    if (!iso) return "";
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
    if (Number.isNaN(days)) return "";
    if (days <= 0) return "cập nhật hôm nay";
    return `cập nhật ${days} ngày trước`;
}

export default function VenueInfoPage() {
    const model = useModel();
    const { slug, position, trip } = useVenue();
    const venue = model.venue;
    const start = position ? model.floorsById.get(position.floorId) : model.defaultFloor;

    return (
        <div className="wf-screen">
            <div className="wf-cover">
                {model.defaultFloor && <FloorMap model={model} floorId={model.defaultFloor.id} focus="floor" compact showMarkers={false} />}
                <div className="wf-cover-tools">
                    <IconButton icon="back" label="Danh sách địa điểm" to="/" />
                    <IconButton icon="gear" label="Cài đặt" to="/settings" />
                </div>
                <div className="wf-cover-badge"><span className="wf-dot" />{venue.status === "PUBLISHED" ? "ĐÃ XUẤT BẢN" : "BẢN NHÁP"}{updatedText(venue.updatedAt) && ` · ${updatedText(venue.updatedAt).toUpperCase()}`}</div>
            </div>

            <section className="wf-panel">
                <div className="wf-kicker">{KIND_LABEL[venue.kind ?? ""] ?? "ĐỊA ĐIỂM"}</div>
                <h1 className="wf-h1">{venue.name}</h1>
                {venue.description && <p className="wf-muted">{venue.description}</p>}
                {venue.ownerName && <p className="wf-muted">Bản đồ do {venue.ownerName} quản lý</p>}
            </section>

            <div className="wf-figures">
                <div><b>{model.buildings.length}</b><span>toà nhà</span></div>
                <div><b>{model.floors.length}</b><span>tầng</span></div>
                <div><b>{model.locations.length}</b><span>địa điểm</span></div>
            </div>

            <main className="wf-body">
                {trip && (
                    <Link to={`/v/${slug}/go`} className="wf-card wf-live-card">
                        <span className="wf-dot" />
                        <span>Đang chỉ đường tới <b>{trip.to.name}</b></span>
                        <span className="wf-link">Tiếp tục →</span>
                    </Link>
                )}
                <SectionKicker>Toà nhà · chọn tầng để mở</SectionKicker>
                <div className="wf-table">
                    {model.buildings.map(b => (
                        <div key={b.id} className="wf-row">
                            <div className="wf-row-title">{b.code} · {b.name.replace(/^Nhà ga T\d\s*·\s*/, "")}</div>
                            <div className="wf-chips">
                                {model.floorsOf(b.id).slice().reverse().map(f => (
                                    <Link key={f.id} to={`/v/${slug}/map?floor=${f.id}`} className={`wf-chip-sq${f.id === start?.id ? " is-on" : ""}`} title={f.name}>
                                        {floorChip(f.level)}
                                    </Link>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
                <div className="wf-note">
                    <b>Chỉ đường bằng camera</b> — thử nghiệm: mũi tên theo la bàn và bước chân, căn lại bằng mã QR.
                </div>
            </main>

            <footer className="wf-actions">
                <Button to={`/v/${slug}/scan`} variant="secondary" full={false} icon="qr">Quét QR</Button>
                <Button to={`/v/${slug}/map${start ? `?floor=${start.id}` : ""}`} icon="layers">Mở bản đồ{start ? ` ${start.buildingCode} · ${floorChip(start.level)}` : ""}</Button>
            </footer>
        </div>
    );
}
