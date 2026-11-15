import { distance, fromLocalMeters, toLocalMeters } from "./geo";
import { AdaptiveStepDetector } from "./pdr";
import type { FloorPoint, LatLng, WalkwayNetworkDto } from "./types";

// Định vị trong nhà không cần lắp thiết bị: bước chân (PDR) + bộ lọc hạt (particle filter) ràng buộc theo mạng lối đi.
//
// Ý tưởng: giữ cùng lúc vài trăm GIẢ THUYẾT (hạt). Mỗi hạt là một bộ
//   { x, y, tầng, lệch hướng của la bàn/con quay, hệ số K độ dài bước của người này }.
// - Mỗi bước chân, mọi hạt cùng bước theo số đo cảm biến nhưng mỗi hạt hiểu theo "giả thuyết" của nó (+ nhiễu).
// - Hạt đi ra xa lối đi đã vẽ (xuyên tường, ra ngoài nhà) bị giảm trọng số hoặc loại.
// - Mốc chắc chắn (QR, "Đã xong bước này", chọn trên bản đồ, GPS ngoài trời) giữ lại hạt gần mốc.
// - Hạt tốt được nhân bản (resample), hạt kém bị bỏ: sau khúc cua đầu tiên, chỉ còn các giả thuyết
//   có hướng và độ dài bước đúng -> sai số co lại và tự học bước chân của người dùng.
// Độ dài bước theo Weinberg: L = K × (a_max − a_min)^(1/4); bước dài thì người nhấp nhô mạnh hơn.
// Không phụ thuộc DOM: web đọc DeviceMotion/DeviceOrientation, app React Native đọc expo-sensors.

/** Một bước chân với số đo cần cho Weinberg */
export interface StepSample {
    t: number;
    /** Biên độ độ lớn gia tốc trong bước (m/s², đỉnh − đáy) */
    amplitude: number;
    durationMs: number;
}

/** Đếm bước (AdaptiveStepDetector) và ghi biên độ gia tốc của từng bước cho Weinberg */
export class WeinbergStepDetector {
    private max = -Infinity;
    private min = Infinity;
    private smooth: number | null = null;
    private lastStep: number | null = null;

    constructor(private readonly detector = new AdaptiveStepDetector()) {}

    push(x: number, y: number, z: number, timeMs: number): StepSample | null {
        const magnitude = Math.hypot(x, y, z);
        // làm mượt rất nhẹ để một gai nhiễu không làm biên độ vọt lên
        this.smooth = this.smooth == null ? magnitude : this.smooth + (magnitude - this.smooth) * 0.5;
        this.max = Math.max(this.max, this.smooth);
        this.min = Math.min(this.min, this.smooth);
        if (!this.detector.push(x, y, z, timeMs)) return null;
        const sample = {
            t: timeMs,
            amplitude: Number.isFinite(this.max - this.min) ? this.max - this.min : 0,
            durationMs: this.lastStep == null ? 0 : timeMs - this.lastStep
        };
        this.lastStep = timeMs;
        this.max = -Infinity;
        this.min = Infinity;
        return sample;
    }
}

/** Độ dài bước Weinberg (m) */
export function weinbergLength(k: number, amplitude: number): number {
    return k * Math.pow(Math.max(amplitude, 0.05), 0.25);
}

/**
 * Chỉ tính bước khi đã có một chuỗi bước đều nhịp (như máy đếm bước của Apple Watch / iPhone):
 * cầm máy lắc một cái hay đặt xuống bàn không thành bước. Đủ "need" bước đều nhịp thì trả cả chuỗi (tính bù),
 * sau đó cho qua từng bước; dừng lâu hơn maxGapMs thì phải đều nhịp lại từ đầu.
 */
export class StepGate {
    private pending: StepSample[] = [];
    private open = false;
    private last: number | null = null;

    /** Khoảng cách trung bình giữa hai bước đang đi (ms) */
    private cadence: number | null = null;
    /** Số "bước" đã bỏ vì tới quá sớm so với nhịp */
    rejected = 0;

    constructor(
        private readonly need = 4, private readonly tolerance = 0.35, private readonly maxGapMs = 2000, private readonly minFraction = 0.6
    ) {}

    push(step: StepSample): StepSample[] {
        if (this.last != null && step.t - this.last > this.maxGapMs) {
            this.open = false;
            this.pending = [];
            this.cadence = null;
        }
        if (this.open) {
            // Đang đi đều mà một "bước" tới sớm hơn hẳn nhịp (lắc máy, va chạm): không tính, giữ nhịp cũ
            if (this.last != null && this.cadence != null && step.t - this.last < this.minFraction * this.cadence) {
                this.rejected++;
                return [];
            }
            if (this.last != null) {
                const gap = step.t - this.last;
                this.cadence = this.cadence == null ? gap : this.cadence * 0.8 + gap * 0.2;
            }
            this.last = step.t;
            return [step];
        }
        this.last = step.t;
        this.pending.push(step);
        if (this.pending.length < this.need) return [];
        const recent = this.pending.slice(-this.need);
        const gaps = recent.slice(1).map((s, i) => s.t - recent[i]!.t);
        const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
        if (gaps.every(g => Math.abs(g - mean) <= this.tolerance * mean)) {
            this.open = true;
            this.cadence = mean;
            this.pending = [];
            return recent;
        }
        this.pending = this.pending.slice(-(this.need - 1));
        return [];
    }
}

/**
 * Phát hiện đổi cách cầm máy (cầm tay -> bỏ túi, xoay ngang, áp tai nghe gọi): phương trọng lực trong hệ của máy
 * đổi hơn angle độ và giữ như vậy quá holdMs. Khi đó độ dài bước (K) và độ lệch hướng cũ không còn đúng.
 */
export class PostureMonitor {
    private g: [number, number, number] | null = null;
    private ref: [number, number, number] | null = null;
    private since: number | null = null;

    constructor(private readonly angle = 35, private readonly holdMs = 800) {}

    /** Trả về true đúng lúc vừa đổi cách cầm máy */
    push(x: number, y: number, z: number, timeMs: number): boolean {
        const g = this.g;
        this.g = g ? [g[0] + (x - g[0]) * 0.1, g[1] + (y - g[1]) * 0.1, g[2] + (z - g[2]) * 0.1] : [x, y, z];
        if (!this.ref) {
            this.ref = [...this.g];
            return false;
        }
        const [a, b] = [this.g, this.ref];
        const cos = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (Math.hypot(...a) * Math.hypot(...b) || 1);
        const degrees = (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
        if (degrees > this.angle) {
            this.since ??= timeMs;
            if (timeMs - this.since >= this.holdMs) {
                this.ref = [...this.g];
                this.since = null;
                return true;
            }
        } else {
            this.since = null;
            // tư thế ổn định: mốc trôi theo rất chậm (tay mỏi hạ dần máy xuống)
            for (let i = 0; i < 3; i++) b[i]! += (a[i]! - b[i]!) * 0.002;
        }
        return false;
    }
}

export interface GpsSample extends LatLng {
    /** Sai số (m) */
    accuracy: number;
    /** Thời điểm (ms, cùng đồng hồ với bước chân đưa vào StrideCalibrator) */
    t: number;
}

export interface StrideCalibration {
    /** Độ dài bước trung bình đo được (m) */
    stepLength: number;
    /** Hệ số Weinberg (null nếu không có biên độ gia tốc) */
    k: number | null;
    meters: number;
    steps: number;
}

/**
 * Kết hợp GPS vào bộ lọc hạt (ngoài trời). Sai số GPS điện thoại kéo dài nhiều giây (phản xạ, bị che), các lần đo liền nhau
 * sai giống nhau: dùng mỗi lần đo như một bằng chứng độc lập sẽ tin GPS quá mức và kéo vị trí lệch theo.
 * Nên chỉ đưa vào bộ lọc mỗi GPS_FUSION_INTERVAL_MS một lần, với bán kính sai số nhân GPS_FUSION_SIGMA_SCALE.
 * Mô phỏng khuôn viên (GPS lệch ~5–10 m, 2% lần nhảy xa): trung vị 2,0–2,6 m -> 0,8–0,9 m, p90 6,7–15 m -> 2,4–3,2 m.
 */
export const GPS_FUSION_INTERVAL_MS = 5000;
export const GPS_FUSION_SIGMA_SCALE = 2;

/** Bán kính sai số dùng khi đưa một lần đo GPS vào bộ lọc */
export function gpsFusionSigma(accuracy: number): number {
    return Math.max(3, accuracy) * GPS_FUSION_SIGMA_SCALE;
}

/** Tốc độ đi bộ nhanh nhất còn hợp lý (m/s), dùng để nhận ra vị trí nhảy bất thường */
export const WALK_MAX_SPEED = 2.5;

/**
 * Loại số đo vị trí nhảy bất thường (GPS bật lại giữa các toà nhà, phản xạ tín hiệu…), như bước "innovation gating"
 * của bộ lọc Kalman: một lần đo cách lần tin trước xa hơn quãng có thể đi được (tốc độ × thời gian + sai số) thì bỏ.
 * Nếu nhiều lần đo liền nhau cùng chỉ về chỗ mới (khách thật sự ở đó) thì chấp nhận.
 */
export class PlausibilityGate {
    private last: { point: FloorPoint; t: number; accuracy: number } | null = null;
    private pending: { point: FloorPoint; t: number; accuracy: number }[] = [];

    constructor(private readonly maxSpeed = WALK_MAX_SPEED, private readonly margin = 5, private readonly confirm = 3) {}

    /** true = dùng được; false = bất thường, bỏ qua. meters = khoảng cách tới lần tin trước */
    check(point: FloorPoint, t: number, accuracy: number): { ok: boolean; meters: number } {
        const fix = { point, t, accuracy };
        const last = this.last;
        if (!last || last.point.floorId !== point.floorId) {
            this.accept(fix);
            return { ok: true, meters: 0 };
        }
        const meters = distance(last.point, point);
        if (meters <= this.limit(last, fix)) {
            this.accept(fix);
            return { ok: true, meters };
        }
        // Các lần đo bất thường liền nhau có khớp với nhau không
        const prev = this.pending[this.pending.length - 1];
        if (prev && distance(prev.point, point) > this.limit(prev, fix)) this.pending = [];
        this.pending.push(fix);
        if (this.pending.length >= this.confirm) {
            this.accept(fix);
            return { ok: true, meters };
        }
        return { ok: false, meters };
    }

    /** Biết chắc vị trí (QR, chọn trên bản đồ): lấy làm mốc so sánh mới */
    anchor(point: FloorPoint, t: number, accuracy = 2): void {
        this.accept({ point, t, accuracy });
    }

    private limit(a: { t: number; accuracy: number }, b: { t: number; accuracy: number }): number {
        return this.maxSpeed * Math.max(0, b.t - a.t) / 1000 + a.accuracy + b.accuracy + this.margin;
    }

    private accept(fix: { point: FloorPoint; t: number; accuracy: number }): void {
        this.last = fix;
        this.pending = [];
    }
}

export interface JumpEvent {
    floorId: number;
    from: LatLng;
    to: LatLng;
    meters: number;
    dtMs: number;
    /** Điều gì làm vị trí đổi: step, gps, qr, pick, place, reroute, floor, sim… */
    cause: string;
    /** QR / chọn trên bản đồ / đang ở địa điểm: là lần sửa sai có chủ đích, khoảng nhảy = sai số trước đó */
    correction: boolean;
}

const CORRECTIONS = new Set(["qr", "pick", "place"]);

/**
 * Theo dõi vị trí hiển thị trên bản đồ: nhảy xa hơn quãng đi được trong khoảng thời gian đó thì ghi lại một sự cố.
 * Lần nhảy do QR / chọn trên bản đồ là lần sửa sai, khoảng nhảy chính là sai số của vị trí trước đó.
 */
export class JumpMonitor {
    private last: { point: FloorPoint; t: number } | null = null;

    constructor(private readonly maxSpeed = WALK_MAX_SPEED, private readonly margin = 3) {}

    update(point: FloorPoint, t: number, cause: string): JumpEvent | null {
        const last = this.last;
        this.last = { point, t };
        if (!last || last.point.floorId !== point.floorId) return null;
        const meters = distance(last.point, point);
        const dtMs = Math.max(0, t - last.t);
        const correction = CORRECTIONS.has(cause);
        // Lần sửa bằng QR luôn ghi lại (kể cả khi nhỏ): khoảng sửa là thước đo sai số thật của vị trí trước đó
        if (!correction && meters <= this.maxSpeed * dtMs / 1000 + this.margin) return null;
        return {
            floorId: point.floorId, from: { lat: last.point.lat, lng: last.point.lng }, to: { lat: point.lat, lng: point.lng },
            meters, dtMs, cause, correction
        };
    }
}

/**
 * Học từ lần sai giữa hai mã QR: khách đi theo tuyến từ QR này tới QR kia, quãng dọc tuyến giữa hai mã là quãng thật,
 * chia cho số bước (và tổng độ nhấp nhô^¼) ra độ dài bước / hệ số K thật. Như đo bằng GPS ngoài trời, nhưng dùng được trong nhà.
 */
export class AnchorCalibrator {
    private steps = 0;
    private roots = 0;
    private allAmplitudes = true;

    constructor(private readonly options = { minMeters: 20, minSteps: 25 }) {}

    addStep(amplitude: number | null): void {
        this.steps++;
        if (amplitude == null) this.allAmplitudes = false;
        else this.roots += Math.pow(Math.max(amplitude, 0.05), 0.25);
    }

    restart(): void {
        this.steps = 0;
        this.roots = 0;
        this.allAmplitudes = true;
    }

    /** walkedMeters = quãng dọc tuyến giữa hai mốc; null = không đủ điều kiện hoặc kết quả vô lý */
    finish(walkedMeters: number): StrideCalibration | null {
        const { steps, roots, allAmplitudes } = this;
        this.restart();
        if (!(walkedMeters >= this.options.minMeters) || steps < this.options.minSteps) return null;
        const stepLength = walkedMeters / steps;
        if (stepLength < 0.35 || stepLength > 1.1) return null;
        const k = allAmplitudes && roots > 0 ? walkedMeters / roots : null;
        return { stepLength, k: k != null && k >= 0.25 && k <= 0.8 ? k : null, meters: walkedMeters, steps };
    }
}

/**
 * Tự đo độ dài bước bằng GPS khi đi ngoài trời (khuôn viên), theo cách Apple Watch hiệu chỉnh:
 * chỉ dùng đoạn "đẹp" — GPS tốt, nhịp bước đều, đường gần thẳng, đủ dài. Độ dài bước = quãng GPS / số bước.
 */
export class StrideCalibrator {
    private steps: { t: number; root: number | null }[] = [];
    private fixes: GpsSample[] = [];

    constructor(private readonly options = { maxAccuracy: 10, minMeters: 60, minSteps: 60, maxCadenceCv: 0.15, minStraightness: 0.92, maxGapMs: 3000 }) {}

    reset(): void {
        this.steps = [];
        this.fixes = [];
    }

    /** Một bước chân lúc t; amplitude = biên độ gia tốc (null nếu không có) */
    addStep(t: number, amplitude: number | null): void {
        const last = this.steps[this.steps.length - 1];
        if (last && t - last.t > this.options.maxGapMs) this.reset();
        this.steps.push({ t, root: amplitude == null ? null : Math.pow(Math.max(amplitude, 0.05), 0.25) });
    }

    /** Một lần đo GPS; trả về kết quả khi vừa đi xong một đoạn đạt chuẩn */
    addFix(fix: GpsSample): StrideCalibration | null {
        const o = this.options;
        if (fix.accuracy > o.maxAccuracy) {
            this.reset();
            return null;
        }
        // Chỉ giữ các lần đo cách nhau ≥ 8 m để tính độ thẳng: GPS rung vài mét giữa hai lần đo liền nhau
        // sẽ làm quãng gấp khúc dài ra giả tạo
        const lastKept = this.fixes[this.fixes.length - 1];
        if (!lastKept || distance(lastKept, fix) >= 8) this.fixes.push(fix);
        const first = this.fixes[0]!;
        const meters = distance(first, fix);
        const inside = this.steps.filter(s => s.t > first.t && s.t <= fix.t);
        if (meters < o.minMeters || inside.length < o.minSteps) return null;
        const kept = this.fixes[this.fixes.length - 1] === fix ? this.fixes : [...this.fixes, fix];
        let path = 0;
        for (let i = 1; i < kept.length; i++) path += distance(kept[i - 1]!, kept[i]!);
        const gaps = inside.slice(1).map((s, i) => s.t - inside[i]!.t);
        const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
        const cv = Math.sqrt(gaps.reduce((a, g) => a + (g - mean) ** 2, 0) / gaps.length) / mean;
        if (meters / path >= o.minStraightness && cv <= o.maxCadenceCv) {
            const stepLength = meters / inside.length;
            const roots = inside.map(s => s.root);
            const k = roots.every(r => r != null) ? meters / roots.reduce((a, r) => a + r!, 0) : null;
            // bắt đầu đoạn mới từ chỗ này
            this.fixes = [fix];
            this.steps = this.steps.filter(s => s.t > fix.t);
            if (stepLength < 0.3 || stepLength > 1.2) return null;
            return { stepLength, k, meters, steps: inside.length };
        }
        // đoạn chưa đạt (cong, nhịp không đều): trượt cửa sổ, bỏ lần đo cũ nhất
        this.fixes.shift();
        return null;
    }
}

/** Gộp kết quả hiệu chỉnh mới vào cái đã học, có trọng số theo quãng đường (giữ tối đa maxMeters để vẫn theo kịp thay đổi) */
export function mergeStride(
    old: { stepLength: number; k: number | null; meters: number } | null, next: StrideCalibration, maxMeters = 2000
): { stepLength: number; k: number | null; meters: number } {
    if (!old) return { stepLength: next.stepLength, k: next.k, meters: next.meters };
    const w = Math.min(old.meters, maxMeters);
    const total = w + next.meters;
    const mix = (a: number, b: number) => (a * w + b * next.meters) / total;
    return {
        stepLength: mix(old.stepLength, next.stepLength),
        k: old.k != null && next.k != null ? mix(old.k, next.k) : next.k ?? old.k,
        meters: Math.min(total, maxMeters)
    };
}

/**
 * Hướng điện thoại (độ, theo chiều kim đồng hồ) từ alpha/beta/gamma của DeviceOrientation.
 * Lấy hướng của (cạnh trên − mặt màn hình) chiếu xuống mặt sàn: đúng cả khi cầm nằm ngang lẫn dựng đứng,
 * không bị suy biến như chỉ dùng alpha. Với sự kiện "tương đối" (con quay), gốc 0 tuỳ ý — bộ lọc tự học độ lệch.
 */
export function headingFromOrientation(alpha: number, beta: number, gamma: number): number {
    const r = Math.PI / 180;
    const [sa, ca, sb, cb, sg, cg] = [Math.sin(alpha * r), Math.cos(alpha * r), Math.sin(beta * r), Math.cos(beta * r), Math.sin(gamma * r), Math.cos(gamma * r)];
    // trục y (cạnh trên) và trục z (mặt màn hình) của máy trong hệ thế giới (x = đông, y = bắc, z = lên)
    const east = -sa * cb - (ca * sg + sa * sb * cg);
    const north = ca * cb - (sa * sg - ca * sb * cg);
    return ((Math.atan2(east, north) / r) % 360 + 360) % 360;
}

// ---------- Mạng lối đi theo mét ----------

const CELL = 10; // m, ô lưới tra cứu đoạn lối đi gần nhất

interface FloorSegments {
    /** ax, ay, bx, by liên tiếp (m) */
    coords: Float64Array;
    /** ô lưới -> chỉ số các đoạn đi qua ô đó (đã nới thêm bán kính tìm kiếm) */
    grid: Map<string, number[]>;
}

export interface WalkwayIndex {
    origin: LatLng;
    floors: Map<number, FloorSegments>;
    /** Khoảng cách xa nhất cần tra (m) */
    reach: number;
}

/** Đổi các đoạn lối đi cùng tầng sang mét quanh một gốc chung, chia lưới để tra nhanh */
export function buildWalkwayIndex(walkways: WalkwayNetworkDto, reach = 8, origin?: LatLng): WalkwayIndex {
    const first = walkways.nodes[0];
    const base = origin ?? (first ? { lat: first.lat, lng: first.lng } : { lat: 0, lng: 0 });
    const byId = new Map(walkways.nodes.map(n => [n.id, n]));
    const lists = new Map<number, number[]>();
    for (const { from, to } of walkways.edges) {
        const a = byId.get(from);
        const b = byId.get(to);
        if (!a || !b || a.floorId !== b.floorId) continue;
        const pa = toLocalMeters(base, a);
        const pb = toLocalMeters(base, b);
        const list = lists.get(a.floorId) ?? [];
        list.push(pa.x, pa.y, pb.x, pb.y);
        lists.set(a.floorId, list);
    }
    const floors = new Map<number, FloorSegments>();
    for (const [floorId, list] of lists) {
        const coords = Float64Array.from(list);
        const grid = new Map<string, number[]>();
        for (let s = 0; s < coords.length / 4; s++) {
            const [ax, ay, bx, by] = [coords[s * 4]!, coords[s * 4 + 1]!, coords[s * 4 + 2]!, coords[s * 4 + 3]!];
            const x0 = Math.floor((Math.min(ax, bx) - reach) / CELL);
            const x1 = Math.floor((Math.max(ax, bx) + reach) / CELL);
            const y0 = Math.floor((Math.min(ay, by) - reach) / CELL);
            const y1 = Math.floor((Math.max(ay, by) + reach) / CELL);
            for (let gx = x0; gx <= x1; gx++) {
                for (let gy = y0; gy <= y1; gy++) {
                    const key = `${gx},${gy}`;
                    const cell = grid.get(key);
                    if (cell) cell.push(s);
                    else grid.set(key, [s]);
                }
            }
        }
        floors.set(floorId, { coords, grid });
    }
    return { origin: base, floors, reach };
}

/** Khoảng cách (m) từ điểm (x, y) tới đoạn lối đi gần nhất của tầng; Infinity nếu xa hơn reach; null nếu tầng không có lối đi */
export function distanceToWalkway(index: WalkwayIndex, floorId: number, x: number, y: number): number | null {
    const floor = index.floors.get(floorId);
    if (!floor) return null;
    const cell = floor.grid.get(`${Math.floor(x / CELL)},${Math.floor(y / CELL)}`);
    if (!cell) return Infinity;
    const c = floor.coords;
    let best = Infinity;
    for (const s of cell) {
        const ax = c[s * 4]!;
        const ay = c[s * 4 + 1]!;
        const dx = c[s * 4 + 2]! - ax;
        const dy = c[s * 4 + 3]! - ay;
        const len = dx * dx + dy * dy;
        const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len));
        const ex = ax + t * dx - x;
        const ey = ay + t * dy - y;
        const d = ex * ex + ey * ey;
        if (d < best) best = d;
    }
    return Math.sqrt(best);
}

/** Khoảng cách (m) từ (x, y) tới đoạn gần nhất trong danh sách ax, ay, bx, by */
function distanceToSegments(c: Float64Array, x: number, y: number): number {
    let best = Infinity;
    for (let s = 0; s < c.length; s += 4) {
        const ax = c[s]!;
        const ay = c[s + 1]!;
        const dx = c[s + 2]! - ax;
        const dy = c[s + 3]! - ay;
        const len = dx * dx + dy * dy;
        const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len));
        const ex = ax + t * dx - x;
        const ey = ay + t * dy - y;
        best = Math.min(best, ex * ex + ey * ey);
    }
    return Math.sqrt(best);
}

// ---------- Bộ lọc hạt ----------

export interface ParticleFilterOptions {
    /** Số giả thuyết */
    count: number;
    /** Hạt giống của bộ sinh số ngẫu nhiên: cùng seed + cùng dữ liệu = cùng kết quả (để chạy lại log) */
    seed: number;
    /** Người đi thường cách nét lối đi đã vẽ bao xa (m) */
    corridorSigma: number;
    /** Xa nét lối đi hơn thế coi như không thể (xuyên tường, ra ngoài) (m) */
    maxOffPath: number;
    /** Nhiễu độ dài từng bước (tỉ lệ) */
    stepNoise: number;
    /** Nhiễu hướng mỗi bước (độ) */
    headingNoise: number;
    /** Độ lệch hướng trôi chậm theo thời gian (độ mỗi bước) */
    offsetDrift: number;
    /** K trôi chậm (tỉ lệ mỗi bước) */
    kDrift: number;
    /** Độ dài bước giả định khi chưa biết gì (m): trung bình ± nửa khoảng */
    stepLength: { mean: number; spread: number };
    /** K đã học ở lần trước (nếu có) */
    learnedK: number | null;
    /** Tỉ lệ hạt rải mới quanh ước lượng mỗi lần resample, phòng khi hội tụ nhầm chỗ */
    inject: number;
    /** Đang chỉ đường: khách thường đi theo tuyến. Lệch tuyến xa hơn routeSigma (m) thì giả thuyết kém đi, */
    routeSigma: number;
    /** ... nhưng không dưới routeFloor lần, để vẫn phát hiện được khi khách rẽ nhầm */
    routeFloor: number;
    /** Đang chỉ đường: mỗi lần nhân bản, rải lại tỉ lệ này lên tuyến quanh ước lượng (trong routeWindow m) để thoát khi bám nhầm hành lang song song */
    routeInject: number;
    routeWindow: number;
    /** Đi lệch hướng tuyến hơn offRouteAngle độ liên tục offRouteSteps bước (không phải ở khúc cua) = rẽ nhầm: thôi bám tuyến */
    offRouteSteps: number;
    offRouteAngle: number;
    /** Mỗi lần nhân bản, rung nhẹ K (tỉ lệ) và độ lệch hướng (độ) để không mất đa dạng giả thuyết */
    roughen: { k: number; offset: number };
}

export const DEFAULT_PF_OPTIONS: ParticleFilterOptions = {
    count: 1000, seed: 1, corridorSigma: 2, maxOffPath: 7, stepNoise: 0.08, headingNoise: 6, offsetDrift: 0.1, kDrift: 0.01,
    stepLength: { mean: 0.7, spread: 0.2 }, learnedK: null, inject: 0.06, routeSigma: 6, routeFloor: 0.15, routeInject: 0.03, routeWindow: 25, offRouteSteps: 6, offRouteAngle: 50,
    roughen: { k: 0.01, offset: 1 }
};

export interface HeadingPrior {
    /** Hướng tuyệt đối khách đang quay mặt (độ từ Bắc), ví dụ từ la bàn hoặc hướng của tuyến */
    absolute: number;
    /** Độ tin (độ) */
    spread: number;
}

export interface PositionEstimate extends FloorPoint {
    /** Bán kính sai số ước tính (m) */
    spread: number;
    /** Hệ số Weinberg đã học và độ phân tán tương đối */
    k: number;
    kSpread: number;
    /** Độ lệch giữa hướng đo được và hướng thật (độ) */
    headingOffset: number;
    offsetSpread: number;
    /** Số hạt hiệu dụng */
    ess: number;
    steps: number;
    /** Số lần mất dấu phải rải lại */
    recoveries: number;
    /** Khách đã đi khỏi tuyến (rẽ nhầm): bộ lọc thôi bám tuyến, chờ lập tuyến mới */
    offRoute: boolean;
}

const TWO_PI = Math.PI * 2;
/** Trọng số còn lại của hạt nằm xa mọi lối đi */
const OFF_PATH_FLOOR = 0.005;
const DEG = Math.PI / 180;

/** Bộ sinh số ngẫu nhiên có seed (mulberry32) */
function mulberry32(seed: number) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export class ParticleFilter {
    readonly options: ParticleFilterOptions;
    private readonly random: () => number;
    private spare: number | null = null;
    private x: Float64Array;
    private y: Float64Array;
    private floor: Int32Array;
    private offset: Float64Array; // độ
    private k: Float64Array; // NaN = chưa biết, khởi tạo ở bước đầu
    private w: Float64Array;
    private offsetPrior: HeadingPrior | null = null;
    private offsetsReady = false;
    private steps = 0;
    private recoveries = 0;
    private started = false;
    /** Tuyến đang đi theo từng tầng (m); đoạn từ cửa hàng ra lối đi cũng đi được */
    private route: Map<number, Float64Array> | null = null;
    private disagree = 0;
    private offRoute = false;

    constructor(private readonly index: WalkwayIndex, options: Partial<ParticleFilterOptions> = {}) {
        this.options = { ...DEFAULT_PF_OPTIONS, ...options };
        const n = this.options.count;
        this.random = mulberry32(this.options.seed);
        this.x = new Float64Array(n);
        this.y = new Float64Array(n);
        this.floor = new Int32Array(n);
        this.offset = new Float64Array(n);
        this.k = new Float64Array(n).fill(Number.NaN);
        this.w = new Float64Array(n).fill(1 / n);
    }

    get isStarted(): boolean {
        return this.started;
    }

    private gauss(): number {
        if (this.spare != null) {
            const s = this.spare;
            this.spare = null;
            return s;
        }
        const u = Math.max(this.random(), 1e-12);
        const v = this.random();
        const r = Math.sqrt(-2 * Math.log(u));
        this.spare = r * Math.sin(TWO_PI * v);
        return r * Math.cos(TWO_PI * v);
    }

    /**
     * Đặt lại vị trí quanh một mốc (bắt đầu đi, quét QR, "Đã xong bước này", đổi tầng…).
     * Những gì đã học (K, độ lệch hướng) được giữ lại; chỉ lần đầu mới dùng headingPrior.
     */
    reset(at: FloorPoint, sigma: number, headingPrior: HeadingPrior | null = null): void {
        if (this.started) this.resample(0);
        const p = toLocalMeters(this.index.origin, at);
        for (let i = 0; i < this.options.count; i++) {
            this.x[i] = p.x + this.gauss() * sigma;
            this.y[i] = p.y + this.gauss() * sigma;
            this.floor[i] = at.floorId;
            this.w[i] = 1 / this.options.count;
        }
        if (!this.offsetsReady && headingPrior) this.offsetPrior = headingPrior;
        this.started = true;
    }

    /** Tuyến đang chỉ đường (mỗi chặng một tầng); null = đi tự do, không ưu tiên tuyến nào */
    setRoute(legs: { floorId: number; points: LatLng[] }[] | null): void {
        this.disagree = 0;
        this.offRoute = false;
        if (!legs) {
            this.route = null;
            return;
        }
        const lists = new Map<number, number[]>();
        for (const leg of legs) {
            const list = lists.get(leg.floorId) ?? [];
            for (let i = 1; i < leg.points.length; i++) {
                const a = toLocalMeters(this.index.origin, leg.points[i - 1]!);
                const b = toLocalMeters(this.index.origin, leg.points[i]!);
                list.push(a.x, a.y, b.x, b.y);
            }
            lists.set(leg.floorId, list);
        }
        this.route = new Map([...lists].map(([f, l]) => [f, Float64Array.from(l)]));
    }

    /**
     * Khách vừa đổi cách cầm máy: độ dài bước và độ lệch hướng đã học không còn chắc.
     * Nới rộng các giả thuyết đó (vị trí giữ nguyên) để bộ lọc học lại sau vài bước.
     */
    /** Đặt lại hệ số bước của mọi giả thuyết quanh k (vừa đo được giữa hai mốc), giữ vị trí và hướng */
    retuneK(k: number, spread = 0.04): void {
        if (!(k > 0)) return;
        for (let i = 0; i < this.options.count; i++) this.k[i] = k * (1 + this.gauss() * spread);
    }

    loosen(offsetSpread = 30, kSpread = 0.1): void {
        for (let i = 0; i < this.options.count; i++) {
            this.offset[i]! += this.gauss() * offsetSpread;
            if (!Number.isNaN(this.k[i]!)) this.k[i]! *= 1 + this.gauss() * kSpread;
        }
        this.disagree = 0;
    }

    /** Thêm nhiễu vị trí (ví dụ sau khi màn hình tắt một lúc, không biết đã đi bao xa) */
    diffuse(sigma: number): void {
        for (let i = 0; i < this.options.count; i++) {
            this.x[i]! += this.gauss() * sigma;
            this.y[i]! += this.gauss() * sigma;
        }
    }

    /**
     * Một bước chân. heading = hướng đo được (độ, theo chiều kim đồng hồ, gốc tuỳ ý nếu là con quay tương đối).
     * Trả về false nếu bộ lọc chưa có vị trí ban đầu.
     */
    step(sample: Pick<StepSample, "amplitude">, heading: number, headingNoise?: number): boolean {
        if (!this.started) return false;
        const o = this.options;
        const noise = headingNoise ?? o.headingNoise;
        const n = o.count;
        const root = Math.pow(Math.max(sample.amplitude, 0.05), 0.25);
        if (!this.offsetsReady) this.initOffsets(heading);
        let total = 0;
        for (let i = 0; i < n; i++) {
            if (Number.isNaN(this.k[i]!)) this.k[i] = this.initialK(root);
            const length = Math.min(1.3, Math.max(0.2, this.k[i]! * root * (1 + this.gauss() * o.stepNoise)));
            const theta = (heading + this.offset[i]! + this.gauss() * noise) * DEG;
            this.x[i]! += length * Math.sin(theta);
            this.y[i]! += length * Math.cos(theta);
            this.offset[i]! += this.gauss() * o.offsetDrift;
            this.k[i]! *= 1 + this.gauss() * o.kDrift;
            this.w[i]! *= this.mapLikelihood(this.floor[i]!, this.x[i]!, this.y[i]!);
            total += this.w[i]!;
        }
        this.steps++;
        if (!(total > 0)) {
            this.recover();
            return true;
        }
        this.normalize(total);
        if (this.ess() < n / 2) this.resample(o.inject);
        if (this.route) this.checkRoute(heading);
        return true;
    }

    /**
     * Một mốc đo được: vị trí chắc chắn trong bán kính sigma (QR ~1,5 m, GPS = sai số của nó…).
     * Nếu gần như không hạt nào khớp (đã trôi xa) thì đặt lại quanh mốc, giữ những gì đã học.
     */
    observe(point: FloorPoint, sigma: number): void {
        if (!this.started) {
            this.reset(point, sigma);
            return;
        }
        // Mốc ở xa hẳn chỗ bộ lọc đang tin (đã trôi, hoặc khách vừa quét QR ở chỗ khác): tin mốc, rải lại quanh mốc.
        // reset() nhân bản theo trọng số hiện tại trước, nên K và độ lệch hướng đã học được giữ nguyên.
        const before = this.estimate();
        if (before && (before.floorId !== point.floorId || distance(before, point) > 3 * Math.max(sigma, before.spread, 2))) {
            this.reset(point, sigma);
            return;
        }
        const p = toLocalMeters(this.index.origin, point);
        const n = this.options.count;
        let total = 0;
        let best = 0;
        for (let i = 0; i < n; i++) {
            const dx = this.x[i]! - p.x;
            const dy = this.y[i]! - p.y;
            const like = this.floor[i] === point.floorId ? Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma)) : 0;
            best = Math.max(best, like);
            this.w[i]! *= like;
            total += this.w[i]!;
        }
        // Hạt gần nhất cũng cách mốc hơn ~3 sigma: mốc thắng, rải lại
        if (!(total > 0) || best < 0.011) {
            this.reset(point, sigma);
            return;
        }
        this.normalize(total);
        if (this.ess() < n / 2) this.resample(this.options.inject);
    }

    estimate(): PositionEstimate | null {
        if (!this.started) return null;
        const n = this.options.count;
        // tầng có tổng trọng số lớn nhất
        const byFloor = new Map<number, number>();
        for (let i = 0; i < n; i++) byFloor.set(this.floor[i]!, (byFloor.get(this.floor[i]!) ?? 0) + this.w[i]!);
        let floorId = this.floor[0]!;
        for (const [f, sum] of byFloor) if (sum > (byFloor.get(floorId) ?? 0)) floorId = f;
        let sw = 0, mx = 0, my = 0, mk = 0, sin = 0, cos = 0;
        for (let i = 0; i < n; i++) {
            if (this.floor[i] !== floorId) continue;
            const wi = this.w[i]!;
            sw += wi;
            mx += wi * this.x[i]!;
            my += wi * this.y[i]!;
            if (!Number.isNaN(this.k[i]!)) mk += wi * this.k[i]!;
            sin += wi * Math.sin(this.offset[i]! * DEG);
            cos += wi * Math.cos(this.offset[i]! * DEG);
        }
        if (!(sw > 0)) return null;
        mx /= sw;
        my /= sw;
        mk /= sw;
        let vx = 0, vy = 0, vk = 0;
        for (let i = 0; i < n; i++) {
            if (this.floor[i] !== floorId) continue;
            const wi = this.w[i]! / sw;
            vx += wi * (this.x[i]! - mx) ** 2;
            vy += wi * (this.y[i]! - my) ** 2;
            if (!Number.isNaN(this.k[i]!)) vk += wi * (this.k[i]! - mk) ** 2;
        }
        const resultant = Math.min(1, Math.hypot(sin, cos) / sw);
        const at = fromLocalMeters(this.index.origin, mx, my);
        return {
            floorId, lat: at.lat, lng: at.lng,
            spread: Math.sqrt(vx + vy),
            k: mk, kSpread: mk > 0 ? Math.sqrt(vk) / mk : 1,
            headingOffset: ((Math.atan2(sin, cos) / DEG) % 360 + 360) % 360,
            offsetSpread: resultant > 0 ? Math.sqrt(-2 * Math.log(resultant)) / DEG : 180,
            ess: this.ess(), steps: this.steps, recoveries: this.recoveries, offRoute: this.offRoute
        };
    }

    /** Vị trí các hạt trên một tầng (để vẽ khi gỡ lỗi), tối đa max hạt */
    sample(floorId: number, max = 200): LatLng[] {
        const out: LatLng[] = [];
        const stride = Math.max(1, Math.floor(this.options.count / max));
        for (let i = 0; i < this.options.count && out.length < max; i += stride) {
            if (this.floor[i] === floorId) out.push(fromLocalMeters(this.index.origin, this.x[i]!, this.y[i]!));
        }
        return out;
    }

    // ---------- nội bộ ----------

    /**
     * Hướng đang đi (hướng đo + độ lệch đã học) có khớp hướng của đoạn tuyến gần nhất không.
     * Lệch nhiều bước liền, không phải ở khúc cua = khách rẽ nhầm: bỏ ưu tiên tuyến để vị trí đi theo khách thật.
     */
    private checkRoute(heading: number): void {
        const est = this.estimate();
        const segs = est ? this.route?.get(est.floorId) : undefined;
        if (!est || !segs || est.spread > 15 || est.offsetSpread > 25) return;
        const p = toLocalMeters(this.index.origin, est);
        let best = -1;
        let bestD = Infinity;
        for (let s = 0; s < segs.length; s += 4) {
            const d = distanceToSegments(segs.subarray(s, s + 4), p.x, p.y);
            if (d < bestD) {
                bestD = d;
                best = s;
            }
        }
        if (best < 0) return;
        const [ax, ay, bx, by] = [segs[best]!, segs[best + 1]!, segs[best + 2]!, segs[best + 3]!];
        // gần đầu/cuối đoạn = đang ở khúc cua, hướng chưa rõ
        if (Math.hypot(p.x - ax, p.y - ay) < 5 || Math.hypot(p.x - bx, p.y - by) < 5) return;
        const routeDir = Math.atan2(bx - ax, by - ay) / DEG;
        const walking = heading + est.headingOffset;
        const diff = Math.abs(((walking - routeDir) % 360 + 540) % 360 - 180);
        this.disagree = diff > this.options.offRouteAngle ? this.disagree + 1 : 0;
        if (this.disagree >= this.options.offRouteSteps) {
            this.offRoute = true;
            this.route = null;
        }
    }

    /** Hạt ở (x, y) hợp với bản đồ tới mức nào: gần lối đi (hoặc tuyến) thì 1, xa thì gần 0 */
    private mapLikelihood(floorId: number, x: number, y: number): number {
        const o = this.options;
        const net = distanceToWalkway(this.index, floorId, x, y);
        const routeSegs = this.route?.get(floorId);
        const onRoute = routeSegs ? distanceToSegments(routeSegs, x, y) : null;
        if (net == null && onRoute == null) return 1; // tầng chưa vẽ lối đi: không ràng buộc
        const d = Math.min(net ?? Infinity, onRoute ?? Infinity);
        // Xa lối đi thì gần như loại, nhưng không về 0: khách có thể ở chỗ chưa vẽ lối đi (trong quầy, sảnh rộng)
        let like = d > o.maxOffPath ? OFF_PATH_FLOOR : Math.max(OFF_PATH_FLOOR, Math.exp(-(d * d) / (2 * o.corridorSigma * o.corridorSigma)));
        if (onRoute != null) like *= o.routeFloor + (1 - o.routeFloor) * Math.exp(-(onRoute * onRoute) / (2 * o.routeSigma * o.routeSigma));
        return like;
    }

    private initialK(root: number): number {
        const o = this.options;
        if (o.learnedK && o.learnedK > 0) return o.learnedK * (1 + this.gauss() * 0.08);
        const length = o.stepLength.mean + (this.random() * 2 - 1) * o.stepLength.spread;
        return Math.max(0.2, length) / root;
    }

    private initOffsets(heading: number): void {
        const prior = this.offsetPrior;
        for (let i = 0; i < this.options.count; i++) {
            this.offset[i] = prior ? prior.absolute - heading + this.gauss() * prior.spread : this.random() * 360;
        }
        this.offsetsReady = true;
    }

    private normalize(total: number): void {
        for (let i = 0; i < this.options.count; i++) this.w[i]! /= total;
    }

    private ess(): number {
        let s = 0;
        for (let i = 0; i < this.options.count; i++) s += this.w[i]! * this.w[i]!;
        return s > 0 ? 1 / s : 0;
    }

    /** Systematic resampling; injectRatio phần hạt được rải mới quanh ước lượng (giữ K, hướng của một hạt tốt) */
    private resample(injectRatio: number): void {
        const n = this.options.count;
        const est = injectRatio > 0 ? this.estimate() : null;
        const [x, y, floor, offset, k] = [new Float64Array(n), new Float64Array(n), new Int32Array(n), new Float64Array(n), new Float64Array(n)];
        const step = 1 / n;
        let u = this.random() * step;
        let c = this.w[0]!;
        let j = 0;
        for (let i = 0; i < n; i++) {
            while (u > c && j < n - 1) c += this.w[++j]!;
            x[i] = this.x[j]!;
            y[i] = this.y[j]!;
            floor[i] = this.floor[j]!;
            offset[i] = this.offset[j]! + this.gauss() * this.options.roughen.offset;
            k[i] = this.k[j]! * (1 + this.gauss() * this.options.roughen.k);
            u += step;
        }
        if (est) {
            const p = toLocalMeters(this.index.origin, est);
            const segs = this.route?.get(est.floorId);
            if (segs && this.options.routeInject > 0) {
                // các đoạn tuyến trong cửa sổ quanh ước lượng
                const near: number[] = [];
                for (let s = 0; s < segs.length; s += 4) {
                    const one = segs.subarray(s, s + 4);
                    if (distanceToSegments(one, p.x, p.y) <= this.options.routeWindow) near.push(s);
                }
                const count = near.length ? Math.floor(n * this.options.routeInject) : 0;
                for (let m = 0; m < count; m++) {
                    const s = near[Math.floor(this.random() * near.length)]!;
                    const t = this.random();
                    const i = Math.floor(this.random() * n);
                    x[i] = segs[s]! + t * (segs[s + 2]! - segs[s]!) + this.gauss();
                    y[i] = segs[s + 1]! + t * (segs[s + 3]! - segs[s + 1]!) + this.gauss();
                    floor[i] = est.floorId;
                }
            }
            const spread = Math.max(2, est.spread * 1.5);
            const injected = Math.floor(n * injectRatio);
            for (let m = 0; m < injected; m++) {
                const i = Math.floor(this.random() * n);
                x[i] = p.x + this.gauss() * spread;
                y[i] = p.y + this.gauss() * spread;
                floor[i] = est.floorId;
                offset[i] = offset[i]! + this.gauss() * 15;
            }
        }
        this.x = x;
        this.y = y;
        this.floor = floor;
        this.offset = offset;
        this.k = k;
        this.w.fill(1 / n);
    }

    /** Mọi giả thuyết đều chết (ví dụ đi vào chỗ chưa vẽ lối đi): rải rộng quanh vị trí cũ, nới hướng */
    private recover(): void {
        this.recoveries++;
        const n = this.options.count;
        let mx = 0, my = 0;
        for (let i = 0; i < n; i++) {
            mx += this.x[i]!;
            my += this.y[i]!;
        }
        mx /= n;
        my /= n;
        for (let i = 0; i < n; i++) {
            this.x[i] = mx + this.gauss() * 4;
            this.y[i] = my + this.gauss() * 4;
            this.offset[i]! += this.gauss() * 25;
            this.w[i] = 1 / n;
        }
    }
}
