import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/data";
import { hasMotionSensors, needsSensorPermission, requestSensorPermission, speak, useSensorPermission } from "../../lib/sensors";
import { updateSettings, useSettings } from "../../lib/settings";
import { clearLog, downloadLog, lastLogUpload, uploadLog, useLogSize } from "../../lib/positioningLog";
import { Row, Segmented, Toggle, TopBar } from "../components/ui";
import { decimal } from "../format";

function Group({ id, title, children }: { id: string; title: string; children: ReactNode }) {
    return (
        <section aria-labelledby={id}>
            <h2 id={id} className="wf-sec">{title}</h2>
            <div className="wf-group">{children}</div>
        </section>
    );
}

function SwitchRow({ id, title, sub, checked, onChange }: { id: string; title: string; sub?: string; checked: boolean; onChange: (v: boolean) => void }) {
    return <Row titleId={id} title={title} sub={sub} trailing={<Toggle labelledBy={id} checked={checked} onChange={onChange} />} />;
}

export default function SettingsPage() {
    const s = useSettings();
    const logSize = useLogSize();
    const navigate = useNavigate();
    const permission = useSensorPermission();
    const aligned = Object.keys(s.headingOffsets ?? {}).length;
    const back = () => (window.history.length > 1 ? navigate(-1) : navigate("/"));
    const sensorText = !hasMotionSensors
        ? "Thiết bị này không có cảm biến chuyển động. Dùng QR, chọn trên bản đồ hoặc mô phỏng."
        : permission === "granted" ? "Đã cho phép" : permission === "denied" ? "Bị từ chối, bật lại trong cài đặt trình duyệt" : "Chưa cho phép";

    return (
        <div className="wf-screen">
            <TopBar title="Cài đặt" onBack={back} />
            <main className="wf-main">
                <Group id="g-show" title="Hiển thị">
                    <SwitchRow id="s-large" title="Chữ lớn" sub={`Chỉ dẫn to hơn ${decimal(1.3, 1)} lần`} checked={s.largeText} onChange={v => updateSettings({ largeText: v })} />
                </Group>

                <Group id="g-route" title="Tuyến đường">
                    <SwitchRow id="s-stairs" title="Chỉ dùng thang máy" sub="Tránh thang cuốn và thang bộ" checked={s.avoidStairs} onChange={v => updateSettings({ avoidStairs: v })} />
                    <SwitchRow id="s-vib" title="Rung khi tới lượt rẽ" checked={s.vibrate} onChange={v => updateSettings({ vibrate: v })} />
                    <SwitchRow id="s-voice" title="Đọc chỉ dẫn bằng giọng nói" sub="Giọng tiếng Việt của máy, nếu có" checked={s.voice} onChange={v => {
                        updateSettings({ voice: v });
                        if (v) speak("Đã bật đọc chỉ dẫn");
                    }} />
                </Group>

                <Group id="g-pos" title="Định vị">
                    <Row title="Chiều dài bước" sub={`${decimal(s.stepLength)} m mỗi bước`} to="/settings/stride" trailing={<span className="wf-t15 wf-row-val">Đo lại</span>} chevron />
                    <Row title="Căn hướng la bàn" sub={aligned ? `Đã căn ở ${aligned} địa điểm` : "Chưa căn, căn trong lúc đang đi"}
                        trailing={aligned ? <button type="button" className="wf-link wf-t15" onClick={() => updateSettings({ headingOffsets: {} })}>Xoá</button> : undefined} />
                    <Row title="Thử vẽ đường đi" sub="Đi một vòng kín, xem cảm biến vẽ lại có khép không" to="/settings/path-test" chevron />
                    <SwitchRow id="s-pf" title="Định vị nâng cao (thử nghiệm)"
                        sub="Bước chân + con quay + lối đi đã vẽ: tự học bước chân, tự sửa sai số qua khúc cua"
                        checked={s.positioning === "pf"} onChange={v => updateSettings({ positioning: v ? "pf" : "basic" })} />
                    <div className="wf-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
                        <span className="wf-row-text"><span className="wf-t17">GPS khi chỉ đường</span>
                            <span className="wf-t13">Tự động: chỉ ở bản đồ ngoài trời. Bật: cả bản đồ có bản vẽ, để thử ngoài trời</span></span>
                        <Segmented label="GPS khi chỉ đường" value={s.gpsMode} onChange={v => updateSettings({ gpsMode: v })}
                            options={[{ value: "auto", label: "Tự động" }, { value: "on", label: "Bật" }, { value: "off", label: "Tắt" }]} />
                    </div>
                    {s.positioning === "pf" && (
                        <SwitchRow id="s-particles" title="Hiện các giả thuyết trên bản đồ" sub="Chấm nhỏ màu xanh, dùng khi đi thử"
                            checked={s.showParticles} onChange={v => updateSettings({ showParticles: v })} />
                    )}
                    {s.positioning === "pf" && (
                        <SwitchRow id="s-log" title="Ghi nhật ký cảm biến" sub="Để chạy lại trên máy tính và tinh chỉnh; quét QR dọc đường làm điểm đo sai số"
                            checked={s.recordLog} onChange={v => updateSettings({ recordLog: v })} />
                    )}
                    {logSize > 0 && (
                        <Row title="Nhật ký cảm biến" sub={`${logSize.toLocaleString("vi-VN")} mục trong bộ nhớ${lastLogUpload() ? (lastLogUpload()!.ok ? ", đã gửi về máy" : ", chưa gửi được") : ""}`}
                            trailing={
                                <span className="wf-row-val">
                                    <button type="button" className="wf-link wf-t15" onClick={() => void uploadLog()}>Gửi về máy</button>{" · "}
                                    <button type="button" className="wf-link wf-t15" onClick={downloadLog}>Tải về</button>{" · "}
                                    <button type="button" className="wf-link wf-t15" onClick={clearLog}>Xoá</button>
                                </span>
                            } />
                    )}
                    {(s.weinbergK != null || s.strideCalibration) && (
                        <Row title="Bước chân đã học"
                            sub={[
                                s.strideCalibration ? `Đo bằng GPS trên ${Math.round(s.strideCalibration.meters)} m ngoài trời: ${decimal(s.strideCalibration.stepLength)} m/bước` : null,
                                s.weinbergK != null ? `hệ số ${decimal(s.weinbergK, 3)}` : null
                            ].filter(Boolean).join(", ")}
                            trailing={<button type="button" className="wf-link wf-t15" onClick={() => updateSettings({ weinbergK: null, strideCalibration: null })}>Xoá</button>} />
                    )}
                    <Row title="La bàn và đếm bước" sub={sensorText}
                        trailing={hasMotionSensors && needsSensorPermission && permission !== "granted"
                            ? <button type="button" className="wf-link wf-t15" onClick={() => void requestSensorPermission()}>Cho phép</button> : undefined} />
                </Group>

                <Group id="g-data" title="Dữ liệu trên máy">
                    {s.recent.length > 0
                        ? <Row title={<span className="wf-danger">Xoá lịch sử tìm kiếm</span>} sub={`${s.recent.length} mục`} onClick={() => updateSettings({ recent: [] })} />
                        : <Row title="Lịch sử tìm kiếm" sub="Chưa có mục nào" />}
                    <Row title="Nguồn dữ liệu" sub={api.source === "static" ? "Bản chụp tĩnh đi kèm website" : "Máy chủ Indoor Map"} />
                </Group>

                <Group id="g-about" title="Giới thiệu">
                    <Row title="Phiên bản" trailing={<span className="wf-t15 wf-row-val">2.0</span>} />
                    <Row title="Quản lý toà nhà?" sub="Dựng bản đồ với Builder" to="/builder" chevron />
                </Group>
            </main>
        </div>
    );
}
