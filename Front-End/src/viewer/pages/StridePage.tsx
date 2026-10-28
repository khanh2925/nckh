import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { stepLengthFrom } from "@indoor-map/core";
import { hasMotionSensors, needsSensorPermission, requestSensorPermission, useStepDetector, vibrate } from "../../lib/sensors";
import { updateSettings, useSettings } from "../../lib/settings";
import { Button, Row, Status, TopBar } from "../components/ui";
import { decimal } from "../format";

const DEFAULT_STEP = 0.7;
type Phase = "idle" | "walking" | "done" | "failed";

// Đo bước chân (Viewer-Stride): đi bình thường trên một quãng biết trước chiều dài, cảm biến gia tốc đếm bước, chia ra.
// Kết quả lưu vào Cài đặt (stepLength) và dùng cho đếm bước khi chỉ đường.
export default function StridePage() {
    const settings = useSettings();
    const navigate = useNavigate();
    const [meters, setMeters] = useState("10");
    const [phase, setPhase] = useState<Phase>("idle");
    const [steps, setSteps] = useState(0);
    const [result, setResult] = useState<number | null>(null);
    const [denied, setDenied] = useState(false);
    const onStep = useCallback(() => {
        setSteps(n => n + 1);
        vibrate(15);
    }, []);
    const live = useStepDetector(phase === "walking", onStep);
    const distance = Number(meters.replace(",", "."));
    const valid = distance >= 3 && distance <= 200;
    const back = () => (window.history.length > 1 ? navigate(-1) : navigate("/settings"));

    const start = async () => {
        if (needsSensorPermission && (await requestSensorPermission()) !== "granted") {
            setDenied(true);
            return;
        }
        setDenied(false);
        setSteps(0);
        setResult(null);
        setPhase("walking");
    };
    const stop = () => {
        const value = stepLengthFrom(distance, steps);
        setResult(value);
        setPhase(value == null ? "failed" : "done");
    };
    const save = () => {
        if (result == null) return;
        updateSettings({ stepLength: result });
        back();
    };
    const isDefault = Math.abs(settings.stepLength - DEFAULT_STEP) < 0.005;

    return (
        <div className="wf-screen">
            <TopBar title="Đo bước chân" onBack={back} />
            <main className="wf-main">
                <section className="wf-card is-white" aria-live="polite" style={{ textAlign: "center", padding: "32px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
                    {phase === "walking" ? (
                        <>
                            <Status icon={live ? "footprints" : "clock"} tone={live ? "ok" : undefined}>{live ? "Đang đếm bước" : "Đang chờ cảm biến…"}</Status>
                            <p className="wf-t44">{steps}<small>bước</small></p>
                        </>
                    ) : phase === "done" && result != null ? (
                        <>
                            <Status icon="circle-check" tone="ok">Đã đo xong</Status>
                            <p className="wf-t44">{decimal(result)}<small>m</small></p>
                            <p className="wf-t13">mỗi bước</p>
                        </>
                    ) : phase === "failed" ? (
                        <>
                            <Status icon="triangle-alert" tone="warn">Không đếm được đủ bước</Status>
                            <p className="wf-t44">{steps}<small>bước</small></p>
                            <p className="wf-t13">Cần ít nhất 4 bước. Thử quãng dài hơn, cầm máy trước ngực.</p>
                        </>
                    ) : (
                        <>
                            <p className="wf-t13">Hiện tại</p>
                            <p className="wf-t44">{decimal(settings.stepLength)}<small>m</small></p>
                            <p className="wf-t13">mỗi bước{isDefault ? ", mặc định" : ""}</p>
                        </>
                    )}
                </section>

                {phase === "done" && result != null ? (
                    <section aria-labelledby="st-detail">
                        <h2 id="st-detail" className="wf-sec">Chi tiết</h2>
                        <div className="wf-group">
                            <Row title={isDefault ? "Mặc định" : "Đang dùng"} trailing={<span className="wf-t15 wf-row-val">{decimal(settings.stepLength)} m</span>} />
                            <Row title="Lần đo này" trailing={<span className="wf-t15 wf-row-val">{steps} bước trên {decimal(distance, distance % 1 ? 1 : 0)} m</span>} />
                        </div>
                    </section>
                ) : phase === "walking" ? (
                    <div className="wf-card is-white">
                        <p className="wf-t17">Đi thẳng hết quãng {decimal(distance, distance % 1 ? 1 : 0)} m</p>
                        <p className="wf-t15 wf-muted" style={{ marginTop: 4 }}>Dừng ngay ở cuối quãng rồi bấm Dừng.</p>
                    </div>
                ) : (
                    <section aria-labelledby="st-how">
                        <h2 id="st-how" className="wf-sec">Cách đo</h2>
                        <div className="wf-group" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
                            <div>
                                <p className="wf-t17">Đi trên quãng đã biết dài</p>
                                <p className="wf-t13" style={{ marginTop: 4 }}>Ví dụ hành lang 10 m, hoặc 5 viên gạch 60 cm là 3 m</p>
                            </div>
                            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span className="wf-t15" style={{ flex: 1 }}>Chiều dài quãng</span>
                                <input className="wf-input" style={{ width: 96, textAlign: "right" }} inputMode="decimal" aria-label="Chiều dài quãng, mét" value={meters}
                                    onChange={e => setMeters(e.target.value.replace(/[^\d.,]/g, ""))} />
                                <span className="wf-t15 wf-muted">m</span>
                            </label>
                        </div>
                    </section>
                )}

                {!hasMotionSensors && <Status icon="info">Thiết bị này không có cảm biến chuyển động nên không đo được bước chân.</Status>}
                {denied && <Status icon="triangle-alert" tone="warn">Chưa có quyền chuyển động. Bật lại trong cài đặt trình duyệt.</Status>}
                {phase !== "done" && <p className="wf-t13">Cầm máy trước ngực, đi đều như bình thường.</p>}
            </main>
            <div className="wf-foot">
                {phase === "walking" ? (
                    <Button onClick={stop}>Dừng</Button>
                ) : phase === "done" ? (
                    <>
                        <Button onClick={save}>Lưu</Button>
                        <Button variant="text" onClick={() => setPhase("idle")}>Đo lại</Button>
                    </>
                ) : (
                    <>
                        <Button icon="footprints" onClick={() => void start()} disabled={!hasMotionSensors || !valid}>{phase === "failed" ? "Đo lại" : "Bắt đầu đo"}</Button>
                        {!isDefault && <Button variant="text" onClick={() => updateSettings({ stepLength: DEFAULT_STEP })}>Về mặc định {decimal(DEFAULT_STEP)} m</Button>}
                    </>
                )}
            </div>
        </div>
    );
}
