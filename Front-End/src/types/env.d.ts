/// <reference types="vite/client" />

interface ImportMetaEnv {
    /** Địa chỉ backend, không có /api và không có / ở cuối */
    readonly VITE_API_BASE_URL?: string;
    /** "static" = chỉ đọc bản chụp /data/*.json, không gọi API */
    readonly VITE_DATA_MODE?: string;
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
