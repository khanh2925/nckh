import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { findNodeByCode, parseQrPayload, type VenueModel } from "@indoor-map/core";
import Lc from "../../design/Lc";
import { cameraErrorMessage, openRearCamera, startQrScan, stopStream } from "../../lib/camera";
import { useVenue } from "../VenueContext";
import { MapSkeleton } from "../VenueLayout";
import { Button, IconButton, Sheet } from "../components/ui";
import MapPage from "./MapPage";

// Quét mã QR định vị (hoặc gõ mã in dưới QR). Mỗi mã gắn với một nút lối đi: quét xong là biết vị trí tới ~1 m.
// ?then=go | camera | map | search | <đường dẫn con, ví dụ route?to=12>: quét xong đi đâu.
// Dùng được cả ngoài trang địa điểm (/scan): khi đó chỉ đọc slug trong mã rồi chuyển sang /q/<slug>/<mã>.

function useCameraScan(onCode: (text: string) => void) {
    const video = useRef<HTMLVideoElement>(null);
    const [error, setError] = useState<string | null>(null);
    const [attempt, setAttempt] = useState(0);
    const [torch, setTorch] = useState<{ on: boolean; track: MediaStreamTrack } | null>(null);
    const callback = useRef(onCode);
    useEffect(() => {
        callback.current = onCode;
    }, [onCode]);

    useEffect(() => {
        let stream: MediaStream | null = null;
        let stop: (() => void) | null = null;
        let alive = true;
        openRearCamera()
            .then(async s => {
                if (!alive) return stopStream(s);
                stream = s;
                setError(null);
                const el = video.current;
                if (!el) return;
                el.srcObject = s;
                await el.play().catch(() => undefined);
                stop = startQrScan(el, text => callback.current(text));
                const track = s.getVideoTracks()[0];
                const caps = track?.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean }) | undefined;
                if (track && caps?.torch) setTorch({ on: false, track });
            })
            .catch(err => alive && setError(cameraErrorMessage(err)));
        return () => {
            alive = false;
            stop?.();
            stopStream(stream);
        };
    }, [attempt]);

    const toggleTorch = async () => {
        if (!torch) return;
        try {
            await torch.track.applyConstraints({ advanced: [{ torch: !torch.on } as MediaTrackConstraintSet] });
            setTorch({ ...torch, on: !torch.on });
        } catch {
            // không hỗ trợ
        }
    };
    return { video, error, retry: () => setAttempt(a => a + 1), canTorch: Boolean(torch), torchOn: torch?.on ?? false, toggleTorch };
}

function ScanScreen({ onCode, model, backTo, message, pickTo }: { onCode: (text: string) => void; model: VenueModel | null; backTo: string; message: string | null; pickTo?: string }) {
    const navigate = useNavigate();
    const { video, error, retry, canTorch, torchOn, toggleTorch } = useCameraScan(onCode);
    const [code, setCode] = useState("");
    const sample = model?.walkways.nodes.find(n => n.connector)?.id ?? model?.walkways.nodes[0]?.id;
    const submit = (e: FormEvent) => {
        e.preventDefault();
        if (code.trim()) onCode(code.trim());
    };

    return (
        <div className="wf-screen wf-dark">
            <div className="wf-camera">
                <video ref={video} playsInline muted aria-label="Hình từ camera sau" />
                {!error && <div className="wf-viewfinder" aria-hidden="true"><i /><i /><i /><i /><span /></div>}
                <div className="wf-cam-top">
                    <IconButton icon="x" label="Đóng" to={backTo} />
                    <div>
                        <h1 className="wf-t17">Quét mã QR</h1>
                        <p className="wf-t13" style={{ color: "color-mix(in srgb, var(--surface) 72%, var(--graphite))" }}>Mã dán trên cột hoặc biển chỉ dẫn</p>
                    </div>
                    {canTorch && (
                        <button type="button" className="wf-chip is-text" onClick={() => void toggleTorch()}>{torchOn ? "Tắt đèn" : "Đèn"}</button>
                    )}
                </div>
                {error && (
                    <div className="wf-cam-msg">
                        <div className="wf-card is-white" role="alert" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                            <Lc name="camera-off" size={24} />
                            <div>
                                <h2 className="wf-t22">Chưa mở được camera</h2>
                                <p className="wf-t15 wf-muted" style={{ marginTop: 8 }}>{error} Bạn vẫn có thể nhập mã in dưới QR.</p>
                            </div>
                            <Button variant="secondary" icon="refresh-cw" onClick={retry}>Thử lại</Button>
                        </div>
                    </div>
                )}
                {message && (
                    <div className="wf-cam-msg is-top">
                        <div className="wf-card is-white" role="alert"><p className="wf-t15 wf-status wf-warn"><Lc name="triangle-alert" size={20} />{message}</p></div>
                    </div>
                )}
            </div>
            <Sheet label="Nhập mã">
                <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <label htmlFor="qr-code" className="wf-t17">Nhập mã in dưới QR</label>
                    <div className="wf-acts">
                        <input id="qr-code" className="wf-input" style={{ flex: 1, minWidth: 0 }} value={code} onChange={e => setCode(e.target.value.toUpperCase())}
                            placeholder={sample ? `VD: ${sample}` : "Mã vị trí"} autoCapitalize="characters" autoComplete="off" spellCheck={false} enterKeyHint="go" />
                        <Button type="submit" disabled={!code.trim()}>Đặt vị trí</Button>
                    </div>
                </form>
                {pickTo && <Button variant="text" onClick={() => navigate(pickTo, { replace: true })}>Không thấy mã? Chọn trên bản đồ</Button>}
            </Sheet>
        </div>
    );
}

/** /v/:slug/scan */
export default function ScanPage() {
    const { slug, model, trip: anyTrip, fixPosition, setPosition } = useVenue();
    const trip = anyTrip && !anyTrip.arrived ? anyTrip : null;
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const then = params.get("then") ?? "map";
    const [message, setMessage] = useState<string | null>(null);
    const handled = useRef(false);

    const backTo = then === "go" || then === "camera" || then.startsWith("route") || then.startsWith("place") || then.startsWith("share") ? `/v/${slug}/${then}` : `/v/${slug}/map`;

    const onCode = (text: string) => {
        if (handled.current || !model) return;
        const payload = parseQrPayload(text);
        if (!payload) return;
        if (payload.slug && payload.slug !== slug) {
            handled.current = true;
            navigate(`/q/${payload.slug}/${encodeURIComponent(payload.code)}`, { replace: true });
            return;
        }
        const node = findNodeByCode(model, payload.code);
        if (!node) {
            setMessage(`Mã “${payload.code}” không thuộc ${model.venue.name}.`);
            window.setTimeout(() => setMessage(null), 2500);
            return;
        }
        handled.current = true;
        const point = { floorId: node.floorId, lat: node.lat, lng: node.lng, source: "qr" as const, nodeId: node.id, label: `Mã QR ${node.id}` };
        if (trip) fixPosition(point);
        else setPosition(point);
        if (then === "go" || then === "camera") navigate(`/v/${slug}/${trip ? then : "map"}`, { replace: true });
        else if (then === "map") navigate(`/v/${slug}/map?floor=${node.floorId}`, { replace: true });
        else navigate(`/v/${slug}/${then}`, { replace: true });
    };

    const floorId = trip?.route.legs[trip.activeLeg]?.floorId ?? model?.defaultFloor?.id ?? "";
    return <ScanScreen onCode={onCode} model={model} backTo={backTo} message={message}
        pickTo={`/v/${slug}/map?pick=position&floor=${floorId}&return=${encodeURIComponent(then)}`} />;
}

/** /scan — ngoài trang địa điểm: mã phải có slug (URL /q/<slug>/<mã> hoặc <slug>:<mã>) */
export function GlobalScanPage() {
    const navigate = useNavigate();
    const [message, setMessage] = useState<string | null>(null);
    const onCode = (text: string) => {
        const payload = parseQrPayload(text);
        if (payload?.slug) navigate(`/q/${payload.slug}/${encodeURIComponent(payload.code)}`, { replace: true });
        else {
            setMessage("Mã này không ghi tên địa điểm. Mở địa điểm trước rồi quét lại.");
            window.setTimeout(() => setMessage(null), 3000);
        }
    };
    return <ScanScreen onCode={onCode} model={null} backTo="/" message={message} />;
}

/** /q/:slug/:code — mở từ app camera của điện thoại (Viewer-QRLanding): định vị rồi hiện "Bạn đang ở đây" trên bản đồ */
export function QrEntryPage() {
    const { code = "" } = useParams();
    const { model, position, trip: anyTrip, fixPosition, setPosition } = useVenue();
    const trip = anyTrip && !anyTrip.arrived ? anyTrip : null;
    const node = model ? findNodeByCode(model, code) : null;
    useEffect(() => {
        if (!node) return;
        const point = { floorId: node.floorId, lat: node.lat, lng: node.lng, source: "qr" as const, nodeId: node.id, label: `Mã QR ${node.id}` };
        if (trip) fixPosition(point);
        else setPosition(point);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [node]);
    if (!node) return <MapPage mode="landing" landingCode={code} landingMissing />;
    // Chờ vị trí mới vào state để bản đồ mở đúng tầng, đúng chỗ
    if (position?.nodeId !== node.id) return <MapSkeleton text="Đang đặt vị trí của bạn…" />;
    return <MapPage mode="landing" landingCode={code} />;
}
