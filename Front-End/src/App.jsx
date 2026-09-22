import { useEffect, useRef, useState } from 'react';

export default function App() {
  const initialized = useRef(false);
  const [role, setRole] = useState('user');
  const [form, setForm] = useState({ name: '', type: 'gate', typeName: 'Cửa ra máy bay', floor: 1, x: '', y: '' });
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    import('./airport-map.js');
  }, []);

  useEffect(() => {
    const receivePoint = (event) => {
      setForm(current => ({ ...current, x: event.detail.x.toFixed(1), y: event.detail.y.toFixed(1), floor: event.detail.floor }));
      setMessage('Đã chọn tọa độ. Kiểm tra thông tin rồi bấm Lưu địa điểm.');
    };
    window.addEventListener('admin:point-picked', receivePoint);
    return () => window.removeEventListener('admin:point-picked', receivePoint);
  }, []);

  const updateForm = (field, value) => setForm(current => ({ ...current, [field]: value }));
  const choosePoint = () => {
    setMessage('Hãy bấm vào vị trí cần thêm trên mặt bằng.');
    window.dispatchEvent(new CustomEvent('admin:start-pick', { detail: { floor: Number(form.floor) } }));
  };
  const saveLocation = async (event) => {
    event.preventDefault();
    if (form.x === '' || form.y === '') { setMessage('Bạn cần chọn một vị trí trên bản đồ trước.'); return; }
    const response = await fetch('/api/locations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, floor: Number(form.floor), x: Number(form.x), y: Number(form.y) })
    });
    if (!response.ok) { setMessage('Không lưu được địa điểm. Hãy kiểm tra backend.'); return; }
    setMessage('Đã thêm địa điểm thành công.');
    setForm(current => ({ ...current, name: '', x: '', y: '' }));
    window.dispatchEvent(new Event('locations:refresh'));
  };

  return <main className="app-shell">
    <header className="topbar">
      <div className="identity">
        <span className="terminal-badge">T1</span>
        <div><h1>Ga nội địa Tân Sơn Nhất</h1><p>Bản đồ mặt bằng · React + Spring Boot</p></div>
      </div>
      <div className="header-actions">
        <label className="role-select">Vai trò
          <select value={role} onChange={event => setRole(event.target.value)}>
            <option value="user">Người dùng</option><option value="admin">Admin</option>
          </select>
        </label>
        <nav className="floor-tabs" aria-label="Chọn tầng">
          <button type="button" className="floor-button active" data-floor="1">Tầng 1</button>
          <button type="button" className="floor-button" data-floor="2">Tầng 2</button>
        </nav>
      </div>
    </header>
    <section className="map-shell" aria-label="Bản đồ nhà ga T1">
      <div className="search-panel">
        <label htmlFor="location-search" className="sr-only">Tìm địa điểm</label>
        <input id="location-search" type="search" placeholder="Tìm Gate, WC, quầy thông tin…" autoComplete="off" />
        <div id="search-results" className="search-results" hidden />
      </div>
      <div id="airport-map" />
      <div className="map-controls" aria-label="Điều khiển bản đồ">
        <button type="button" id="zoom-in" aria-label="Phóng to">+</button>
        <button type="button" id="zoom-out" aria-label="Thu nhỏ">−</button>
        <button type="button" id="reset-bearing" aria-label="Đặt lại hướng">↻</button>
        <button type="button" id="airport-overview" aria-label="Xem toàn sân bay">⌂</button>
        <button type="button" id="go-t1" aria-label="Về ga T1">T1</button>
      </div>
      <div className="legend" aria-label="Chú giải">
        <span><i className="room" />Khu dịch vụ</span><span><i className="lounge" />Phòng chờ</span>
        <span><i className="shop" />Cửa hàng</span><span><i className="security" />Khu kiểm soát</span>
      </div>
      <p id="map-status" className="map-footnote">Toàn cảnh sân bay · Phóng to Ga T1 để xem mặt bằng</p>
      {role === 'admin' && <aside className="admin-card">
        <div className="admin-heading"><span>ADMIN</span><div><strong>Thêm địa điểm</strong><small>Gán tọa độ trên mặt bằng</small></div></div>
        <form onSubmit={saveLocation}>
          <label>Tên địa điểm<input required value={form.name} onChange={event => updateForm('name', event.target.value)} placeholder="Ví dụ: Gate 05" /></label>
          <div className="form-row">
            <label>Loại<select value={form.type} onChange={event => {
              const option = event.target.selectedOptions[0]; updateForm('type', event.target.value); updateForm('typeName', option.dataset.label);
            }}><option value="gate" data-label="Cửa ra máy bay">Gate</option><option value="restroom" data-label="Nhà vệ sinh">WC</option><option value="information" data-label="Thông tin sân bay">Thông tin</option><option value="lounge" data-label="Phòng chờ hành khách">Phòng chờ</option><option value="elevator" data-label="Thang máy">Thang máy</option><option value="other" data-label="Địa điểm khác">Khác</option></select></label>
            <label>Tầng<select value={form.floor} onChange={event => updateForm('floor', Number(event.target.value))}><option value="1">Tầng 1</option><option value="2">Tầng 2</option></select></label>
          </div>
          <label>Nhãn hiển thị<input value={form.typeName} onChange={event => updateForm('typeName', event.target.value)} /></label>
          <div className="coordinates"><span>X: <b>{form.x || '—'}</b></span><span>Y: <b>{form.y || '—'}</b></span></div>
          <button type="button" className="pick-button" onClick={choosePoint}>⌖ Chọn vị trí trên bản đồ</button>
          <button type="submit" className="save-button">Lưu địa điểm</button>
          {message && <p className="admin-message" role="status">{message}</p>}
        </form>
      </aside>}
    </section>
  </main>;
}
