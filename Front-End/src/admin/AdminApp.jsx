import { useCallback, useEffect, useRef, useState } from "react";
import { getLocations } from "../api/locationApi";
import { getWalkways } from "../api/walkwayApi";
import LoginDialog from "../components/LoginDialog";
import OverviewPage from "./OverviewPage";
import LocationsPage from "./LocationsPage";
import WalkwaysPage from "./WalkwaysPage";
import QualityPage from "./QualityPage";
import "./admin.css";

// Admin app at /admin. Pages are plain paths (no router library): Cloudflare and Vite serve index.html for them.
const PAGES = [
    { path: "/admin", label: "Tổng quan", icon: "bi-grid-1x2" },
    { path: "/admin/locations", label: "Địa điểm", icon: "bi-geo-alt" },
    { path: "/admin/walkways", label: "Lối đi", icon: "bi-bezier2" },
    { path: "/admin/quality", label: "Kiểm tra dữ liệu", icon: "bi-clipboard-check" }
];

const readUrl = () => ({
    path: window.location.pathname.replace(/\/+$/, "") || "/admin",
    params: new URLSearchParams(window.location.search)
});

function AdminApp({ session, onSessionChange, onLogout }) {
    const [url, setUrl] = useState(readUrl);
    const [locations, setLocations] = useState([]);
    const [walkways, setWalkways] = useState({ nodes: [], edges: [] });
    const [status, setStatus] = useState("loading");   // "loading" | "ready" | "error"
    const [reloadCount, setReloadCount] = useState(0);
    const [loginNotice, setLoginNotice] = useState(null);
    // A page with unsaved work (the walkway drawing) sets this, so leaving it asks first
    const unsavedRef = useRef(false);
    const setUnsaved = useCallback((value) => {
        unsavedRef.current = value;
    }, []);

    useEffect(() => {
        Promise.all([getLocations(), getWalkways()])
            .then(([locationData, walkwayData]) => {
                setLocations(locationData);
                setWalkways(walkwayData);
                setStatus("ready");
            })
            .catch(err => {
                console.error(err);
                setStatus("error");
            });
    }, [reloadCount]);

    // Browser back / forward
    useEffect(() => {
        const handlePopState = () => setUrl(readUrl());
        window.addEventListener("popstate", handlePopState);
        return () => window.removeEventListener("popstate", handlePopState);
    }, []);

    // Closing the tab with an unsaved drawing: the browser asks before leaving
    useEffect(() => {
        const handleBeforeUnload = (event) => {
            if (unsavedRef.current) event.preventDefault();
        };
        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, []);

    // A save was refused because the login expired: ask again on top of the page, the unsaved work stays
    useEffect(() => {
        const handleExpired = () => setLoginNotice("Phiên đăng nhập đã hết hạn. Đăng nhập lại rồi bấm lưu lần nữa, thay đổi chưa lưu vẫn còn.");
        window.addEventListener("admin-session-expired", handleExpired);
        return () => window.removeEventListener("admin-session-expired", handleExpired);
    }, []);

    const confirmLeave = () => !unsavedRef.current || window.confirm("Lối đi có thay đổi chưa lưu. Rời trang và bỏ các thay đổi này?");

    // to: "/admin/locations?edit=81"
    const navigate = (to) => {
        if (!confirmLeave()) return;
        unsavedRef.current = false;
        window.history.pushState(null, "", to);
        setUrl(readUrl());
        window.scrollTo(0, 0);
    };

    const handleLogout = () => {
        if (confirmLeave()) onLogout();
    };

    const page = PAGES.find(item => item.path === url.path) || PAGES[0];
    const pageProps = { locations, walkways, params: url.params, navigate };

    let content;
    if (status === "loading") {
        content = <p className="admin-state"><span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />Đang tải dữ liệu từ máy chủ…</p>;
    } else if (status === "error") {
        content = (
            <div className="admin-state" role="alert">
                <p className="mb-2">Không tải được dữ liệu. Máy chủ có thể đang khởi động (khoảng 1 phút) hoặc mất kết nối.</p>
                <button type="button" className="btn btn-dark btn-sm" onClick={() => { setStatus("loading"); setReloadCount(reloadCount + 1); }}>Tải lại</button>
            </div>
        );
    } else if (page.path === "/admin/locations") {
        content = <LocationsPage {...pageProps} onLocationsChange={setLocations} />;
    } else if (page.path === "/admin/walkways") {
        content = <WalkwaysPage {...pageProps} onWalkwaysChange={setWalkways} onUnsavedChange={setUnsaved} />;
    } else if (page.path === "/admin/quality") {
        content = <QualityPage {...pageProps} />;
    } else {
        content = <OverviewPage {...pageProps} />;
    }

    return (
        <div className="admin-shell">
            <nav className="admin-nav" aria-label="Quản trị">
                <a className="admin-brand" href="/admin" onClick={(e) => { e.preventDefault(); navigate("/admin"); }}>
                    <span className="terminal-badge">SGN</span>
                    <span>
                        <strong>Quản trị bản đồ</strong>
                        <small>Sân bay Tân Sơn Nhất</small>
                    </span>
                </a>

                <ul className="admin-nav-list">
                    {PAGES.map(item => (
                        <li key={item.path}>
                            <a href={item.path} className={item.path === page.path ? "is-active" : ""} aria-current={item.path === page.path ? "page" : undefined}
                               onClick={(e) => { e.preventDefault(); navigate(item.path); }}>
                                <i className={`bi ${item.icon}`} aria-hidden="true" />
                                <span>{item.label}</span>
                            </a>
                        </li>
                    ))}
                </ul>

                <div className="admin-nav-foot">
                    <a href="/" target="_blank" rel="noopener noreferrer"><i className="bi bi-map" aria-hidden="true" /><span>Mở bản đồ công khai</span></a>
                    <div className="admin-user">
                        <i className="bi bi-person-circle" aria-hidden="true" />
                        <span className="text-truncate">{session.username}</span>
                        <button type="button" onClick={handleLogout}>Đăng xuất</button>
                    </div>
                </div>
            </nav>

            <main className={`admin-main ${page.path === "/admin/walkways" ? "is-full" : ""}`}>
                {content}
            </main>

            {loginNotice && (
                <LoginDialog
                    notice={loginNotice}
                    onLoggedIn={(newSession) => { setLoginNotice(null); onSessionChange(newSession); }}
                    onCancel={() => setLoginNotice(null)}
                />
            )}
        </div>
    );
}

export default AdminApp;
