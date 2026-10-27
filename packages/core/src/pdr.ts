// Định vị bằng bước chân (Pedestrian Dead Reckoning) — phần thuật toán, không phụ thuộc nền tảng.
// Web đọc DeviceMotion/DeviceOrientation, React Native đọc expo-sensors, rồi đưa số liệu vào các lớp dưới đây.

/**
 * Phát hiện bước chân từ gia tốc (gồm trọng lực, ~9,8 m/s² khi đứng yên).
 * Độ lớn gia tốc được lọc thông thấp; một bước = vượt ngưỡng trên sau khi đã xuống dưới ngưỡng dưới,
 * cách bước trước ít nhất minIntervalMs (người đi bộ ≤ ~3,5 bước/giây).
 */
export class StepDetector {
    private filtered = 9.8;
    private armed = false;
    private lastStep = -Infinity;

    constructor(
        private readonly options = { low: 9.6, high: 10.9, smoothing: 0.2, minIntervalMs: 280 }
    ) {}

    /** Trả về true nếu mẫu này là một bước chân mới */
    push(x: number, y: number, z: number, timeMs: number): boolean {
        const magnitude = Math.hypot(x, y, z);
        this.filtered = this.filtered * (1 - this.options.smoothing) + magnitude * this.options.smoothing;
        if (this.filtered < this.options.low) this.armed = true;
        if (this.armed && this.filtered > this.options.high && timeMs - this.lastStep > this.options.minIntervalMs) {
            this.armed = false;
            this.lastStep = timeMs;
            return true;
        }
        return false;
    }
}

/** Làm mượt hướng la bàn trên vòng tròn (không nhảy 359° -> 1°) */
export class HeadingFilter {
    private value: number | null = null;

    constructor(private readonly smoothing = 0.25) {}

    push(heading: number): number {
        const h = ((heading % 360) + 360) % 360;
        if (this.value == null) this.value = h;
        else {
            const diff = ((h - this.value + 540) % 360) - 180;
            this.value = (this.value + diff * this.smoothing + 360) % 360;
        }
        return this.value;
    }

    get current(): number | null {
        return this.value;
    }
}

/**
 * Độ không chắc chắn (m) của vị trí ước lượng: ~1 m ngay sau khi quét QR, tăng ~8% quãng đi bằng bước chân
 * (sai số độ dài bước + lệch hướng). Vượt ngưỡng thì nên căn lại.
 */
export function positionUncertainty(metersSinceFix: number, source: "qr" | "pick" | "place" | "sim" | string): number {
    const base = source === "qr" ? 1 : source === "pick" ? 5 : 3;
    return base + metersSinceFix * 0.08;
}

export const LOST_THRESHOLD_METERS = 8;
