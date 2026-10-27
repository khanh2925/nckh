import { Link, useLocation } from "react-router-dom";
import "@fontsource/familjen-grotesk/600.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "./portal.css";

// Builder (quản trị địa điểm) và Admin (quản trị hệ thống) làm ở đợt 2 — backend v2 đã có sẵn API.
const AREAS: Record<string, { title: string; items: string[] }> = {
    builder: {
        title: "Builder · Quản trị địa điểm",
        items: ["Đăng ký, đăng nhập (JWT)", "Tạo địa điểm, toà nhà, tầng", "Tải và căn chỉnh mặt bằng (2 điểm mốc)", "Điểm quan tâm, vùng, nhập CSV", "Vẽ lối đi, nối tầng, kiểm tra 100% tới được", "Mã QR định vị, mốc camera", "Thử chỉ đường, xuất bản, thống kê"]
    },
    admin: {
        title: "Admin · Quản trị hệ thống",
        items: ["Duyệt tài khoản quản trị địa điểm", "Kiểm duyệt địa điểm xuất bản", "Danh mục loại địa điểm mẫu", "Cấu hình hệ thống, nhật ký"]
    }
};

export default function ComingSoon() {
    const { pathname } = useLocation();
    const area = pathname.startsWith("/admin") ? AREAS.admin! : pathname.startsWith("/builder") || pathname.startsWith("/login") ? AREAS.builder! : null;
    return (
        <div className="cb-page">
            <header className="cb-header"><span className="cb-brand">Indoor Map</span></header>
            <main className="cb-main">
                {area ? (
                    <>
                        <p className="cb-kicker">Đợt 2 · đang xây dựng</p>
                        <h1>{area.title}</h1>
                        <p className="cb-muted">Giao diện web cho khu này sẽ làm ở đợt tiếp theo. Backend Spring Boot v2 đã có API tương ứng (xem docs/knowledge/KI-08_PLATFORM_V2_API.md).</p>
                        <ul className="cb-list">{area.items.map(i => <li key={i}>{i}</li>)}</ul>
                    </>
                ) : (
                    <>
                        <p className="cb-kicker">404</p>
                        <h1>Không có trang này</h1>
                    </>
                )}
                <Link to="/" className="cb-btn">Mở bản đồ cho khách tham quan</Link>
            </main>
        </div>
    );
}
