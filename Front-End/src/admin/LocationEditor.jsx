import { useEffect, useRef, useState } from "react";
import { addLocation, deleteLocation, updateLocation } from "../api/locationApi";
import { AuthError } from "../api/auth";
import { getGroup, getLocationType, locationTypes, typeGroups } from "../data/locationTypes";
import { airportTerminals } from "../data/airportCatalog";
import { floorLabel } from "../utils/text";

const textOrNull = (text) => text.trim() || null;
const terminalName = (id) => airportTerminals.find(item => item.id === id)?.name || id;

// Location -> values of the inputs (lists become "a, b, c")
function toForm(location) {
    return {
        name: location?.name || "",
        type: location?.type || "shop",
        area: location?.area || "",
        description: location?.description || "",
        openingHours: location?.openingHours || "",
        phone: location?.phone || "",
        website: location?.website || "",
        facilities: (location?.facilities || []).join(", ")
    };
}

// Right panel of the "Địa điểm" page. The big map is the editor of the position:
// position = { terminal, floor, lat, lng, x?, y? } comes from where the location was placed on it,
// so terminal and floor are never typed by hand. location = null -> adding a new one.
function LocationEditor({ location, position, isPlacing, onStartPlacing, onSaved, onDeleted, onClose }) {
    const isNew = !location;
    const [form, setForm] = useState(() => toForm(location));
    const [error, setError] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const nameRef = useRef(null);
    const type = getLocationType(form.type);

    // A new location: once it is placed, typing its name comes next
    useEffect(() => {
        if (isNew && position) nameRef.current?.focus();
    }, [isNew, position]);

    const set = (field, value) => setForm(current => ({ ...current, [field]: value }));
    const isMoved = !isNew && position && (position.lat !== location.lat || position.lng !== location.lng || position.floor !== location.floor || position.terminal !== location.terminal);

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!position) {
            setError("Chưa có vị trí: bấm “Đặt vị trí” rồi bấm vào mặt bằng trên bản đồ.");
            return;
        }
        const facilities = form.facilities.split(",").map(item => item.trim()).filter(Boolean);
        const data = {
            ...location,
            name: form.name.trim(),
            type: form.type,
            terminal: position.terminal,
            floor: position.floor,
            x: position.x ?? null,
            y: position.y ?? null,
            lat: position.lat ?? null,
            lng: position.lng ?? null,
            area: textOrNull(form.area),
            description: textOrNull(form.description),
            openingHours: textOrNull(form.openingHours),
            phone: textOrNull(form.phone),
            website: textOrNull(form.website),
            facilities: facilities.length > 0 ? facilities : null
        };
        setIsSaving(true);
        setError("");
        try {
            const saved = isNew ? await addLocation(data) : await updateLocation(location.id, data);
            onSaved(saved, isNew);
        } catch (err) {
            console.error(err);
            setError(err instanceof AuthError ? err.message : "Không lưu được. Kiểm tra lại các ô bắt buộc hoặc kết nối máy chủ.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!confirmDelete) {
            setConfirmDelete(true);
            return;
        }
        try {
            await deleteLocation(location.id);
            onDeleted(location);
        } catch (err) {
            console.error(err);
            setConfirmDelete(false);
            setError(err instanceof AuthError ? err.message : "Không xóa được địa điểm. Kiểm tra kết nối máy chủ.");
        }
    };

    return (
        <aside className="editor" aria-label={isNew ? "Thêm địa điểm" : `Sửa ${location.name}`} onKeyDown={(e) => e.key === "Escape" && !isPlacing && onClose()}>
            <header className="editor-head">
                <span className="type-dot" style={{ background: getGroup(type.group).color }}><i className={`bi ${type.icon}`} /></span>
                <div className="min-w-0 flex-grow-1">
                    <h2 className="text-truncate">{isNew ? (form.name || "Địa điểm mới") : location.name}</h2>
                    <small>{isNew ? "Chưa lưu" : `Mã ${location.id}`}</small>
                </div>
                <button type="button" className="btn btn-light btn-sm" onClick={onClose} aria-label="Đóng"><i className="bi bi-x-lg" /></button>
            </header>

            <form className="editor-body" onSubmit={handleSubmit} id="location-editor">
                <div className={`editor-place ${isPlacing ? "is-placing" : ""}`}>
                    <i className="bi bi-geo-alt-fill" aria-hidden="true" />
                    <div className="min-w-0 flex-grow-1">
                        {isPlacing ? (
                            <strong>Bấm vào mặt bằng trên bản đồ</strong>
                        ) : position ? (
                            <>
                                <strong>{terminalName(position.terminal)}, {floorLabel(position.floor)}</strong>
                                <small>{isMoved ? "Vị trí mới, lưu để áp dụng" : position.lat != null ? `${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}` : "Tọa độ bản vẽ cũ"}</small>
                            </>
                        ) : (
                            <strong>Chưa đặt vị trí</strong>
                        )}
                    </div>
                    <button type="button" className="btn btn-sm btn-outline-dark" onClick={onStartPlacing} disabled={isPlacing}>
                        {position ? "Dời vị trí" : "Đặt vị trí"}
                    </button>
                </div>

                <label htmlFor="ed-name">Tên</label>
                <input id="ed-name" ref={nameRef} className="form-control" required value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ví dụ: Cửa 05, Highlands Coffee" />

                <label htmlFor="ed-type">Loại</label>
                <select id="ed-type" className="form-select" value={form.type} onChange={(e) => set("type", e.target.value)}>
                    {typeGroups.filter(group => group.id !== "all").map(group => (
                        <optgroup key={group.id} label={group.label}>
                            {Object.entries(locationTypes).filter(([, item]) => item.group === group.id).map(([key, item]) => (
                                <option key={key} value={key}>{item.label}</option>
                            ))}
                        </optgroup>
                    ))}
                </select>

                <label htmlFor="ed-area">Khu vực</label>
                <input id="ed-area" className="form-control" value={form.area} onChange={(e) => set("area", e.target.value)} placeholder="Ví dụ: Khu cách ly" />

                <fieldset>
                    <legend>Cho hành khách</legend>
                    <label htmlFor="ed-description">Mô tả</label>
                    <textarea id="ed-description" className="form-control" rows="3" value={form.description} onChange={(e) => set("description", e.target.value)} />

                    <label htmlFor="ed-hours">Giờ mở cửa</label>
                    <input id="ed-hours" className="form-control" value={form.openingHours} onChange={(e) => set("openingHours", e.target.value)} placeholder="Ví dụ: 05:00 – 23:00" />

                    <div className="editor-row">
                        <div>
                            <label htmlFor="ed-phone">Điện thoại</label>
                            <input id="ed-phone" className="form-control" type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
                        </div>
                        <div>
                            <label htmlFor="ed-website">Website</label>
                            <input id="ed-website" className="form-control" value={form.website} onChange={(e) => set("website", e.target.value)} />
                        </div>
                    </div>

                    <label htmlFor="ed-facilities">Tiện ích</label>
                    <input id="ed-facilities" className="form-control" value={form.facilities} onChange={(e) => set("facilities", e.target.value)} placeholder="Wi-Fi, Ổ cắm sạc" aria-describedby="ed-facilities-help" />
                    <small id="ed-facilities-help" className="editor-help">Cách nhau bởi dấu phẩy.</small>
                </fieldset>

                {error && <p className="editor-error" role="alert">{error}</p>}
            </form>

            <footer className="editor-foot">
                {!isNew && (
                    <button type="button" className={`btn ${confirmDelete ? "btn-danger" : "btn-outline-danger"}`} onClick={handleDelete} onBlur={() => setConfirmDelete(false)}>
                        <i className="bi bi-trash me-1" />{confirmDelete ? "Bấm lần nữa để xóa" : "Xóa"}
                    </button>
                )}
                <span className="flex-grow-1" />
                <button type="button" className="btn btn-light" onClick={onClose}>Hủy</button>
                <button type="submit" form="location-editor" className="btn btn-dark" disabled={isSaving || isPlacing}>
                    {isSaving ? "Đang lưu…" : isNew ? "Thêm địa điểm" : "Lưu thay đổi"}
                </button>
            </footer>
        </aside>
    );
}

export default LocationEditor;
