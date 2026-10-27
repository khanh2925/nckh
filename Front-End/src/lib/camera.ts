import jsQR from "jsqr";

/** Mở camera sau. Trình duyệt chỉ cho phép trên HTTPS (hoặc localhost). */
export async function openRearCamera(): Promise<MediaStream> {
    if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Trình duyệt không cho dùng camera. Mở trang bằng HTTPS hoặc dùng trình duyệt khác.");
    }
    return navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }
    });
}

export function stopStream(stream: MediaStream | null): void {
    stream?.getTracks().forEach(track => track.stop());
}

export function cameraErrorMessage(error: unknown): string {
    const name = (error as { name?: string })?.name;
    if (name === "NotAllowedError" || name === "SecurityError") return "Bạn chưa cho phép dùng camera. Bật lại trong cài đặt trình duyệt của trang này.";
    if (name === "NotFoundError" || name === "OverconstrainedError") return "Không tìm thấy camera trên thiết bị này.";
    if (name === "NotReadableError") return "Camera đang được ứng dụng khác dùng.";
    return (error as Error)?.message || "Không mở được camera.";
}

/**
 * Quét liên tục khung hình từ <video>. Dùng BarcodeDetector khi trình duyệt có (Chrome Android),
 * không thì jsQR (Safari iOS). Trả về hàm dừng.
 */
export function startQrScan(video: HTMLVideoElement, onResult: (text: string) => void): () => void {
    let stopped = false;
    let timer: number | undefined;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    let detector: BarcodeDetector | null = null;
    if (typeof BarcodeDetector !== "undefined") {
        try {
            detector = new BarcodeDetector({ formats: ["qr_code"] });
        } catch {
            detector = null;
        }
    }

    const tick = async () => {
        if (stopped) return;
        if (video.readyState >= 2 && video.videoWidth > 0) {
            try {
                let text: string | null = null;
                if (detector) {
                    text = (await detector.detect(video))[0]?.rawValue ?? null;
                } else if (context) {
                    const scale = Math.min(1, 640 / video.videoWidth);
                    canvas.width = Math.round(video.videoWidth * scale);
                    canvas.height = Math.round(video.videoHeight * scale);
                    context.drawImage(video, 0, 0, canvas.width, canvas.height);
                    const image = context.getImageData(0, 0, canvas.width, canvas.height);
                    text = jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" })?.data ?? null;
                }
                if (text && !stopped) {
                    onResult(text);
                    return;
                }
            } catch {
                // khung hình lỗi: thử khung sau
            }
        }
        timer = window.setTimeout(tick, 180);
    };
    void tick();
    return () => {
        stopped = true;
        window.clearTimeout(timer);
    };
}
