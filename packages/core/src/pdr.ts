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

/**
 * Đếm bước có ngưỡng tự thích nghi (dùng thay StepDetector).
 * - Bỏ trọng lực: trừ trung bình trượt chậm của độ lớn gia tốc -> dao động quanh 0.
 * - Làm mượt nhẹ để bớt rung tay.
 * - Ngưỡng = một phần biên độ dao động gần đây (bao trên/dưới giảm dần), nên đi nhẹ trong nhà
 *   hay đi mạnh ngoài đường đều đếm được; đứng yên rung tay nhẹ (< minSwing) thì không đếm.
 * Một bước = xuống dưới đáy rồi vượt lên đỉnh, cách bước trước ≥ minIntervalMs.
 */
export class AdaptiveStepDetector {
    private baseline: number | null = null;
    private signal = 0;
    private top = 0;
    private bottom = 0;
    private armed = false;
    private lastStep = -Infinity;
    private lastTime: number | null = null;

    constructor(
        private readonly options = { minSwing: 0.45, ratio: 0.4, smoothing: 0.35, baselineSeconds: 1.5, envelopeSeconds: 1.2, minIntervalMs: 300 }
    ) {}

    push(x: number, y: number, z: number, timeMs: number): boolean {
        const magnitude = Math.hypot(x, y, z);
        const dt = this.lastTime == null ? 1 / 60 : Math.min(0.2, Math.max(0.001, (timeMs - this.lastTime) / 1000));
        this.lastTime = timeMs;
        const o = this.options;
        if (this.baseline == null) this.baseline = magnitude;
        this.baseline += (magnitude - this.baseline) * Math.min(1, dt / o.baselineSeconds);
        this.signal += (magnitude - this.baseline - this.signal) * o.smoothing;
        // bao trên/dưới: bám theo đỉnh/đáy, tự co lại dần
        const decay = Math.exp(-dt / o.envelopeSeconds);
        this.top = Math.max(this.signal, this.top * decay);
        this.bottom = Math.min(this.signal, this.bottom * decay);
        const swing = this.top - this.bottom;
        if (swing < o.minSwing) return false;
        const high = this.top * o.ratio;
        const low = this.bottom * o.ratio;
        if (this.signal < low) this.armed = true;
        if (this.armed && this.signal > high && timeMs - this.lastStep > o.minIntervalMs) {
            this.armed = false;
            this.lastStep = timeMs;
            return true;
        }
        return false;
    }
}

/** Độ dài bước chân từ một lần đo: đi đúng "meters" mét, đếm được "steps" bước. Giới hạn 0,35–1,1 m. */
export function stepLengthFrom(meters: number, steps: number): number | null {
    if (!(meters > 0) || !(steps >= 4)) return null;
    return Math.round(Math.min(1.1, Math.max(0.35, meters / steps)) * 100) / 100;
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
export function positionUncertainty(metersSinceFix: number, source: "qr" | "pick" | "place" | "sim" | "gps" | string, gpsAccuracy?: number): number {
    const base = source === "qr" ? 1 : source === "pick" ? 5 : source === "gps" ? gpsAccuracy ?? 8 : 3;
    return base + metersSinceFix * 0.08;
}

export const LOST_THRESHOLD_METERS = 8;
