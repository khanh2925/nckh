import { airportFloors, airportTerminals } from "../data/airportCatalog";
import { floorLabel } from "../utils/text";

// onLogout: set on the admin page (/admin), which then shows who is logged in and a logout button
function Header({ terminal, onTerminalChange, floor, onFloorChange, username, onLogout }) {
    const floors = airportFloors.filter(item => item.terminal === terminal);
    return (
        <header className="topbar">
            <div className="identity">
                <span className="terminal-badge">SGN</span>
                <div className="d-none d-md-block">
                    <h1>{airportTerminals.find(item => item.id === terminal)?.name}</h1>
                    <p>{onLogout ? "Trang quản trị · Thay đổi lưu thẳng vào dữ liệu thật" : "Sân bay Tân Sơn Nhất · Bản đồ mặt bằng"}</p>
                </div>
            </div>

            <div className="header-actions">
                {/* On phones this select is also the title, so the terminal name is not shown twice */}
                <select className="form-select form-select-sm terminal-select" aria-label="Chọn nhà ga" value={terminal} onChange={event => onTerminalChange(event.target.value)}>
                    {airportTerminals.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                <nav className="floor-tabs" aria-label="Chọn tầng">
                    {floors.map(item => (
                        <button
                            type="button"
                            key={item.id}
                            className={`floor-button ${floor === item.id ? "active" : ""}`}
                            aria-pressed={floor === item.id}
                            onClick={() => onFloorChange(item.id)}
                            title={item.name}
                        >
                            {/* Full names like "Tầng Trệt - Khu Đến | Làm Thủ Tục" don't fit on a phone */}
                            <span className="d-none d-md-inline">{item.name}</span>
                            <span className="d-md-none">{floorLabel(item.id)}</span>
                        </button>
                    ))}
                </nav>

                {onLogout && (
                    <div className="admin-user">
                        <span className="badge text-bg-danger">QUẢN TRỊ</span>
                        <span className="d-none d-lg-inline text-muted small text-truncate"><i className="bi bi-person-circle me-1" />{username}</span>
                        <a className="btn btn-light btn-sm" href="/" title="Xem trang công khai" aria-label="Xem trang công khai"><i className="bi bi-box-arrow-up-right" /></a>
                        <button type="button" className="btn btn-outline-danger btn-sm" onClick={onLogout} title="Đăng xuất" aria-label="Đăng xuất">
                            <i className="bi bi-box-arrow-right" /><span className="d-none d-lg-inline ms-1">Đăng xuất</span>
                        </button>
                    </div>
                )}
            </div>
        </header>
    );
}

export default Header;
