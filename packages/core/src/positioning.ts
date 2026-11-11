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
    count: 400, seed: 1, corridorSigma: 2, maxOffPath: 7, stepNoise: 0.08, headingNoise: 6, offsetDrift: 0.1, kDrift: 0.01,
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
    step(sample: Pick<StepSample, "amplitude">, heading: number): boolean {
        if (!this.started) return false;
        const o = this.options;
        const n = o.count;
        const root = Math.pow(Math.max(sample.amplitude, 0.05), 0.25);
        if (!this.offsetsReady) this.initOffsets(heading);
        let total = 0;
        for (let i = 0; i < n; i++) {
            if (Number.isNaN(this.k[i]!)) this.k[i] = this.initialK(root);
            const length = Math.min(1.3, Math.max(0.2, this.k[i]! * root * (1 + this.gauss() * o.stepNoise)));
            const theta = (heading + this.offset[i]! + this.gauss() * o.headingNoise) * DEG;
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
