import { useEffect, useRef, useState } from "react";
import MapView from "../components/MapView";
import { addLocation, deleteLocation, updateLocation } from "../api/locationApi";
import { AuthError } from "../api/auth";
import { getGroup, getLocationType, locationTypes, typeGroups } from "../data/locationTypes";
import { airportFloors, airportTerminals } from "../data/airportCatalog";

const textOrNull = (text) => text.trim() || null;

// Location -> values of the inputs (lists become "a, b, c")
function toForm(location, defaults) {
    return {
        name: location?.name || "",
        type: location?.type || "shop",
        terminal: location?.terminal || defaults.terminal,
        floor: location?.floor ?? defaults.floor,
        area: location?.area || "",
        description: location?.description || "",
        openingHours: location?.openingHours || "",
        phone: location?.phone || "",
        website: location?.website || "",
        facilities: (location?.facilities || []).join(", ")
    };
}

// Side drawer of the "Địa điểm" page: edit one location, or add one (location = null).
// The small map on top places it: click the floor plan to move the pin.
function LocationEditor({ location, defaults, onSaved, onDeleted, onClose }) {
    const isNew = !location;
    const [form, setForm] = useState(() => toForm(location, defaults));
    const [position, setPosition] = useState(location ? { x: location.x, y: location.y, lat: location.lat, lng: location.lng } : null);
    const [error, setError] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const nameRef = useRef(null);

    const floors = airportFloors.filter(item => item.terminal === form.terminal);
    const terminals = airportTerminals.filter(item => item.id !== "SGN_CAMPUS");
    const type = getLocationType(form.type);

    useEffect(() => {
        if (isNew) nameRef.current?.focus();
    }, [isNew]);

    const set = (field, value) => setForm(current => ({ ...current, [field]: value }));

    // Another terminal or floor: the old pin belongs to the old plan, so it must be placed again
    const handleTerminalChange = (terminal) => {
        setForm(current => ({ ...current, terminal, floor: airportFloors.find(item => item.terminal === terminal)?.id ?? 0 }));
        setPosition(null);
    };
    const handleFloorChange = (floor) => {
        if (floor === Number(form.floor)) return;
        set("floor", floor);
        setPosition(null);
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!position || (position.lat == null && position.x == null)) {
            setError("Chưa có vị trí: bấm lên mặt bằng ở bản đồ phía trên để đặt địa điểm.");
            return;
        }
        const facilities = form.facilities.split(",").map(item => item.trim()).filter(Boolean);
        const data = {
            ...location,
            name: form.name.trim(),
            type: form.type,
            terminal: form.terminal,
            floor: Number(form.floor),
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

    // The pin shown on the small map: the location with its (possibly moved) position and current type
    const pin = position && (position.lat != null || position.x != null)
        ? { ...location, id: location?.id ?? "new", name: form.name || "Địa điểm mới", type: form.type, terminal: form.terminal, floor: Number(form.floor), ...position }
        : null;

    return (
        <aside className="editor" aria-label={isNew ? "Thêm địa điểm" : `Sửa ${location.name}`} onKeyDown={(e) => e.key === "Escape" && onClose()}>
            <header className="editor-head">
                <span className="type-dot" style={{ background: getGroup(type.group).color }}><i className={`bi ${type.icon}`} /></span>
                <div className="min-w-0 flex-grow-1">
                    <h2 className="text-truncate">{isNew ? "Thêm địa điểm" : location.name}</h2>
                    {!isNew && <small>Mã {location.id}</small>}
                </div>
                <button type="button" className="btn btn-light btn-sm" onClick={onClose} aria-label="Đóng"><i className="bi bi-x-lg" /></button>
            </header>

            <form className="editor-body" onSubmit={handleSubmit} id="location-editor">
                <div className="editor-map">
                    <MapView
                        terminal={form.terminal}
                        floor={Number(form.floor)}
                        locations={pin ? [pin] : []}
                        selectedLocation={location}
                        onSelect={() => {}}
                        onMapClick={(point) => setPosition({ lat: point.lat, lng: point.lng })}
                        onFloorChange={handleFloorChange}
                        onTerminalChange={handleTerminalChange}
                    />
                </div>
                <p className="editor-hint">
                    <i className="bi bi-hand-index me-1" aria-hidden="true" />
                    {pin ? "Bấm chỗ khác trên mặt bằng để dời địa điểm." : "Bấm lên mặt bằng để đặt vị trí địa điểm."}
                    {pin?.lat != null && <span className="editor-coord">{pin.lat.toFixed(6)}, {pin.lng.toFixed(6)}</span>}
                </p>

                <fieldset>
                    <legend>Thông tin chính</legend>
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

                    <div className="editor-row">
                        <div>
                            <label htmlFor="ed-terminal">Nhà ga</label>
                            <select id="ed-terminal" className="form-select" value={form.terminal} onChange={(e) => handleTerminalChange(e.target.value)}>
                                {terminals.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="ed-floor">Tầng</label>
                            <select id="ed-floor" className="form-select" value={form.floor} onChange={(e) => handleFloorChange(Number(e.target.value))}>
                                {floors.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <label htmlFor="ed-area">Khu vực</label>
                    <input id="ed-area" className="form-control" value={form.area} onChange={(e) => set("area", e.target.value)} placeholder="Ví dụ: Khu cách ly" />
                </fieldset>

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
                <button type="submit" form="location-editor" className="btn btn-dark" disabled={isSaving}>
                    {isSaving ? "Đang lưu…" : isNew ? "Thêm địa điểm" : "Lưu thay đổi"}
                </button>
            </footer>
        </aside>
    );
}

export default LocationEditor;
