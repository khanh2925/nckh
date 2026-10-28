import { Outlet, useParams } from "react-router-dom";
import { VenueProvider, useVenue } from "./VenueContext";
import { Button, ErrorScreen, Loading, Sheet } from "./components/ui";

/** Khung chờ kiểu Khám phá: thanh tìm, chip, bảng trượt dạng khung xương (Viewer-Error, trạng thái đang tải) */
export function MapSkeleton({ text }: { text?: string }) {
    return (
        <div className="wf-screen">
            <div className="wf-maparea" aria-hidden="true">
                <div className="wf-bar">
                    <div className="wf-field wf-lift"><span className="wf-skel" style={{ height: 14, width: "60%" }} /></div>
                    <div className="wf-mbtn wf-lift" />
                </div>
                <div className="wf-chips">
                    {[120, 104, 112].map(w => <span key={w} className="wf-chip wf-lift" style={{ width: w }} />)}
                </div>
            </div>
            <Sheet label="Đang tải">
                <Loading text={text} />
            </Sheet>
        </div>
    );
}

// Bọc mọi trang /v/:slug/...: tải dữ liệu địa điểm một lần, hiện màn chờ / lỗi, rồi mới vẽ trang con.
function Gate() {
    const { model, error } = useVenue();
    if (error) {
        const notFound = (error as { status?: number }).status === 404;
        const link = window.location.host + window.location.pathname;
        return notFound ? (
            <ErrorScreen status="Không tìm thấy" title="Link này không dẫn tới địa điểm nào" message="Link có thể bị gõ sai, đã cũ hoặc địa điểm chưa xuất bản." back="/"
                block={<div className="wf-card is-white"><p className="wf-t13">Link đã mở</p><p className="wf-t15" style={{ marginTop: 4, wordBreak: "break-all" }}>{link}</p></div>}
                foot={<><Button to="/" icon="search">Tìm địa điểm</Button><Button to="/scan" variant="text">Quét mã QR tại chỗ</Button></>} />
        ) : (
            <ErrorScreen status="Không tải được" icon="wifi-off" title="Chưa mở được bản đồ" message="Kiểm tra kết nối mạng rồi thử lại." back="/"
                foot={<><Button onClick={() => window.location.reload()} icon="refresh-cw">Thử lại</Button><Button to="/" variant="text">Về danh sách địa điểm</Button></>} />
        );
    }
    if (!model) return <MapSkeleton />;
    return <Outlet />;
}

export default function VenueLayout() {
    const { slug = "" } = useParams();
    return (
        <VenueProvider key={slug} slug={slug}>
            <Gate />
        </VenueProvider>
    );
}
