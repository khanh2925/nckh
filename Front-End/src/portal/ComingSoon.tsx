import { Link } from "react-router-dom";
import "@fontsource/familjen-grotesk/600.css";
import "@fontsource/ibm-plex-sans/400.css";
import "./portal.css";

// Trang 404
export default function ComingSoon() {
    return (
        <div className="cb-page">
            <header className="cb-header"><span className="cb-brand">Indoor Map</span></header>
            <main className="cb-main">
                <p className="cb-kicker">404</p>
                <h1>Không có trang này</h1>
                <p className="cb-muted">Đường dẫn có thể đã đổi. Khách tham quan mở bản đồ ở trang chủ; chủ địa điểm đăng nhập để dựng bản đồ.</p>
                <div style={{ display: "flex", gap: 10 }}>
                    <Link to="/" className="cb-btn">Mở bản đồ</Link>
                    <Link to="/login" className="cb-btn" style={{ background: "#fff", color: "#1E2235", boxShadow: "none", border: "1px solid #D0D5DD" }}>Đăng nhập Builder</Link>
                </div>
            </main>
        </div>
    );
}
