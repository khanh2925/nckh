import { useState } from "react";
import { addLocation, deleteLocation, updateLocation } from "../api/locationApi";
import { locationTypes } from "../data/locationTypes";
import { airportFloors } from "../data/airportCatalog";

// Location object -> values shown in the inputs (lists become "a, b, c" text)
function toForm(location, floor) {
    return {
        name: location?.name || "",
        type: location?.type || "gate",
        floor: location?.floor ?? floor,
        area: location?.area || "",
        description: location?.description || "",
        openingHours: location?.openingHours || "",
        facilities: (location?.facilities || []).join(", ")
    };
}

// Empty text -> null, so the JSON file doesn't store empty fields
const textOrNull = (text) => text.trim() || null;

// location = null -> "add new" mode, otherwise "edit" mode
function AdminLocationForm({ terminal, location, floor, pickedPoint, isPicking, onStartPick, onCancel, onSaved, onDeleted }) {
    const floors = airportFloors.filter(item => item.terminal === terminal);
    const [form, setForm] = useState(toForm(location, floor));
    const [error, setError] = useState("");
    const isNew = !location;

    // A newly picked point wins, otherwise keep the saved position
    const position = pickedPoint || location;

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!position) {
            setError("Bạn cần chọn vị trí trên bản đồ trước.");
            return;
        }

        const facilities = form.facilities.split(",").map(item => item.trim()).filter(item => item);
        const data = {
            ...location,
            name: form.name,
            type: form.type,
            terminal,
            floor: Number(form.floor),
            x: position.x ?? null,
            y: position.y ?? null,
            lat: position.lat ?? null,
            lng: position.lng ?? null,
            area: textOrNull(form.area),
            description: textOrNull(form.description),
            openingHours: textOrNull(form.openingHours),
            facilities: facilities.length > 0 ? facilities : null
        };

        try {
            const saved = isNew ? await addLocation(data) : await updateLocation(location.id, data);
            onSaved(saved, isNew);
        } catch (err) {
            console.error(err);
            setError("Không lưu được địa điểm. Hãy kiểm tra backend.");
        }
    };

    const handleDelete = async () => {
        if (!window.confirm(`Xóa "${location.name}"? Không thể hoàn tác.`)) return;
        try {
            await deleteLocation(location.id);
            onDeleted(location.id);
        } catch (err) {
            console.error(err);
            setError("Không xóa được địa điểm. Hãy kiểm tra backend.");
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <div className="d-flex align-items-center gap-2 mb-3">
                <button type="button" className="btn btn-light btn-sm" onClick={onCancel} aria-label="Quay lại danh sách">
                    <i className="bi bi-arrow-left" />
                </button>
                <strong>{isNew ? "Thêm địa điểm" : `Sửa #${location.id}`}</strong>
            </div>

            <label className="form-label small fw-semibold mb-1">Tên địa điểm</label>
            <input name="name" className="form-control form-control-sm mb-2" required value={form.name} onChange={handleChange} placeholder="Ví dụ: Cửa 05" />

            <div className="row g-2 mb-2">
                <div className="col-7">
                    <label className="form-label small fw-semibold mb-1">Loại</label>
                    <select name="type" className="form-select form-select-sm" value={form.type} onChange={handleChange}>
                        {Object.entries(locationTypes).map(([key, type]) => (
                            <option key={key} value={key}>{type.label}</option>
                        ))}
                    </select>
                </div>
                <div className="col-5">
                    <label className="form-label small fw-semibold mb-1">Tầng</label>
                    <select name="floor" className="form-select form-select-sm" value={form.floor} onChange={handleChange}>
                        {floors.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                </div>
            </div>

            <label className="form-label small fw-semibold mb-1">Khu vực</label>
            <input name="area" className="form-control form-control-sm mb-2" value={form.area} onChange={handleChange} placeholder="Ví dụ: Khu cách ly" />

            <label className="form-label small fw-semibold mb-1">Mô tả</label>
            <textarea name="description" className="form-control form-control-sm mb-2" rows="2" value={form.description} onChange={handleChange} />

            <label className="form-label small fw-semibold mb-1">Giờ mở cửa</label>
            <input name="openingHours" className="form-control form-control-sm mb-2" value={form.openingHours} onChange={handleChange} placeholder="Ví dụ: 05:00 – 23:00" />

            <label className="form-label small fw-semibold mb-1">Tiện ích <span className="text-muted fw-normal">(cách nhau bởi dấu phẩy)</span></label>
            <input name="facilities" className="form-control form-control-sm mb-2" value={form.facilities} onChange={handleChange} placeholder="Wi-Fi, Ổ cắm sạc" />

            <div className="d-flex gap-2 small mb-2">
                <span className="coordinate">Vĩ độ: <b>{position?.lat?.toFixed(6) ?? "—"}</b></span>
                <span className="coordinate">Kinh độ: <b>{position?.lng?.toFixed(6) ?? "—"}</b></span>
            </div>

            <button type="button" className="btn btn-outline-secondary btn-sm w-100 mb-2" onClick={() => onStartPick(Number(form.floor))} disabled={isPicking}>
                <i className="bi bi-crosshair me-1" />
                {isPicking ? "Hãy bấm vào vị trí trên mặt bằng…" : position ? "Chọn lại vị trí" : "Chọn vị trí trên bản đồ"}
            </button>

            <div className="d-flex gap-2">
                <button type="submit" className="btn btn-danger btn-sm flex-grow-1">{isNew ? "Thêm" : "Lưu thay đổi"}</button>
                {!isNew && (
                    <button type="button" className="btn btn-outline-danger btn-sm" onClick={handleDelete} aria-label="Xóa địa điểm" title="Xóa">
                        <i className="bi bi-trash" />
                    </button>
                )}
            </div>

            {error && <p className="small text-danger mt-2 mb-0" role="alert">{error}</p>}
        </form>
    );
}

export default AdminLocationForm;
