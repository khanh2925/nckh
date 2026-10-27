import { useNavigate } from "react-router-dom";
import { api } from "../../lib/data";
import { hasMotionSensors, needsSensorPermission, requestSensorPermission, speak, useSensorPermission } from "../../lib/sensors";
import { updateSettings, useSettings } from "../../lib/settings";
import { IconButton, SectionKicker, Toggle } from "../components/ui";

function Row({ id, label, sub, children }: { id: string; label: string; sub?: string; children: React.ReactNode }) {
    return (
        <div className="wf-set-row">
            <div><div id={id} className="wf-set-label">{label}</div>{sub && <div className="wf-muted">{sub}</div>}</div>
            {children}
        </div>
    );
}

export default function SettingsPage() {
    const s = useSettings();
    const navigate = useNavigate();
    const permission = useSensorPermission();

    return (
        <div className="wf-screen">
            <header className="wf-topbar">
                <IconButton icon="back" label="Quay lại" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))} />
                <div className="wf-topbar-text"><div className="wf-kicker">INDOOR MAP · KHÁCH THAM QUAN</div><h1 className="wf-title">Cài đặt</h1></div>
            </header>
            <main className="wf-body is-scroll">
                <SectionKicker>Hiển thị</SectionKicker>
                <div className="wf-table">
                    <Row id="s-large" label="Chữ lớn" sub="Tăng cỡ chữ chỉ dẫn"><Toggle labelledBy="s-large" checked={s.largeText} onChange={v => updateSettings({ largeText: v })} /></Row>
                </div>

                <SectionKicker>Tuyến đường</SectionKicker>
                <div className="wf-table">
                    <Row id="s-stairs" label="Tránh thang cuốn & thang bộ" sub="Chỉ đổi tầng bằng thang máy — cho xe lăn, xe đẩy">
                        <Toggle labelledBy="s-stairs" checked={s.avoidStairs} onChange={v => updateSettings({ avoidStairs: v })} />
                    </Row>
                    <Row id="s-vib" label="Rung khi tới lượt rẽ"><Toggle labelledBy="s-vib" checked={s.vibrate} onChange={v => updateSettings({ vibrate: v })} /></Row>
                    <Row id="s-voice" label="Đọc chỉ dẫn bằng giọng nói" sub="Dùng giọng tiếng Việt của máy (nếu có)">
                        <Toggle labelledBy="s-voice" checked={s.voice} onChange={v => {
                            updateSettings({ voice: v });
                            if (v) speak("Đã bật đọc chỉ dẫn");
                        }} />
                    </Row>
                </div>

                <SectionKicker>Định vị</SectionKicker>
                <div className="wf-table">
                    <Row id="s-step" label="Độ dài bước chân" sub={`${s.stepLength.toFixed(2).replace(".", ",")} m mỗi bước — dùng khi đếm bước`}>
                        <input aria-labelledby="s-step" type="range" min={0.5} max={0.9} step={0.01} value={s.stepLength}
                            onChange={e => updateSettings({ stepLength: Number(e.target.value) })} className="wf-range" />
                    </Row>
                    <Row id="s-sensor" label="La bàn & cảm biến bước"
                        sub={!hasMotionSensors ? "Thiết bị này không có cảm biến chuyển động — dùng QR, chọn tay hoặc mô phỏng" : permission === "granted" ? "Đã cho phép" : permission === "denied" ? "Bị từ chối — bật lại trong cài đặt trình duyệt" : "Chưa cho phép"}>
                        {hasMotionSensors && needsSensorPermission && permission !== "granted"
                            ? <button type="button" className="wf-btn wf-btn-secondary" onClick={() => void requestSensorPermission()}>Cho phép</button>
                            : <span className="wf-muted">{permission === "granted" && hasMotionSensors ? "Bật" : "—"}</span>}
                    </Row>
                </div>

                <SectionKicker>Dữ liệu</SectionKicker>
                <div className="wf-table">
                    <Row id="s-recent" label="Lịch sử tìm kiếm" sub={`${s.recent.length} địa điểm gần đây`}>
                        <button type="button" className="wf-btn wf-btn-secondary" disabled={!s.recent.length} onClick={() => updateSettings({ recent: [] })}>Xoá</button>
                    </Row>
                    <Row id="s-src" label="Nguồn dữ liệu" sub={api.source === "static" ? "Bản chụp tĩnh đi kèm website" : "Máy chủ Indoor Map"}><span /></Row>
                </div>
                <p className="wf-footnote">Bạn quản lý một toà nhà? Tự dựng bản đồ tại /builder · v2.0</p>
            </main>
        </div>
    );
}
