import { Link } from "react-router-dom";
import { useModel, useVenue } from "../VenueContext";
import FloorMap from "../components/FloorMap";
import { Button, IconButton, Row, TopBar } from "../components/ui";
import { buildingShort, clean, floorLabel } from "../format";
import Lc from "../../design/Lc";

// Thông tin địa điểm (Viewer-VenueInfo): ảnh mặt bằng, tên, số toà/tầng/điểm thật, chọn tầng để mở bản đồ.
export default function VenueInfoPage() {
    const model = useModel();
    const { slug, position, trip } = useVenue();
    const venue = model.venue;
    const start = position ? model.floorsById.get(position.floorId) : model.defaultFloor;
    const published = venue.status === "PUBLISHED" || !venue.status;
    const desc = clean(venue.description);

    return (
        <div className="wf-screen">
            <TopBar title={venue.name} back="/" right={<IconButton icon="settings" label="Cài đặt" to="/settings" />} />
            <main className="wf-main">
                <section className="wf-card is-white" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {model.defaultFloor && (
                        <div style={{ height: 160, borderRadius: 16, overflow: "hidden", position: "relative" }} aria-hidden="true">
                            <FloorMap model={model} floorId={model.defaultFloor.id} focus="floor" compact showMarkers={false} fitPadding={[8, 8]} />
                        </div>
                    )}
                    <div>
                        <p className="wf-t13">{published ? "Đã xuất bản" : "Bản nháp, chưa công khai"}</p>
                        <h2 className="wf-t22" style={{ marginTop: 4 }}>{venue.name}</h2>
                        {desc && <p className="wf-t13" style={{ marginTop: 4 }}>{desc}</p>}
                    </div>
                    <div className="wf-stats">
                        <div><p className="wf-t17">{model.buildings.length}</p><p className="wf-t13">toà nhà</p></div>
                        <div><p className="wf-t17">{model.floors.length}</p><p className="wf-t13">tầng</p></div>
                        <div><p className="wf-t17">{model.locations.length}</p><p className="wf-t13">điểm</p></div>
                    </div>
                </section>

                {trip && !trip.arrived ? (
                    <div className="wf-group"><Row lead={<Lc name="navigation" size={20} />} title={`Đang chỉ đường tới ${trip.to.name}`} sub="Tiếp tục" to={`/v/${slug}/go`} chevron /></div>
                ) : (
                    <div className="wf-group"><Row lead={<Lc name="workflow" size={20} />} title="Bạn cần làm gì?" sub="Hành trình dẫn từng bước" to={`/v/${slug}/journeys`} chevron /></div>
                )}

                <section aria-labelledby="vi-floors">
                    <h2 id="vi-floors" className="wf-sec">Chọn tầng</h2>
                    <div className="wf-group">
                        {model.buildings.map(b => {
                            const floors = [...model.floorsOf(b.id)].reverse();
                            if (!floors.length) return null;
                            const current = floors.some(f => f.id === start?.id);
                            return (
                                <div key={b.id} className="wf-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
                                    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                                        <span className="wf-t17" style={{ flex: 1 }}>{clean(b.name)}</span>
                                        {current && <span className="wf-t15" style={{ fontWeight: 600 }}>Đang chọn</span>}
                                    </div>
                                    <div className="wf-floorset">
                                        {floors.map(f => (
                                            <Link key={f.id} to={`/v/${slug}/map?floor=${f.id}`} className={`wf-chip is-text${f.id === start?.id ? " is-on" : " is-flat"}`}>{floorLabel(f)}</Link>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            </main>
            <div className="wf-foot">
                <Button to={`/v/${slug}/map${start ? `?floor=${start.id}` : ""}`}>
                    Mở bản đồ{start ? ` ${start.buildingCode || buildingShort(model.buildingsById.get(start.buildingId)?.name)}, ${floorLabel(start)}` : ""}
                </Button>
            </div>
        </div>
    );
}
