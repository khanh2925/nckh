import { readFileSync } from "node:fs";
import { describe, it } from "vitest";
import {
    ParticleFilter, replayPositioningLog, type PositioningLog, bearing, buildVenueModel, buildWalkwayIndex, distance, findRoute, isRouteError, offset, snapToRoute, weinbergLength,
    type LatLng, type Route, type VenueMapDto
} from "../src";

// Đánh giá bộ lọc hạt trên các tuyến thật của Sân bay Tân Sơn Nhất (giả lập người đi), để đưa số liệu vào báo cáo.
// Không chạy cùng test thường (mất ~1 phút). Chạy: PF_EVAL=1 npx vitest run test/positioning.eval.test.ts
//
// Giả lập: người đi đúng theo tuyến, bước thật = K_thật × A^(1/4) (A dao động 10%), hướng đo = hướng thật − độ lệch con quay
// (không biết trước) + nhiễu 4°; bộ lọc không biết K, không biết độ lệch. "Cách cũ" = mỗi bước cộng 0,7 m dọc tuyến.
// Đây là số liệu mô phỏng, chưa thay được đo thực tế bằng điện thoại.
//
// Nhật ký đi thật (Cài đặt -> Ghi nhật ký cảm biến -> Tải nhật ký): PF_LOG=đường/dẫn/nhat-ky.json npx vitest run test/positioning.eval.test.ts
// in sai số tại từng mốc QR (trước khi mốc sửa lại). Thử tham số khác: thêm PF_OPTS='{"corridorSigma":1.5}'.

const bundle = JSON.parse(
    readFileSync(new URL("../../../Front-End/public/data/venues/tan-son-nhat.json", import.meta.url), "utf8")
) as VenueMapDto;
const model = buildVenueModel(bundle);
const index = buildWalkwayIndex(model.walkways);

function rng(seed: number) {
    let s = seed;
    const u = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    return { u, g: () => Math.sqrt(-2 * Math.log(Math.max(u(), 1e-12))) * Math.cos(2 * Math.PI * u()) };
}

/** Vài tuyến ngẫu nhiên (≥ 60 m, một tầng) trên mỗi tầng của sân bay */
function sampleRoutes(perFloor = 6): Route[] {
    const out: Route[] = [];
    for (const b of model.buildings) {
        for (const f of model.floorsOf(b.id)) {
            const places = model.locations.filter(l => l.floorId === f.id);
            const r = rng(f.id + 7);
            for (let n = 0; n < perFloor; n++) {
                const a = places[Math.floor(r.u() * places.length)];
                const c = places[Math.floor(r.u() * places.length)];
                if (!a || !c) continue;
                const route = findRoute(model.walkways, a, c);
                if (!isRouteError(route) && route.legs.length === 1 && route.distance >= 60) out.push(route);
            }
        }
    }
    return out;
}

function walk(route: Route, { trueK = 0.49, gyroOffset = 47, drift = 0, seed = 1 } = {}) {
    const pts = route.legs[0]!.points;
    const r = rng(seed);
    const out: { truth: LatLng; amplitude: number; heading: number }[] = [];
    let seg = 1;
    let at: LatLng = pts[0]!;
    while (seg < pts.length) {
        const amplitude = 2.6 * (1 + 0.1 * r.g());
        let remaining = weinbergLength(trueK, amplitude);
        let dir = bearing(at, pts[seg]!);
        while (remaining > 0 && seg < pts.length) {
            const left = distance(at, pts[seg]!);
            dir = bearing(at, pts[seg]!);
            if (left > remaining) {
                at = offset(at, dir, remaining);
                remaining = 0;
            } else {
                at = pts[seg]!;
                remaining -= left;
                seg++;
            }
        }
        out.push({ truth: at, amplitude, heading: dir - gyroOffset - drift * out.length + 4 * r.g() });
    }
    return out;
}

const median = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] ?? NaN;
const fmt = (v: number) => v.toFixed(1).padStart(6);

describe.skipIf(!process.env.PF_EVAL)("đánh giá bộ lọc hạt (mô phỏng)", () => {
    it("đi đúng tuyến: sai số cuối tuyến và p90 nửa sau, so với cách cũ", () => {
        const routes = sampleRoutes();
        const cases = [
            { label: "Có hướng ban đầu ±60°, K 0,49", prior: true, trueK: 0.49, gyroOffset: 47, drift: 0 },
            { label: "Không biết hướng ban đầu", prior: false, trueK: 0.49, gyroOffset: 47, drift: 0 },
            { label: "Bước ngắn (K 0,42)", prior: true, trueK: 0.42, gyroOffset: 120, drift: 0 },
            { label: "Bước dài (K 0,56)", prior: true, trueK: 0.56, gyroOffset: -80, drift: 0 },
            { label: "Con quay trôi 0,05°/bước", prior: true, trueK: 0.49, gyroOffset: 47, drift: 0.05 }
        ];
        const rows = [`${routes.length} tuyến, dài ${Math.round(median(routes.map(r => r.distance)))} m (trung vị)`,
            "Trường hợp                           | cuối tuyến: trung vị  lớn nhất | p90 nửa sau: trung vị  lớn nhất | cách cũ: trung vị  lớn nhất"];
        for (const c of cases) {
            const finals: number[] = [];
            const p90s: number[] = [];
            const olds: number[] = [];
            routes.forEach((route, i) => {
                const w = walk(route, { ...c, seed: i + 1 });
                const start = route.legs[0]!.points[0]!;
                const pf = new ParticleFilter(index, { seed: i + 1 });
                pf.setRoute(route.legs);
                pf.reset({ ...start, floorId: route.legs[0]!.floorId }, 3, c.prior ? { absolute: bearing(start, route.legs[0]!.points[1]!) + 20, spread: 60 } : null);
                const errors = w.map(s => {
                    pf.step(s, s.heading);
                    return distance(pf.estimate()!, s.truth);
                });
                const walked = w.reduce((sum, s, j) => sum + distance(j === 0 ? start : w[j - 1]!.truth, s.truth), 0);
                finals.push(errors[errors.length - 1]!);
                const half = errors.slice(Math.floor(errors.length / 2)).sort((a, b) => a - b);
                p90s.push(half[Math.floor(half.length * 0.9)]!);
                olds.push(Math.abs(w.length * 0.7 - walked));
            });
            rows.push(`${c.label.padEnd(36)} | ${fmt(median(finals))} ${fmt(Math.max(...finals))}          | ${fmt(median(p90s))} ${fmt(Math.max(...p90s))}          | ${fmt(median(olds))} ${fmt(Math.max(...olds))}`);
        }
        console.log(rows.join("\n"));
    }, 300_000);

    it("rẽ nhầm: bộ lọc có nhận ra đã đi khỏi tuyến không", () => {
        let total = 0;
        let detected = 0;
        for (const b of model.buildings) {
            for (const f of model.floorsOf(b.id)) {
                const places = model.locations.filter(l => l.floorId === f.id);
                const r = rng(f.id * 3 + 1);
                for (let n = 0; n < 8; n++) {
                    const [a, planned, actual] = [0, 1, 2].map(() => places[Math.floor(r.u() * places.length)]);
                    if (!a || !planned || !actual) continue;
                    const plannedRoute = findRoute(model.walkways, a, planned);
                    const actualRoute = findRoute(model.walkways, a, actual);
                    if (isRouteError(plannedRoute) || isRouteError(actualRoute) || plannedRoute.legs.length !== 1 || actualRoute.legs.length !== 1 || actualRoute.distance < 60) continue;
                    const w = walk(actualRoute, { seed: n + 1 });
                    const gap = snapToRoute(plannedRoute, { ...w[w.length - 1]!.truth, floorId: f.id })?.gap ?? 0;
                    if (gap < 25) continue; // đường thật không lệch tuyến dự định đủ xa
                    const start = actualRoute.legs[0]!.points[0]!;
                    const pf = new ParticleFilter(index, { seed: n + 1 });
                    pf.setRoute(plannedRoute.legs);
                    pf.reset({ ...start, floorId: f.id }, 3, { absolute: bearing(start, actualRoute.legs[0]!.points[1]!) + 20, spread: 60 });
                    for (const s of w) pf.step(s, s.heading);
                    total++;
                    if (pf.estimate()!.offRoute) detected++;
                }
            }
        }
        console.log(`Rẽ nhầm (lệch tuyến dự định ≥ 25 m): nhận ra ${detected}/${total}`);
    }, 300_000);
});

describe.skipIf(!process.env.PF_LOG)("chạy lại nhật ký đi thật", () => {
    it("sai số tại các mốc", () => {
        const log = JSON.parse(readFileSync(process.env.PF_LOG!, "utf8")) as PositioningLog;
        const walkways = log.walkways ?? (JSON.parse(
            readFileSync(new URL(`../../../Front-End/public/data/venues/${log.venue}.json`, import.meta.url), "utf8")
        ) as VenueMapDto).walkways;
        const result = replayPositioningLog(log, buildWalkwayIndex(walkways), JSON.parse(process.env.PF_OPTS || "{}"));
        const rows = result.checkpoints.map(c => `${(c.t / 1000).toFixed(0).padStart(5)} s  ${c.source.padEnd(6)} nâng cao ${fmt(c.error)} m (tự báo ±${c.spread.toFixed(1)})   cách cũ ${c.basicError == null ? "     -" : fmt(c.basicError)} m`);
        const errors = result.checkpoints.map(c => c.error).filter(Number.isFinite);
        const basics = result.checkpoints.map(c => c.basicError).filter((v): v is number => v != null && Number.isFinite(v));
        console.log([`${log.device}`, `${result.steps} bước, K cuối ${result.k?.toFixed(3) ?? "-"}`, ...rows,
            `Định vị nâng cao: trung vị ${fmt(median(errors))} m, lớn nhất ${fmt(Math.max(...errors))} m`,
            basics.length ? `Cách cũ (${log.settings.stepLength} m/bước): trung vị ${fmt(median(basics))} m, lớn nhất ${fmt(Math.max(...basics))} m` : ""].join("\n"));
        // Sự cố app đã ghi lúc đi: chấm nhảy (kèm nguyên nhân), QR sửa bao xa, GPS bị loại, bước bị bỏ, bước học được giữa hai QR
        const issues = log.events.flatMap(e => {
            const at = `${(e.t / 1000).toFixed(0).padStart(5)} s`;
            if (e.type === "jump") return [`${at}  ${e.correction ? "QR sửa  " : "NHẢY    "} ${fmt(e.meters)} m trong ${(e.dtMs / 1000).toFixed(1)} s, do ${e.cause}`];
            if (e.type === "outlier") return [`${at}  bỏ ${e.source.padEnd(5)}  lệch ${fmt(e.meters)} m (±${e.accuracy.toFixed(0)})`];
            if (e.type === "stride") return [`${at}  học bước giữa hai QR: ${e.stepLength.toFixed(2)} m/bước, K ${e.k?.toFixed(3) ?? "-"} trên ${e.meters.toFixed(0)} m`];
            return [];
        });
        const rejected = log.events.filter(e => e.type === "stepReject").length;
        if (issues.length || rejected) console.log(["Sự cố lúc đi:", ...issues, rejected ? `${rejected} bước bị bỏ vì sai nhịp` : ""].join("\n"));
    }, 300_000);
});
