import type { JumpEvent } from "@indoor-map/core";

// Theo dõi lỗi bằng Sentry SDK. Dùng được với Sentry cloud hoặc GlitchTip: chỉ đổi DSN.
// - VITE_SENTRY_DSN trống: tắt hẳn, không tải thư viện.
// - Có DSN: SDK tải sau (import động) để trang bản đồ vẫn mở nhanh. Lỗi trong khoảnh khắc trước khi SDK tải xong
//   được giữ lại (tối đa 50) và gửi khi SDK sẵn sàng.
// - Không gửi thông tin cá nhân (sendDefaultPii: false). Sự cố định vị có toạ độ trong địa điểm, không gắn với ai.

type SentryModule = typeof import("./sentryClient");

const DSN = import.meta.env.VITE_SENTRY_DSN?.trim() ?? "";
const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");
/** Mỗi lần mở app gửi tối đa chừng này sự cố định vị, để không tiêu hết hạn mức miễn phí */
const MAX_POSITION_REPORTS = 20;

let sentry: SentryModule | null = null;
let pending: ((s: SentryModule) => void)[] = [];
let positionReports = 0;

export const monitoringEnabled = DSN !== "";

/** Gọi một lần, trước khi vẽ app */
export function initMonitoring(): void {
    if (!monitoringEnabled) return;
    import("./sentryClient")
        .then(S => {
            S.start(DSN, API_BASE);
            sentry = S;
            const queued = pending;
            pending = [];
            queued.forEach(fn => fn(S));
        })
        .catch(() => {
            pending = [];
        });
}

function withSentry(fn: (s: SentryModule) => void): void {
    if (sentry) fn(sentry);
    else if (monitoringEnabled && pending.length < 50) pending.push(fn);
}

/** Lỗi đã bắt được (try/catch, ErrorBoundary) */
export function reportError(error: unknown, context?: Record<string, unknown>): void {
    withSentry(S => S.captureException(error, context ? { contexts: { detail: context } } : undefined));
}

/** Dòng nhật ký ngắn đi kèm lỗi xảy ra sau đó (breadcrumb) */
export function addMonitoringBreadcrumb(category: string, message: string, data?: Record<string, unknown>): void {
    withSentry(S => S.addBreadcrumb({ category, message, data, level: "info" }));
}

export interface PositionReportContext {
    venue: string;
    mode: "basic" | "pf";
    /** Bán kính sai số bộ lọc tự báo (m), nếu có */
    spread?: number | null;
    steps?: number;
}

/**
 * Sự cố định vị (JumpEvent):
 * - chấm nhảy xa hơn quãng đi được -> issue "Vị trí nhảy bất thường", gom theo nguyên nhân
 * - QR sửa vị trí lệch hơn 10 m -> issue "QR sửa vị trí lệch nhiều" (vị trí trước đó đã sai bấy nhiêu)
 */
export function reportPositionJump(jump: JumpEvent, context: PositionReportContext): void {
    if (!monitoringEnabled) return;
    if (jump.correction && jump.meters < 10) return;
    if (positionReports >= MAX_POSITION_REPORTS) return;
    positionReports++;
    const meters = Math.round(jump.meters * 10) / 10;
    const seconds = Math.round(jump.dtMs / 100) / 10;
    withSentry(S => S.withScope(scope => {
        scope.setLevel(jump.correction ? "info" : "warning");
        scope.setFingerprint([jump.correction ? "position-correction" : "position-jump", jump.cause]);
        scope.setTags({
            "positioning.cause": jump.cause, "positioning.mode": context.mode, venue: context.venue, floor: String(jump.floorId)
        });
        scope.setContext("positioning", {
            meters, seconds, from: jump.from, to: jump.to, spread: context.spread ?? null, steps: context.steps ?? null
        });
        S.captureMessage(jump.correction
            ? `QR sửa vị trí lệch ${meters} m`
            : `Vị trí nhảy ${meters} m trong ${seconds} s (${jump.cause})`);
    }));
}
