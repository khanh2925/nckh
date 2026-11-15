/// <reference types="vite/client" />

interface ImportMetaEnv {
    /** Địa chỉ backend, không có /api và không có / ở cuối */
    readonly VITE_API_BASE_URL?: string;
    /** "static" = chỉ đọc bản chụp /data/*.json, không gọi API */
    readonly VITE_DATA_MODE?: string;
    /** DSN của Sentry / GlitchTip; trống = tắt theo dõi lỗi */
    readonly VITE_SENTRY_DSN?: string;
    /** production / staging / local… (mặc định theo chế độ build) */
    readonly VITE_SENTRY_ENVIRONMENT?: string;
    /** Tỉ lệ lượt mở trang được đo thời gian, 0–1 (mặc định 0,2) */
    readonly VITE_SENTRY_TRACES?: string;
    /** "1" = ghi lại phiên dùng khi có lỗi (Session Replay) */
    readonly VITE_SENTRY_REPLAY?: string;
    /** Phiên bản build, để biết lỗi xuất hiện từ bản nào */
    readonly VITE_APP_VERSION?: string;
}

declare module "leaflet-rotate";

// iOS Safari
interface DeviceOrientationEvent {
    readonly webkitCompassHeading?: number;
    readonly webkitCompassAccuracy?: number;
}

// Chrome Android
interface BarcodeDetectorResult {
    rawValue: string;
}
declare class BarcodeDetector {
    constructor(options?: { formats: string[] });
    detect(source: CanvasImageSource): Promise<BarcodeDetectorResult[]>;
}
