import { useState } from "react";
import AdminLocationForm from "./AdminLocationForm";
import { getLocationType } from "../data/locationTypes";
import { normalizeText } from "../utils/text";

// Admin CRUD: a list of locations on the current floor, or the add/edit form
function AdminPanel({ terminal, locations, floor, editingLocation, isCreating, pickedPoint, isPicking, onEdit, onCreate, onCancel, onStartPick, onSaved, onDeleted }) {
    const [keyword, setKeyword] = useState("");
    const [message, setMessage] = useState("");

    const handleSaved = (saved, isNew) => {
        setMessage(isNew ? `Đã thêm "${saved.name}".` : `Đã lưu "${saved.name}".`);
        onSaved(saved, isNew);
    };

    const handleDeleted = (id) => {
        setMessage("Đã xóa địa điểm.");
        onDeleted(id);
    };

    const handleEdit = (id) => {
        setMessage("");
        onEdit(id);
    };

    const handleCreate = () => {
        setMessage("");
        onCreate();
    };

    if (isCreating || editingLocation) {
        return (
            <aside className="admin-card">
                {/* key: switching to another location resets the form */}
                <AdminLocationForm
                    terminal={terminal}
                    key={editingLocation ? editingLocation.id : "new"}
                    location={editingLocation}
                    floor={floor}
                    pickedPoint={pickedPoint}
                    isPicking={isPicking}
                    onStartPick={onStartPick}
                    onCancel={onCancel}
                    onSaved={handleSaved}
                    onDeleted={handleDeleted}
                />
            </aside>
        );
    }

    const query = normalizeText(keyword);
    const floorLocations = locations
        .filter(location => location.floor === floor)
        .filter(location => normalizeText(location.name).includes(query))
        .sort((a, b) => a.name.localeCompare(b.name, "vi"));

    return (
        <aside className="admin-card">
            <div className="d-flex align-items-center gap-2 mb-3">
                <span className="badge text-bg-danger">ADMIN</span>
                <div className="flex-grow-1">
                    <strong className="d-block">Quản lý địa điểm</strong>
                    <small className="text-muted">Tầng {floor} · {floorLocations.length} địa điểm</small>
                </div>
                <button type="button" className="btn btn-danger btn-sm" onClick={handleCreate}>
                    <i className="bi bi-plus-lg me-1" />Thêm
                </button>
            </div>

            {message && <div className="alert alert-success py-1 px-2 small" role="status">{message}</div>}

            <input
                type="search"
                className="form-control form-control-sm mb-2"
                placeholder="Lọc theo tên…"
                aria-label="Lọc địa điểm theo tên"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
            />

            <div className="list-group list-group-flush admin-list">
                {floorLocations.map(location => {
                    const type = getLocationType(location.type);
                    return (
                        <button type="button" key={location.id} className="list-group-item list-group-item-action d-flex align-items-center gap-2 px-1" onClick={() => handleEdit(location.id)}>
                            <i className={`bi ${type.icon} text-secondary`} />
                            <span className="flex-grow-1">
                                {location.name}
                                <small className="d-block text-muted">{type.label}</small>
                            </span>
                            <i className="bi bi-pencil text-muted" />
                        </button>
                    );
                })}
            </div>

            <p className="small text-muted mt-2 mb-0">Mẹo: bấm vào marker trên bản đồ để sửa nhanh. Dữ liệu được lưu trong file JSON của backend.</p>
        </aside>
    );
}

export default AdminPanel;
