import { Link, Outlet, useParams } from "react-router-dom";
import { VenueProvider, useVenue } from "./VenueContext";
import { ErrorBox, Loading } from "./components/ui";

// Bọc mọi trang /v/:slug/...: tải dữ liệu địa điểm một lần, hiện màn chờ / lỗi, rồi mới vẽ trang con.
function Gate() {
    const { model, error } = useVenue();
    if (error) {
        return (
            <div className="wf-screen wf-center">
                <ErrorBox title={(error as { status?: number }).status === 404 ? "Không tìm thấy địa điểm" : "Không tải được bản đồ"}
                    action={<Link className="wf-btn wf-btn-secondary" to="/">Về danh sách địa điểm</Link>}>
                    {(error as { status?: number }).status === 404
                        ? "Địa điểm này chưa xuất bản hoặc đường dẫn bị sai."
                        : "Kiểm tra kết nối mạng rồi thử lại."}
                </ErrorBox>
            </div>
        );
    }
    if (!model) return <div className="wf-screen wf-center"><Loading /></div>;
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
