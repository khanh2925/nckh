import { useNavigate } from "react-router-dom";
import Lc from "../../design/Lc";
import { useModel, useVenue } from "../VenueContext";
import { Button, Row, TopBar, Unavailable } from "../components/ui";

// Hành trình nhiều bước (Viewer-Journeys, Viewer-JourneyRun): máy chủ chưa có quy trình cho khách.
// Giữ khung màn theo thiết kế, nói rõ "Chưa khả dụng", không có quy trình hay số liệu giả.
export default function JourneysPage() {
    const model = useModel();
    const { slug } = useVenue();
    const navigate = useNavigate();
    return (
        <div className="wf-screen">
            <TopBar title="Bạn cần làm gì?" onBack={() => (window.history.length > 1 ? navigate(-1) : navigate(`/v/${slug}/map`))} />
            <main className="wf-main">
                <Unavailable>
                    Hành trình dẫn từng bước (ví dụ thủ tục, an ninh, rồi tới cửa ra) cần máy chủ lưu các quy trình do {model.venue.name} soạn.
                    Máy chủ chưa có phần này nên chưa có hành trình nào để chọn.
                </Unavailable>
                <section aria-labelledby="jr-other">
                    <h2 id="jr-other" className="wf-sec">Bạn vẫn có thể</h2>
                    <div className="wf-group">
                        <Row lead={<Lc name="search" size={20} />} title="Tìm điểm cần đến" sub="Chỉ đường tới từng nơi một" to={`/v/${slug}/search`} chevron />
                        <Row lead={<Lc name="scan-line" size={20} />} title="Quét mã QR định vị" sub="Biết chính xác bạn đang ở đâu" to={`/v/${slug}/scan?then=map`} chevron />
                    </div>
                </section>
            </main>
            <div className="wf-foot"><Button to={`/v/${slug}/map`}>Về bản đồ</Button></div>
        </div>
    );
}
