import { HeaderActions } from "../../console/Shell";
import { Button, NotYet } from "../../console/ui";
import { GuestLink } from "../FloorList";
import { useWorkspace } from "../Workspace";
import "./workspace.css";

// Khác biệt bản nháp với bản công khai. Backend chưa tách bản nháp và bản công khai (lưu là hiện cho khách ngay,
// không lưu phiên bản), nên chưa có gì để so: hiện khung trống theo thiết kế kèm "Chưa khả dụng", không giả số liệu.
export default function DiffPage() {
    const { venueId, data } = useWorkspace();
    const base = `/builder/v/${venueId}`;
    return (
        <div className="k-page">
            <HeaderActions><GuestLink venue={data.venue} /></HeaderActions>
            <div className="k-title">
                <h1 className="k24">Khác biệt bản nháp</h1>
                <div className="k-acts"><Button variant="primary" to={`${base}/publish`}>Về Xuất bản</Button></div>
            </div>
            <section aria-label="Danh sách thay đổi" className="k-card ws-empty">
                <h2 className="k16">Chưa so được bản nháp với bản công khai</h2>
                <p className="k14 k-m">Thay đổi điểm, lối đi, mã QR hay tầng sẽ hiện ở đây.</p>
                <div style={{ maxWidth: 520, textAlign: "left" }}>
                    <NotYet>Backend chưa lưu phiên bản xuất bản, mọi chỉnh sửa hiện cho khách ngay khi lưu nên chưa có bản công khai riêng để so sánh.</NotYet>
                </div>
                <div className="ws-mt8"><Button to={`${base}/editor`}>Mở Điểm và vùng</Button></div>
            </section>
        </div>
    );
}
