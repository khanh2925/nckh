import { useState } from "react";
import { addLocation } from "../api/locationApi";
import { locationTypes } from "../data/locationTypes";
import floors from "../data/floors";

const emptyForm = { name: "", type: "gate", floor: 1, area: "", description: "" };

function AdminForm({ pickedPoint, isPicking, onStartPick, onSaved }) {
    const [form, setForm] = useState(emptyForm);
    const [message, setMessage] = useState("");

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleStartPick = () => {
        setMessage("");
        onStartPick(Number(form.floor));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!pickedPoint) {
            setMessage("Bạn cần chọn vị trí trên bản đồ trước.");
            return;
        }

        try {
            const newLocation = await addLocation({
                ...form,
                floor: Number(form.floor),
                terminal: "T1",
                x: Number(pickedPoint.x.toFixed(1)),
                y: Number(pickedPoint.y.toFixed(1))
            });
            // Keep type and floor so the admin can add several similar places quickly
            setForm({ ...emptyForm, type: form.type, floor: form.floor });
            setMessage("Đã thêm địa điểm thành công.");
            onSaved(newLocation);
        } catch (error) {
            console.error(error);
            setMessage("Không lưu được địa điểm. Hãy kiểm tra backend.");
        }
    };

    return (
        <aside className="admin-card">
            <div className="d-flex align-items-center gap-2 mb-3">
                <span className="badge text-bg-danger">ADMIN</span>
                <div>
                    <strong className="d-block">Thêm địa điểm</strong>
                    <small className="text-muted">Gán tọa độ trên mặt bằng</small>
                </div>
            </div>

            <form onSubmit={handleSubmit}>
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

                <div className="d-flex gap-2 small mb-2">
                    <span className="coordinate">X: <b>{pickedPoint ? pickedPoint.x.toFixed(1) : "—"}</b></span>
                    <span className="coordinate">Y: <b>{pickedPoint ? pickedPoint.y.toFixed(1) : "—"}</b></span>
                </div>

                <button type="button" className="btn btn-outline-secondary btn-sm w-100 mb-2" onClick={handleStartPick} disabled={isPicking}>
                    <i className="bi bi-crosshair me-1" />
                    {isPicking ? "Hãy bấm vào vị trí trên mặt bằng…" : "Chọn vị trí trên bản đồ"}
                </button>
                <button type="submit" className="btn btn-danger btn-sm w-100">Lưu địa điểm</button>

                {message && <p className="small text-muted mt-2 mb-0" role="status">{message}</p>}
            </form>
        </aside>
    );
}

export default AdminForm;
