import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatMeters, positionUncertainty } from "@indoor-map/core";
import { useModel, useVenue } from "../VenueContext";
import { Button, Option, Row, Toggle, TopBar, Unavailable } from "../components/ui";
import { positionLabel } from "../format";

const KINDS = ["Lối bị chặn", "Chỉ sai hướng", "Điểm sai vị trí", "Khác"] as const;

// Báo sai đường (Viewer-Report): khung form theo thiết kế, nhưng máy chủ chưa có chỗ nhận báo cáo.
// Nút Gửi tắt, ghi rõ "Chưa khả dụng"; không gửi gì, không báo thành công giả.
export default function ReportPage() {
    const model = useModel();
    const { slug, position, trip } = useVenue();
    const navigate = useNavigate();
    const [kind, setKind] = useState<(typeof KINDS)[number]>(KINDS[0]);
    const [note, setNote] = useState("");
    const [withPos, setWithPos] = useState(true);
    const [withRoute, setWithRoute] = useState(true);
    const here = trip && !trip.arrived ? null : position;

    return (
        <div className="wf-screen">
            <TopBar title="Báo sai đường" onBack={() => (window.history.length > 1 ? navigate(-1) : navigate(`/v/${slug}/map`))} />
            <main className="wf-main">
                <Unavailable>Máy chủ chưa có chỗ nhận báo cáo, nên chưa gửi được. Bạn có thể báo trực tiếp cho quầy thông tin của {model.venue.name}.</Unavailable>
                <section aria-labelledby="rp-kind">
                    <h2 id="rp-kind" className="wf-sec">Sai ở đâu?</h2>
                    <div className="wf-group" role="radiogroup" aria-labelledby="rp-kind">
                        {KINDS.map(k => <Option key={k} title={k} checked={kind === k} onSelect={() => setKind(k)} />)}
                    </div>
                </section>
                <section aria-labelledby="rp-note">
                    <h2 id="rp-note" className="wf-sec"><label htmlFor="rp-text">Ghi chú, tuỳ chọn</label></h2>
                    <textarea id="rp-text" className="wf-input" style={{ background: "var(--surface)" }} value={note} onChange={e => setNote(e.target.value)} placeholder="Ví dụ: cửa kính đóng, phải đi vòng" />
                </section>
                {(here || trip) && (
                    <section aria-labelledby="rp-attach">
                        <h2 id="rp-attach" className="wf-sec">Gửi kèm</h2>
                        <div className="wf-group">
                            {here && <Row titleId="rp-pos" title="Vị trí ước tính" sub={`${positionLabel(model, here)}, ±${positionUncertainty(0, here.source)} m`} trailing={<Toggle labelledBy="rp-pos" checked={withPos} onChange={setWithPos} />} />}
                            {trip && <Row titleId="rp-route" title="Tuyến đang đi" sub={`${positionLabel(model, trip.from)} tới ${trip.to.name}, ${formatMeters(trip.route.distance)}`} trailing={<Toggle labelledBy="rp-route" checked={withRoute} onChange={setWithRoute} />} />}
                        </div>
                    </section>
                )}
            </main>
            <div className="wf-foot">
                <Button disabled>Gửi</Button>
                <p className="wf-t13">Chưa khả dụng, chưa có gì được gửi đi.</p>
            </div>
        </div>
    );
}
