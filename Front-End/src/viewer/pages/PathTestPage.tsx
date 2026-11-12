import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { weinbergLength } from "@indoor-map/core";
import { hasMotionSensors, needsSensorPermission, requestSensorPermission, usePdrSensors, vibrate, type PdrStep } from "../../lib/sensors";
import { useSettings } from "../../lib/settings";
import { Button, Status, TopBar } from "../components/ui";
import { decimal } from "../format";

type Phase = "idle" | "walking" | "done";
interface Point { x: number; y: number }

// Thử vẽ đường đi (không cần bản đồ): cộng dồn từng bước chân theo hướng con quay rồi vẽ ra.
// Đi một vòng kín (hình vuông) và xem đường vẽ có khép lại không: "điểm cuối cách điểm đầu" là sai số khép vòng,
// phép thử quen thuộc của PDR. Dùng đúng bộ đếm bước, độ dài bước Weinberg và hướng của định vị nâng cao,
// nhưng KHÔNG có bản đồ kéo về lối đi, nên thấy được cảm biến tự nó trôi bao nhiêu.
export default function PathTestPage() {
    const settings = useSettings();
    const navigate = useNavigate();
    const [phase, setPhase] = useState<Phase>("idle");
    const [path, setPath] = useState<Point[]>([{ x: 0, y: 0 }]);
    const [walked, setWalked] = useState(0);
    const [noHeading, setNoHeading] = useState(false);
    const [denied, setDenied] = useState(false);
    const origin = useRef<number | null>(null);
    const k = settings.weinbergK;
    const stepOf = useCallback((s: PdrStep) => (k != null ? weinbergLength(k, s.amplitude) : settings.stepLength), [k, settings.stepLength]);

    const addStep = useCallback((length: number, heading: number) => {
        // xoay để hướng lúc bắt đầu đi luôn là "lên trên"
        origin.current ??= heading;
        const rad = ((heading - origin.current) * Math.PI) / 180;
        setPath(p => {
            const last = p[p.length - 1]!;
            return [...p, { x: last.x + Math.sin(rad) * length, y: last.y - Math.cos(rad) * length }];
        });
        setWalked(w => w + length);
    }, []);

    const onStep = useCallback((s: PdrStep) => {
        if (s.heading == null) {
            setNoHeading(true);
            return;
        }
        vibrate(10);
        addStep(stepOf(s), s.heading);
    }, [addStep, stepOf]);
    const { active } = usePdrSensors(phase === "walking", onStep);

    const reset = () => {
        origin.current = null;
        setPath([{ x: 0, y: 0 }]);
        setWalked(0);
        setNoHeading(false);
    };
    const start = async () => {
        if (needsSensorPermission && (await requestSensorPermission()) !== "granted") {
            setDenied(true);
            return;
        }
        setDenied(false);
        reset();
        setPhase("walking");
    };
    // Máy tính không có cảm biến: giả lập đi hình vuông cạnh 10 m, có nhiễu, để xem màn hình chạy thế nào
    const simulate = () => {
        reset();
        let heading = 0;
        for (let side = 0; side < 4; side++) {
            for (let i = 0; i < 14; i++) addStep(0.7 + (Math.random() - 0.5) * 0.12, heading + (Math.random() - 0.5) * 8);
            heading += 90 + (Math.random() - 0.5) * 10;
        }
        setPhase("done");
    };

    const end = path[path.length - 1]!;
    const gap = Math.hypot(end.x, end.y);
    const steps = path.length - 1;
    const view = useMemo(() => {
        const xs = path.map(p => p.x);
        const ys = path.map(p => p.y);
        const pad = 2;
        const minX = Math.min(...xs, -5) - pad;
        const maxX = Math.max(...xs, 5) + pad;
        const minY = Math.min(...ys, -5) - pad;
        const maxY = Math.max(...ys, 5) + pad;
        const size = Math.max(maxX - minX, maxY - minY);
        return { x: (minX + maxX) / 2 - size / 2, y: (minY + maxY) / 2 - size / 2, size };
    }, [path]);
    const grid = view.size > 60 ? 10 : 5;
    const lines: number[] = [];
    for (let v = Math.floor(view.x / grid) * grid; v <= view.x + view.size; v += grid) lines.push(v);
    const rows: number[] = [];
    for (let v = Math.floor(view.y / grid) * grid; v <= view.y + view.size; v += grid) rows.push(v);
    const stroke = view.size / 120;

    return (
        <div className="wf-screen">
            <TopBar title="Thử vẽ đường đi" onBack={() => (window.history.length > 1 ? navigate(-1) : navigate("/settings"))} />
            <main className="wf-main is-tight">
                <section className="wf-card is-white" style={{ padding: 8 }} aria-label="Đường đi đã vẽ">
                    <svg viewBox={`${view.x} ${view.y} ${view.size} ${view.size}`} style={{ width: "100%", aspectRatio: "1 / 1", display: "block" }} role="img"
                        aria-label={`Đường đi ${steps} bước, điểm cuối cách điểm đầu ${decimal(gap, 1)} m`}>
                        {lines.map(v => <line key={`x${v}`} x1={v} x2={v} y1={view.y} y2={view.y + view.size} stroke="var(--line, #E5E5E5)" strokeWidth={stroke * 0.5} />)}
                        {rows.map(v => <line key={`y${v}`} y1={v} y2={v} x1={view.x} x2={view.x + view.size} stroke="var(--line, #E5E5E5)" strokeWidth={stroke * 0.5} />)}
                        {steps > 0 && (
                            <polyline points={path.map(p => `${p.x},${p.y}`).join(" ")} fill="none" stroke="var(--signal, #155DFC)" strokeWidth={stroke * 2.5}
                                strokeLinejoin="round" strokeLinecap="round" />
                        )}
                        {steps > 0 && phase === "done" && <line x1={end.x} y1={end.y} x2={0} y2={0} stroke="var(--danger, #DC2626)" strokeWidth={stroke * 1.5} strokeDasharray={`${stroke * 4} ${stroke * 3}`} />}
                        <circle cx={0} cy={0} r={stroke * 5} fill="var(--ok, #16A34A)" />
                        {steps > 0 && <circle cx={end.x} cy={end.y} r={stroke * 5} fill="var(--signal, #155DFC)" stroke="#fff" strokeWidth={stroke * 1.5} />}
                    </svg>
                    <p className="wf-t13" style={{ textAlign: "center", marginTop: 4 }}>Mỗi ô {grid} m. Chấm xanh lá là điểm bắt đầu.</p>
                </section>

                <div className="wf-stats">
                    <div><p className="wf-t17">{steps}</p><p className="wf-t13">bước</p></div>
                    <div><p className="wf-t17">{decimal(walked, 1)} m</p><p className="wf-t13">đã đi</p></div>
                    <div><p className="wf-t17">{decimal(gap, 1)} m</p><p className="wf-t13">cuối cách đầu{walked > 0 ? `, ${Math.round((gap / walked) * 100)}%` : ""}</p></div>
                </div>

                {phase === "walking" && <Status icon={active ? "footprints" : "clock"} tone={active ? "ok" : undefined}>{active ? "Đang ghi, đi đều 4 bước đầu để bắt nhịp" : "Đang chờ cảm biến…"}</Status>}
                {noHeading && <Status icon="triangle-alert" tone="warn">Máy không gửi hướng (con quay), không vẽ được hướng đi.</Status>}
                {denied && <Status icon="triangle-alert" tone="warn">Chưa có quyền chuyển động. Bật lại trong cài đặt trình duyệt.</Status>}
                {phase === "idle" && (
                    <div className="wf-card">
                        <p className="wf-t17">Đi một hình vuông rồi quay về chỗ cũ</p>
                        <p className="wf-t13" style={{ marginTop: 4 }}>
                            Cầm máy trước ngực, đánh dấu chỗ đứng. Đi thẳng khoảng 10 bước, rẽ phải, lặp lại đủ 4 cạnh, dừng đúng chỗ ban đầu rồi bấm Dừng.
                            Khép càng sát thì cảm biến càng tốt.
                        </p>
                        <p className="wf-t13" style={{ marginTop: 8 }}>
                            Độ dài bước: {k != null ? `công thức Weinberg, hệ số đã học ${decimal(k, 2)}` : `${decimal(settings.stepLength)} m mỗi bước (chưa học được bước chân)`}.
                        </p>
                    </div>
                )}
                {phase === "done" && steps > 0 && (
                    <p className="wf-t13">
                        Điểm cuối cách điểm đầu {decimal(gap, 1)} m sau {decimal(walked, 1)} m. Nếu bạn dừng đúng chỗ ban đầu thì đây là sai số khép vòng.
                        Hình bị xoay hoặc méo đều là do hướng (con quay); cạnh dài ngắn sai là do độ dài bước.
                    </p>
                )}
            </main>
            <div className="wf-foot" style={{ display: "flex", gap: 8 }}>
                {phase === "walking" ? (
                    <Button onClick={() => setPhase("done")}>Dừng</Button>
                ) : (
                    <>
                        {!hasMotionSensors && <Button variant="secondary" onClick={simulate}>Giả lập</Button>}
                        <Button icon="footprints" onClick={() => void start()} disabled={!hasMotionSensors}>{phase === "done" ? "Đi lại" : "Bắt đầu"}</Button>
                    </>
                )}
            </div>
        </div>
    );
}
