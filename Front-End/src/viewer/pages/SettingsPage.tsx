import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { stepLengthFrom } from "@indoor-map/core";
import { api } from "../../lib/data";
import { hasMotionSensors, needsSensorPermission, requestSensorPermission, speak, useSensorPermission, useStepDetector, vibrate } from "../../lib/sensors";
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

/** Đo độ dài bước: đi đúng một quãng biết trước, đếm bước bằng cảm biến, chia ra */
function StepCalibration() {
    const [meters, setMeters] = useState("10");
    const [walking, setWalking] = useState(false);
    const [steps, setSteps] = useState(0);
    const [result, setResult] = useState<number | null>(null);
    const onStep = useCallback(() => {
        setSteps(n => n + 1);
        vibrate(15);
    }, []);
    const live = useStepDetector(walking, onStep);
    const distance = Number(meters.replace(",", "."));

    const start = async () => {
        if (needsSensorPermission && (await requestSensorPermission()) !== "granted") return;
        setSteps(0);
        setResult(null);
        setWalking(true);
    };
    const stop = () => {
        setWalking(false);
        setResult(stepLengthFrom(distance, steps));
    };

    return (
        <div className="wf-set-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 10 }}>
            <div>
                <div className="wf-set-label">Đo bước chân của bạn</div>
                <div className="wf-muted">Chọn một quãng biết chiều dài (vd. hành lang 10 m, 5 viên gạch 60 cm = 3 m). Đứng ở đầu, bấm Bắt đầu, đi bình thường tới cuối rồi bấm Dừng.</div>
            </div>
            {!walking && result == null && (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input className="wf-input" style={{ width: 90 }} inputMode="decimal" aria-label="Quãng đường (m)" value={meters} onChange={e => setMeters(e.target.value.replace(/[^\d.,]/g, ""))} />
                    <span className="wf-muted">m</span>
                    <button type="button" className="wf-btn wf-btn-primary" disabled={!(distance >= 3)} onClick={() => void start()}>Bắt đầu</button>
                </div>
            )}
            {walking && (
                <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
                    <span><b style={{ fontSize: 28 }}>{steps}</b> bước{!live && <span className="wf-muted"> · đang chờ cảm biến…</span>}</span>
                    <button type="button" className="wf-btn wf-btn-primary" onClick={stop}>Dừng</button>
                </div>
            )}
            {!walking && result != null && (
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span>{steps} bước / {distance} m → <b>{result.toFixed(2).replace(".", ",")} m mỗi bước</b></span>
                    <button type="button" className="wf-btn wf-btn-primary" onClick={() => { updateSettings({ stepLength: result }); setResult(null); }}>Lưu</button>
                    <button type="button" className="wf-btn wf-btn-secondary" onClick={() => setResult(null)}>Đo lại</button>
                </div>
            )}
            {!walking && result == null && steps > 0 && steps < 4 && <div className="wf-muted">Chỉ đếm được {steps} bước — quãng quá ngắn hoặc cảm biến chưa chạy. Thử lại với quãng dài hơn.</div>}
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
                        <input aria-labelledby="s-step" type="range" min={0.35} max={1.1} step={0.01} value={s.stepLength}
                            onChange={e => updateSettings({ stepLength: Number(e.target.value) })} className="wf-range" />
                    </Row>
                    {hasMotionSensors && <StepCalibration />}
                    <Row id="s-heading" label="Hướng đã căn" sub={`${Object.keys(s.headingOffsets ?? {}).length} địa điểm có bù la bàn (đặt bằng nút “Căn hướng” khi đang đi)`}>
                        <button type="button" className="wf-btn wf-btn-secondary" disabled={!Object.keys(s.headingOffsets ?? {}).length} onClick={() => updateSettings({ headingOffsets: {} })}>Xoá</button>
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
