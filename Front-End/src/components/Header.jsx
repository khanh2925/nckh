import { airportFloors, airportTerminals } from "../data/airportCatalog";

function Header({ terminal, onTerminalChange, floor, onFloorChange, role, onRoleChange }) {
    const floors = airportFloors.filter(item => item.terminal === terminal);
    return (
        <header className="topbar">
            <div className="identity">
                <span className="terminal-badge">SGN</span>
                <div>
                    <h1>{airportTerminals.find(item => item.id === terminal)?.name}</h1>
                    <p className="d-none d-md-block">Sân bay Tân Sơn Nhất · Bản đồ mặt bằng</p>
                </div>
            </div>

            <div className="header-actions">
                <select className="form-select form-select-sm" aria-label="Chọn nhà ga" value={terminal} onChange={event => onTerminalChange(event.target.value)}>
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
                        >
                            {item.name}
                        </button>
                    ))}
                </nav>

                {/* Adding locations is a desktop task, so the role switch is hidden on phones */}
                <select className="form-select form-select-sm role-select d-none d-md-block" value={role} onChange={(e) => onRoleChange(e.target.value)} aria-label="Vai trò">
                    <option value="user">Người dùng</option>
                    <option value="admin">Admin</option>
                </select>
            </div>
        </header>
    );
}

export default Header;
