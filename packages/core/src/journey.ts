import { createDistanceOracle, type RouteOptions } from "./routing";
import { planRoute, type PlannedRoute } from "./trip";
import type { FloorPoint, JourneyDto, JourneyStepDto } from "./types";
import type { Place, VenueModel } from "./venueModel";

// Quy trình (docs/DAC_TA_QUY_TRINH.md, mục 5): chuỗi bước có thứ tự, bước theo loại có nhiều nơi phục vụ.
// Chọn nơi cho CẢ chuỗi để tổng quãng đường ngắn nhất = đường đi ngắn nhất qua đồ thị phân tầng
// (tầng k = các nơi phục vụ bước k), giải bằng quy hoạch động:
//   best[k][c] = min_{c' ∈ tầng k−1} best[k−1][c'] + d(c', c)
// d lấy từ một Dijkstra một-nguồn cho mỗi ứng viên của tầng trước (createDistanceOracle).

export type JourneyAnswers = Record<string, boolean>;

export interface JourneyStepChoice {
    place: Place;
    /** Quãng từ nơi của bước trước (m), Infinity = không tới được */
    distance: number;
}

export interface JourneyStepPlan {
    index: number;
    step: JourneyStepDto;
    /** Bỏ qua vì câu trả lời (skipIf) hoặc vì bước tuỳ chọn không có nơi tới được */
    skipped: boolean;
    skipReason?: string;
    place: Place | null;
    /** Các nơi phục vụ khác của bước, gần nhất trước (cho "Đổi nơi khác") */
    choices: JourneyStepChoice[];
    /** Tuyến từ bước trước (hoặc từ vị trí của khách) tới nơi của bước */
    route: PlannedRoute | null;
    dwellMinutes: number;
}

export interface JourneyPlan {
    steps: JourneyStepPlan[];
    /** Tổng quãng đi bộ (m) và thời gian đi bộ (giây) */
    distance: number;
    walkSeconds: number;
    /** Tổng thời gian ở các bước, ước tính của chủ địa điểm */
    dwellMinutes: number;
    /** Lý do không bắt đầu được (bước bắt buộc không có nơi tới được) */
    error: string | null;
}

export interface JourneyPlanOptions extends RouteOptions {
    /** Nơi khách tự chọn cho bước (chỉ số bước -> id điểm), vd. đúng cửa ra máy bay của mình */
    pinned?: Record<number, number>;
    /** Chọn nơi gần nhất từng bước (để so sánh với quy hoạch động trong báo cáo) */
    greedy?: boolean;
    /** Đang đi giữa chừng: các bước đã xong và các bước khách tự bỏ qua (không tính tuyến nữa) */
    done?: number[];
    skip?: number[];
}

/** Bước bị bỏ khi MỌI điều kiện bỏ qua đều thoả (và có ít nhất một điều kiện) */
export function isStepSkipped(step: JourneyStepDto, answers: JourneyAnswers): boolean {
    const conditions = step.skipIf ?? [];
    return conditions.length > 0 && conditions.every(c => answers[c.questionId] === c.answer);
}

/** Các nơi phục vụ một bước: đúng điểm đã chọn, hoặc mọi điểm thuộc loại */
export function stepCandidates(model: VenueModel, step: JourneyStepDto): Place[] {
    if (step.targetLocationId != null) {
        const place = model.locationsById.get(step.targetLocationId);
        return place ? [place] : [];
    }
    if (step.targetType) return model.locations.filter(l => l.type === step.targetType);
    return [];
}

interface Node {
    place: Place | null;
    point: FloorPoint;
    cost: number;
    back: Node | null;
}

export function planJourney(model: VenueModel, from: FloorPoint, journey: Pick<JourneyDto, "steps" | "questions">,
    answers: JourneyAnswers = {}, options: JourneyPlanOptions = {}): JourneyPlan {
    const oracle = createDistanceOracle(model.walkways, options);
    const plans: JourneyStepPlan[] = journey.steps.map((step, index) => ({
        index, step, skipped: false, place: null, choices: [], route: null, dwellMinutes: step.dwellMinutes ?? 0
    }));

    // Lớp k: các nơi phục vụ bước k (bước bị bỏ không tạo lớp)
    let layer: Node[] = [{ place: null, point: from, cost: 0, back: null }];
    const layerOf = new Map<number, Node[]>();
    let error: string | null = null;
    for (const plan of plans) {
        if (options.done?.includes(plan.index) || options.skip?.includes(plan.index)) {
            plan.skipped = true;
            plan.skipReason = options.done?.includes(plan.index) ? "Đã xong" : "Bạn đã bỏ qua";
            continue;
        }
        if (isStepSkipped(plan.step, answers)) {
            plan.skipped = true;
            plan.skipReason = skipReason(journey, plan.step, answers);
            continue;
        }
        const pinned = options.pinned?.[plan.index];
        const pinnedPlace = pinned != null ? model.locationsById.get(pinned) : undefined;
        const candidates = pinnedPlace ? [pinnedPlace] : stepCandidates(model, plan.step);
        const next: Node[] = candidates.map(place => ({ place, point: place, cost: Infinity, back: null }));
        const sources = options.greedy ? [layer.reduce((a, b) => (b.cost < a.cost ? b : a))] : layer;
        for (const prev of sources) {
            if (!Number.isFinite(prev.cost)) continue;
            const d = oracle(prev.point, candidates);
            next.forEach((node, i) => {
                const cost = prev.cost + d[i]!;
                if (cost < node.cost) {
                    node.cost = cost;
                    node.back = prev;
                }
            });
        }
        const reachable = next.filter(n => Number.isFinite(n.cost));
        if (reachable.length === 0) {
            if (plan.step.optional) {
                plan.skipped = true;
                plan.skipReason = "Chưa có nơi phục vụ trên bản đồ";
                continue;
            }
            error = candidates.length === 0
                ? `Bước ${plan.index + 1} (${plan.step.title}) chưa có nơi phục vụ trên bản đồ.`
                : `Không có đường tới bước ${plan.index + 1} (${plan.step.title}) từ vị trí của bạn.`;
            break;
        }
        if (options.greedy) {
            // tham lam: chỉ giữ nơi gần nhất của bước này
            const nearest = reachable.reduce((a, b) => (b.cost < a.cost ? b : a));
            layer = [nearest];
        } else {
            layer = reachable;
        }
        layerOf.set(plan.index, layer);
    }

    if (!error) {
        // Truy ngược từ nơi rẻ nhất của lớp cuối để lấy nơi của từng bước
        let node: Node | null = layer.reduce((a, b) => (b.cost < a.cost ? b : a));
        const chosen: Node[] = [];
        while (node && node.place) {
            chosen.unshift(node);
            node = node.back;
        }
        const active = plans.filter(p => !p.skipped);
        active.forEach((plan, i) => {
            plan.place = chosen[i]?.place ?? null;
        });
        // Tuyến thật cho từng chặng, và các nơi khác của bước (tính từ nơi của bước trước)
        let at: FloorPoint = from;
        for (const plan of active) {
            if (!plan.place) continue;
            const routed = planRoute(model, at, plan.place, options);
            plan.route = "error" in routed ? null : routed;
            const candidates = stepCandidates(model, plan.step);
            if (candidates.length > 1) {
                const d = oracle(at, candidates);
                plan.choices = candidates.map((place, i) => ({ place, distance: d[i]! }))
                    .filter(c => Number.isFinite(c.distance)).sort((a, b) => a.distance - b.distance);
            }
            at = plan.place;
        }
    }

    const counted = plans.filter(p => !p.skipped && p.route);
    return {
        steps: plans,
        distance: Math.round(counted.reduce((s, p) => s + p.route!.distance, 0)),
        walkSeconds: counted.reduce((s, p) => s + p.route!.seconds, 0),
        dwellMinutes: plans.filter(p => !p.skipped).reduce((s, p) => s + p.dwellMinutes, 0),
        error
    };
}

function skipReason(journey: Pick<JourneyDto, "questions">, step: JourneyStepDto, answers: JourneyAnswers): string {
    const parts = (step.skipIf ?? []).map(c => {
        const q = journey.questions.find(x => x.id === c.questionId);
        return q ? `${q.text.replace(/\?$/, "")}: ${answers[c.questionId] ? "Có" : "Không"}` : "";
    }).filter(Boolean);
    return parts.length ? `Bỏ qua vì ${parts.join(", ")}` : "Bỏ qua";
}
