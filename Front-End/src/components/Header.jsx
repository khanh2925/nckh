import { airportFloors, airportTerminals } from "../data/airportCatalog";
import { canEdit } from "../api/locationApi";
import { floorLabel } from "../utils/text";

function Header({ terminal, onTerminalChange, floor, onFloorChange, role, onRoleChange }) {
    const floors = airportFloors.filter(item => item.terminal === terminal);
    return (
        <header className="topbar">
            <div className="identity">
                <span className="terminal-badge">SGN</span>
                <div className="d-none d-md-block">
                    <h1>{airportTerminals.find(item => item.id === terminal)?.name}</h1>
                    <p>Sân bay Tân Sơn Nhất · Bản đồ mặt bằng</p>
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

                {/* Adding locations is a desktop task, so the role switch is hidden on phones.
                    The online website is read-only, so there is no Admin at all (see canEdit). */}
                {canEdit && <select className="form-select form-select-sm role-select d-none d-md-block" value={role} onChange={(e) => onRoleChange(e.target.value)} aria-label="Vai trò">
                    <option value="user">Người dùng</option>
                    <option value="admin">Admin</option>
                </select>}
            </div>
        </header>
    );
}

export default Header;
