// Phần dùng Sentry SDK, tải sau bằng import động từ monitoring.ts. Chỉ import những hàm cần dùng để bản build nhỏ.
import {
    addBreadcrumb, browserTracingIntegration, captureException, captureMessage, init, replayIntegration, withScope
} from "@sentry/react";

export { addBreadcrumb, captureException, captureMessage, withScope };

export function start(dsn: string, apiBase: string): void {
    init({
        dsn,
        environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
        release: import.meta.env.VITE_APP_VERSION || undefined,
        sendDefaultPii: false,
        integrations: [
            browserTracingIntegration(),
            // Ghi lại phiên dùng khi có lỗi (chữ và hình bị che). Nặng thêm nhiều nên chỉ bật khi VITE_SENTRY_REPLAY=1
            ...(import.meta.env.VITE_SENTRY_REPLAY === "1" ? [replayIntegration()] : [])
        ],
        // 20% lượt mở trang được đo thời gian (trang, API, backend); đổi bằng VITE_SENTRY_TRACES
        tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES ?? 0.2),
        // Gắn mã trace vào request tới backend để nối frontend -> backend -> database
        tracePropagationTargets: apiBase ? [/^\/(?!\/)/, apiBase] : [/^\/(?!\/)/],
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 1
    });
}
