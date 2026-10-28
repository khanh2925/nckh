import { Link, useLocation } from "react-router-dom";
import Lc from "../design/Lc";
import "../console/console.css";
import "./portal.css";

// Trang 404 cho mọi đường dẫn không có (nằm ngoài ConsoleRoot: không biết người xem đã đăng nhập hay chưa,
// nên chỉ có header, không có sidebar và tài khoản).
export default function ComingSoon() {
    const { pathname } = useLocation();
    return (
        <div className="cb-root">
            <div className="cs-app">
                <header className="cs-head">
                    <Link to="/" className="cs-logo" aria-label="Indoor Map, mở bản đồ cho khách"><Lc name="map-pin" size={18} stroke={2.2} /></Link>
                    <nav className="cs-crumbs" aria-label="Vị trí"><b aria-current="page">Không tìm thấy trang</b></nav>
                </header>
                <div className="cs-body">
                    <main className="cs-main">
                        <div className="k-page pt-page">
                            <div className="k-title"><h1 className="k24">Không tìm thấy trang</h1></div>
                            <section className="k-card pt-panel">
                                <div className="pt-copy">
                                    <h2 className="k16">Trang này không tồn tại hoặc đã bị xoá</h2>
                                    <p className="k14 k-m">Kiểm tra lại đường dẫn, hoặc mở địa điểm từ danh sách.</p>
                                </div>
                                <span className="k-line k14 k-m pt-url"><Lc name="link" size={16} color="var(--muted)" />{window.location.host}{pathname}</span>
                                <div className="pt-acts">
                                    <Link to="/builder" className="k-btn p">Về Địa điểm của tôi</Link>
                                    <Link to="/" className="k-btn t">Mở bản đồ cho khách</Link>
                                    <span className="k12 k-m">Mã lỗi 404</span>
                                </div>
                            </section>
                        </div>
                    </main>
                </div>
            </div>
        </div>
    );
}
