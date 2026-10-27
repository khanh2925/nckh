import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { findNodeByCode, parseQrPayload, type VenueModel } from "@indoor-map/core";
import { cameraErrorMessage, openRearCamera, startQrScan, stopStream } from "../../lib/camera";
import { useVenue } from "../VenueContext";
import Icon from "../components/Icon";
import { Button, IconButton } from "../components/ui";

// Quét mã QR định vị (hoặc gõ mã in dưới QR). Mỗi mã gắn với một nút lối đi: quét xong là biết vị trí tới ~1 m.
// ?then=go | camera | map | search | <đường dẫn con, ví dụ route?to=12>: quét xong đi đâu.
// Dùng được cả ngoài trang địa điểm (/scan): khi đó chỉ đọc slug trong mã rồi chuyển sang /q/<slug>/<mã>.

function useCameraScan(onCode: (text: string) => void) {
    const video = useRef<HTMLVideoElement>(null);
    const [error, setError] = useState<string | null>(null);
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
    }, []);

    const toggleTorch = async () => {
        if (!torch) return;
        try {
            await torch.track.applyConstraints({ advanced: [{ torch: !torch.on } as MediaTrackConstraintSet] });
            setTorch({ ...torch, on: !torch.on });
        } catch {
            // không hỗ trợ
        }
    };
    return { video, error, canTorch: Boolean(torch), torchOn: torch?.on ?? false, toggleTorch };
}

function ScanScreen({ onCode, model, backTo, message }: { onCode: (text: string) => void; model: VenueModel | null; backTo: string; message: string | null }) {
    const { video, error, canTorch, torchOn, toggleTorch } = useCameraScan(onCode);
    const [code, setCode] = useState("");
    const sample = model?.walkways.nodes.find(n => n.connector)?.id ?? model?.walkways.nodes[0]?.id;
    const submit = (e: FormEvent) => {
        e.preventDefault();
        if (code.trim()) onCode(code.trim());
    };

    return (
        <div className="wf-screen is-dark">
            <div className="wf-camera">
                <video ref={video} playsInline muted aria-label="Hình từ camera sau" />
                {error && <div className="wf-camera-error"><Icon name="camera" size={32} /><p>{error}</p><p>Bạn vẫn có thể gõ mã in dưới QR ở bên dưới.</p></div>}
                <div className="wf-viewfinder" aria-hidden="true"><i /><i /><i /><i /><span /></div>
                <div className="wf-camera-top">
                    <IconButton icon="close" label="Đóng" to={backTo} />
                    <div className="wf-camera-title">QUÉT MÃ QR ĐỊNH VỊ</div>
                    {canTorch ? <IconButton icon="torch" label={torchOn ? "Tắt đèn" : "Bật đèn"} onClick={() => void toggleTorch()} variant={torchOn ? "is-live" : "is-ghost"} /> : <span style={{ width: 44 }} />}
                </div>
                <p className="wf-camera-help">Hướng camera vào mã QR dán trên <b>cột</b> hoặc <b>biển chỉ dẫn</b>. Mỗi mã gắn với một điểm trên bản đồ — vị trí của bạn sẽ chính xác tới ~1 m.</p>
                {message && <div className="wf-camera-toast" role="alert">{message}</div>}
            </div>
            <form className="wf-sheet" onSubmit={submit}>
                <label htmlFor="qr-code" className="wf-kicker">HOẶC NHẬP MÃ IN DƯỚI QR</label>
                <div className="wf-row-actions">
                    <input id="qr-code" className="wf-code-input" value={code} onChange={e => setCode(e.target.value.toUpperCase())}
                        placeholder={sample ? `Ví dụ ${sample}` : "Mã vị trí"} autoCapitalize="characters" autoComplete="off" spellCheck={false} />
                    <button type="submit" className="wf-btn wf-btn-primary" disabled={!code.trim()}>Định vị</button>
                </div>
            </form>
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

    const backTo = then === "go" || then === "camera" ? `/v/${slug}/${then}` : then.startsWith("route") ? `/v/${slug}/${then}` : `/v/${slug}/map`;

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

    return <ScanScreen onCode={onCode} model={model} backTo={backTo} message={message} />;
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

/** /q/:slug/:code — mở từ app camera của điện thoại: định vị rồi mở bản đồ */
export function QrEntryPage() {
    const { code = "" } = useParams();
    const { slug, model, trip: anyTrip, fixPosition, setPosition } = useVenue();
    const trip = anyTrip && !anyTrip.arrived ? anyTrip : null;
    const node = model ? findNodeByCode(model, code) : null;
    useEffect(() => {
        if (!node) return;
        const point = { floorId: node.floorId, lat: node.lat, lng: node.lng, source: "qr" as const, nodeId: node.id, label: `Mã QR ${node.id}` };
        if (trip) fixPosition(point);
        else setPosition(point);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [node]);
    if (!node) {
        return (
            <div className="wf-screen wf-center">
                <div className="wf-error"><div className="wf-error-title">Mã “{code}” không có trên bản đồ</div><p>Có thể mã đã bị thay. Mở bản đồ và chọn vị trí bằng tay.</p>
                    <Button to={`/v/${slug}/map`} variant="secondary">Mở bản đồ</Button></div>
            </div>
        );
    }
    return (
        <div className="wf-screen wf-center">
            <div className="wf-qr-ok">
                <Icon name="check" size={40} stroke={3} />
                <h1 className="wf-h1">Bạn đang ở {model?.floorsById.get(node.floorId)?.buildingCode} · {model?.floorsById.get(node.floorId)?.name}</h1>
                <p className="wf-muted">Mã {node.id}</p>
                <Button to={trip ? `/v/${slug}/go` : `/v/${slug}/map?floor=${node.floorId}`} replace icon="layers">{trip ? "Tiếp tục chỉ đường" : "Mở bản đồ"}</Button>
                {!trip && <Link className="wf-link" to={`/v/${slug}/search`}>Tìm nơi cần đến →</Link>}
            </div>
        </div>
    );
}
