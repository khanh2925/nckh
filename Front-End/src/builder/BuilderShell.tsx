import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../console/auth";

// Khung các trang Builder không thuộc một địa điểm cụ thể: danh sách, tạo mới, thống kê, tài khoản
export default function BuilderShell() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    return (
        <>
            <header className="cb-topbar">
                <NavLink to="/builder" className="cb-brand">Indoor Map · Builder</NavLink>
                <nav className="cb-nav" aria-label="Chính">
                    <NavLink to="/builder" end>Địa điểm</NavLink>
                    <NavLink to="/builder/stats">Thống kê</NavLink>
                    <NavLink to="/builder/account">Tài khoản</NavLink>
                    {user?.role === "SYSTEM_ADMIN" && <NavLink to="/admin">Quản trị hệ thống</NavLink>}
                </nav>
                <div className="cb-user">
                    <span>{user?.email}</span>
                    <span className="cb-avatar" aria-hidden="true">{user?.fullName?.trim().split(/\s+/).pop()?.charAt(0).toUpperCase()}</span>
                    <button type="button" className="cb-btn cb-btn-ghost is-small" onClick={() => { logout(); navigate("/login"); }}>Đăng xuất</button>
                </div>
            </header>
            <main className="cb-main"><Outlet /></main>
        </>
    );
}
