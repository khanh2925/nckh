import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
    ParticleFilter, PostureMonitor, StepGate, StrideCalibrator, WeinbergStepDetector, mergeStride, replayPositioningLog, type PositioningLog, bearing, buildVenueModel, buildWalkwayIndex, distance, distanceToWalkway, findRoute, fromLocalMeters,
    headingFromOrientation, isRouteError, offset, pdrTripUpdate, planRoute, startTrip, toLocalMeters, weinbergLength,
    type LatLng, type Position, type Route, type VenueMapDto
} from "../src";

// Dữ liệu thật của Sân bay Tân Sơn Nhất
const bundle = JSON.parse(
    readFileSync(new URL("../../../Front-End/public/data/venues/tan-son-nhat.json", import.meta.url), "utf8")
) as VenueMapDto;
const model = buildVenueModel(bundle);
const t1 = model.buildings.find(b => b.code === "T1")!;
const [t1f1] = model.floorsOf(t1.id);
const index = buildWalkwayIndex(model.walkways);

/** Bộ sinh số ngẫu nhiên cố định cho phần giả lập người đi */
function rng(seed: number) {
    let s = seed;
    const uniform = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    return { uniform, gauss: () => Math.sqrt(-2 * Math.log(Math.max(uniform(), 1e-12))) * Math.cos(2 * Math.PI * uniform()) };
}

/** Tuyến dài có khúc cua trên tầng 1 nhà ga T1 */
function routeWithTurn(): Route {
    const places = model.locations.filter(l => l.floorId === t1f1!.id).slice(0, 60);
    let best: Route | null = null;
    let bestScore = 0;
    for (let i = 0; i < places.length; i += 3) {
        for (let j = i + 1; j < places.length; j += 3) {
            const r = findRoute(model.walkways, places[i]!, places[j]!);
            if (isRouteError(r) || r.legs.length !== 1 || r.distance < 90 || r.distance > 220) continue;
            const pts = r.legs[0]!.points;
            let turn = 0;
            for (let k = 2; k < pts.length; k++) {
                if (distance(pts[k - 2]!, pts[k - 1]!) < 8 || distance(pts[k - 1]!, pts[k]!) < 8) continue;
                const d = Math.abs(((bearing(pts[k - 1]!, pts[k]!) - bearing(pts[k - 2]!, pts[k - 1]!) + 540) % 360) - 180);
                turn = Math.max(turn, d);
            }
            if (turn > 60 && r.distance > bestScore) {
                best = r;
                bestScore = r.distance;
            }
        }
    }
    if (!best) throw new Error("không tìm được tuyến có khúc cua");
    return best;
}

/**
 * Giả lập một người đi đúng theo tuyến: bước thật dài trueK × A^(1/4) (A = biên độ gia tốc mỗi bước),
 * hướng đo được = hướng thật − độ lệch con quay (không biết trước) + nhiễu.
 */
function walkRoute(route: Route, { trueK = 0.49, gyroOffset = 47, seed = 3 } = {}) {
    const pts = route.legs[0]!.points;
    const r = rng(seed);
    const out: { truth: LatLng; amplitude: number; heading: number }[] = [];
    let seg = 1;
    let at: LatLng = pts[0]!;
    while (seg < pts.length) {
        const amplitude = 2.6 * (1 + 0.1 * r.gauss());
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
        out.push({ truth: at, amplitude, heading: dir - gyroOffset + 4 * r.gauss() });
    }
    return out;
}

describe("định vị: cảm biến", () => {
    it("hướng từ alpha/beta/gamma đúng khi cầm nằm ngang, nghiêng 45° hay dựng đứng", () => {
        expect(headingFromOrientation(30, 0, 0)).toBeCloseTo(330, 5);
        expect(headingFromOrientation(30, 45, 0)).toBeCloseTo(330, 5);
        expect(headingFromOrientation(30, 90, 0)).toBeCloseTo(330, 5);
        expect(headingFromOrientation(0, 60, 0)).toBeCloseTo(0, 5);
    });

    it("đếm bước và đo biên độ gia tốc cho Weinberg", () => {
        const detector = new WeinbergStepDetector();
        const samples = [];
        for (let t = 0; t < 600; t++) {
            const time = (t / 60) * 1000;
            const s = detector.push(0.1, 0.2, 9.81 + 1.3 * Math.sin(2 * Math.PI * 1.8 * (t / 60)), time);
            if (s) samples.push(s);
        }
        expect(Math.abs(samples.length - 18)).toBeLessThanOrEqual(2);
        const amplitudes = samples.slice(2).map(s => s.amplitude);
        for (const a of amplitudes) expect(a).toBeGreaterThan(2.0);
        for (const a of amplitudes) expect(a).toBeLessThan(2.8);
    });
});

describe("định vị: mạng lối đi theo mét", () => {
    it("điểm trên lối đi cách 0 m, điểm xa hơn tầm tra là Infinity, tầng không có lối đi là null", () => {
        const node = model.walkways.nodes.find(n => n.floorId === t1f1!.id)!;
        const p = toLocalMeters(index.origin, node);
        expect(distanceToWalkway(index, node.floorId, p.x, p.y)).toBeLessThan(0.01);
        expect(distanceToWalkway(index, node.floorId, p.x + 5000, p.y)).toBe(Infinity);
        expect(distanceToWalkway(index, -1, p.x, p.y)).toBeNull();
        const back = fromLocalMeters(index.origin, p.x, p.y);
        expect(distance(back, node)).toBeLessThan(0.01);
    });
});

describe("định vị: bộ lọc hạt", () => {
    const route = routeWithTurn();
    const walk = walkRoute(route);
    const start = route.legs[0]!.points[0]!;
    const startBearing = bearing(start, route.legs[0]!.points[1]!);

    function run(seed: number) {
        // Không biết bước chân (giả định 0,7 ± 0,2 m), không biết độ lệch con quay; chỉ biết đại khái khách nhìn theo tuyến ±60°
        const pf = new ParticleFilter(index, { seed });
        pf.setRoute(route.legs);
        pf.reset({ ...start, floorId: t1f1!.id }, 3, { absolute: startBearing + 20, spread: 60 });
        const errors: number[] = [];
        for (const s of walk) {
            pf.step(s, s.heading);
            errors.push(distance(pf.estimate()!, s.truth));
        }
        return { pf, errors };
    }

    it("đi theo tuyến có khúc cua: sai số nhỏ và tốt hơn hẳn cách cũ (bước cố định 0,7 m)", () => {
        const { pf, errors } = run(11);
        const est = pf.estimate()!;
        const final = errors[errors.length - 1]!;
        const secondHalf = errors.slice(Math.floor(errors.length / 2));
        const p90 = [...secondHalf].sort((a, b) => a - b)[Math.floor(secondHalf.length * 0.9)]!;
        // Cách cũ: mỗi bước cộng 0,7 m dọc tuyến -> sai số = chênh lệch quãng
        const truthMeters = walk.reduce((sum, s, i) => sum + (i === 0 ? distance(start, s.truth) : distance(walk[i - 1]!.truth, s.truth)), 0);
        const oldError = Math.abs(walk.length * 0.7 - truthMeters);
        expect(final).toBeLessThan(4);
        expect(p90).toBeLessThan(5);
        expect(final).toBeLessThan(oldError / 2);
        // tự học bước chân: K gần giá trị thật 0,49 (±12%)
        expect(Math.abs(est.k - 0.49) / 0.49).toBeLessThan(0.12);
        expect(est.recoveries).toBe(0);
        expect(est.offRoute).toBe(false);
    });

    it("cùng seed, cùng dữ liệu thì ra cùng kết quả (để chạy lại log)", () => {
        expect(run(5).errors).toEqual(run(5).errors);
    });

    it("quét QR khi đã trôi xa: bộ lọc nhảy về mốc, giữ K đã học", () => {
        const { pf } = run(11);
        const kBefore = pf.estimate()!.k;
        const qr = { ...route.legs[0]!.points[1]!, floorId: t1f1!.id };
        pf.observe(qr, 1.5);
        const est = pf.estimate()!;
        expect(distance(est, qr)).toBeLessThan(1.5);
        expect(Math.abs(est.k - kBefore) / kBefore).toBeLessThan(0.05);
    });
});

describe("định vị: cập nhật chuyến đi", () => {
    const places = model.locations.filter(l => l.floorId === t1f1!.id);
    const from: Position = { ...places[0]!, source: "qr" };
    const to = places.find(p => {
        const r = findRoute(model.walkways, from, p);
        return !isRouteError(r) && r.distance > 60 && r.legs.length === 1;
    })!;
    const planned = planRoute(model, from, to);
    if ("error" in planned) throw new Error(planned.error);
    const trip = startTrip(planned, from, to);

    it("vị trí ước lượng gần tuyến thì tiến dọc tuyến, rung lùi nhỏ hơn sai số thì không lùi", () => {
        const ahead = offset(planned.legs[0]!.points[0]!, bearing(planned.legs[0]!.points[0]!, planned.legs[0]!.points[1]!), 0);
        const p20 = pdrTripUpdate(model, trip, { ...pointAlong(planned, 20), source: "pdr", accuracy: 3 });
        expect(p20.progress).toBeGreaterThan(17);
        expect(p20.progress).toBeLessThan(23);
        const back = pdrTripUpdate(model, p20, { ...pointAlong(planned, 18.5), source: "pdr", accuracy: 3 });
        expect(back.progress).toBe(p20.progress);
        expect(ahead).toBeTruthy();
    });

    it("lệch hẳn khỏi tuyến khi bộ lọc đã chắc (rẽ nhầm) thì lập lại tuyến; còn mơ hồ thì chưa", () => {
        const here = pointAlong(planned, 15);
        const far = { ...offset(here, (bearing(planned.legs[0]!.points[0]!, here) + 90) % 360, 25), floorId: here.floorId };
        const unsure = pdrTripUpdate(model, trip, { ...far, source: "pdr", accuracy: 12 });
        expect(unsure.rerouted).toBe(0);
        const sure = pdrTripUpdate(model, trip, { ...far, source: "pdr", accuracy: 3 });
        expect(sure.rerouted + (sure.progress > 0 ? 1 : 0)).toBeGreaterThan(0);
    });
});

/** Điểm cách đầu tuyến "meters" mét (chặng 1) */
function pointAlong(route: Route, meters: number) {
    const leg = route.legs[0]!;
    let left = meters;
    for (let k = 1; k < leg.points.length; k++) {
        const a = leg.points[k - 1]!;
        const b = leg.points[k]!;
        const d = distance(a, b);
        if (d >= left) return { ...offset(a, bearing(a, b), left), floorId: leg.floorId };
        left -= d;
    }
    const last = leg.points[leg.points.length - 1]!;
    return { lat: last.lat, lng: last.lng, floorId: leg.floorId };
}

describe("định vị: lọc nhịp bước, đổi cách cầm máy", () => {
    const step = (t: number) => ({ t, amplitude: 2.5, durationMs: 550 });

    it("một cú lắc lẻ không thành bước; đủ 4 bước đều nhịp thì tính bù cả 4, sau đó cho qua từng bước", () => {
        const gate = new StepGate();
        expect(gate.push(step(0))).toHaveLength(0);
        expect(gate.push(step(5000))).toHaveLength(0); // cách quá lâu: bắt đầu lại
        expect(gate.push(step(5550))).toHaveLength(0);
        expect(gate.push(step(6100))).toHaveLength(0);
        expect(gate.push(step(6650))).toHaveLength(4);
        expect(gate.push(step(7200))).toHaveLength(1);
    });

    it("bước lộn xộn (lắc máy) không mở cổng", () => {
        const gate = new StepGate();
        const times = [0, 300, 1400, 1600, 2900, 3100, 4600];
        expect(times.flatMap(t => gate.push(step(t)))).toHaveLength(0);
    });

    it("đổi cách cầm máy: trọng lực đổi phương > 35° quá 0,8 s thì báo một lần; rung khi đi thì không", () => {
        const m = new PostureMonitor();
        let changes = 0;
        for (let i = 0; i < 300; i++) {
            const t = (i / 60) * 1000;
            if (m.push(0.2 * Math.sin(i), 6.9 + 0.8 * Math.sin(i / 5), 6.9, t)) changes++; // cầm nghiêng 45°, đang đi
        }
        expect(changes).toBe(0);
        for (let i = 300; i < 500; i++) if (m.push(9.8, 0.3, 0.2, (i / 60) * 1000)) changes++; // xoay ngang / bỏ túi
        expect(changes).toBe(1);
    });
});

describe("định vị: tự hiệu chỉnh bước chân bằng GPS (như Apple Watch)", () => {
    // đi thẳng về hướng bắc 0,65 m/bước, 1,8 bước/s; GPS mỗi giây, sai số ±3 m
    function walkWithGps(seconds: number, wobble = 0) {
        const cal = new StrideCalibrator();
        const r = rng(9);
        const origin = { lat: 10.8221, lng: 106.6869 };
        const results = [];
        let stepIndex = 0;
        for (let t = 0; t <= seconds * 1000; t += 100) {
            while (stepIndex * (1000 / 1.8) <= t) {
                cal.addStep(stepIndex * (1000 / 1.8), 2.5);
                stepIndex++;
            }
            if (t % 1000 === 0) {
                const meters = (t / 1000) * 1.8 * 0.65;
                const side = wobble * Math.sin(t / 4000) * 20;
                const fix = { ...offset(offset(origin, 0, meters), 90, side + 3 * r.gauss() * 0.5), accuracy: 4, t };
                const res = cal.addFix(fix);
                if (res) results.push(res);
            }
        }
        return results;
    }

    it("đoạn thẳng, nhịp đều, GPS tốt: đo được bước ~0,65 m và hệ số K", () => {
        const results = walkWithGps(120);
        expect(results.length).toBeGreaterThan(0);
        for (const r of results) {
            expect(Math.abs(r.stepLength - 0.65)).toBeLessThan(0.05);
            expect(r.k).not.toBeNull();
        }
    });

    it("đường ngoằn ngoèo thì không dùng để hiệu chỉnh", () => {
        expect(walkWithGps(120, 1)).toHaveLength(0);
    });

    it("gộp kết quả mới theo trọng số quãng đường", () => {
        const merged = mergeStride({ stepLength: 0.7, k: 0.5, meters: 300 }, { stepLength: 0.6, k: 0.45, meters: 100, steps: 160 });
        expect(merged.stepLength).toBeCloseTo(0.675, 3);
        expect(merged.k).toBeCloseTo(0.4875, 4);
        expect(merged.meters).toBe(400);
    });
});

describe("định vị: chạy lại nhật ký cảm biến", () => {
    it("nhật ký giả lập đi theo tuyến rồi quét QR: chạy lại đo được sai số tại mốc QR, nhỏ", () => {
        const route = routeWithTurn();
        const leg = route.legs[0]!;
        const walk = walkRoute(route, { seed: 4 });
        const start = leg.points[0]!;
        const events: PositioningLog["events"] = [
            { t: 0, type: "route", legs: [{ floorId: leg.floorId, points: leg.points.map(p => [p.lat, p.lng] as [number, number]) }] },
            // như app: chưa có la bàn thì giả định khách nhìn theo tuyến ±60°
            { t: 0, type: "anchor", source: "place", floorId: leg.floorId, lat: start.lat, lng: start.lng, sigma: 3, prior: { absolute: bearing(start, leg.points[1]!) + 20, spread: 60 } }
        ];
        // mỗi bước: 33 mẫu gia tốc (60 Hz, ~1,8 bước/s) với biên độ đúng của bước đó, hướng đo = hướng của bước
        // đi tới khoảng 60% tuyến rồi quét QR (cuối tuyến thì cách cũ dừng đúng ở đích, không so được)
        const walked = walk.slice(0, Math.floor(walk.length * 0.6));
        let t = 100;
        for (const s of walked) {
            const alpha = (360 - s.heading + 3600) % 360; // headingFromOrientation(alpha, 0, 0) = 360 − alpha
            for (let i = 0; i < 33; i++) {
                events.push({ t, type: "orientation", a: alpha, b: 0, g: 0 });
                events.push({ t, type: "motion", x: 0, y: 0, z: 9.81 + (s.amplitude / 2) * Math.sin((2 * Math.PI * i) / 33 - Math.PI / 2) });
                t += 1000 / 60;
            }
        }
        const end = walked[walked.length - 1]!.truth;
        events.push({ t, type: "anchor", source: "qr", floorId: leg.floorId, lat: end.lat, lng: end.lng, sigma: 1.5 });
        const log: PositioningLog = { version: 1, venue: "tan-son-nhat", startedAt: "", device: "test", settings: { stepLength: 0.7, weinbergK: null }, events };
        const result = replayPositioningLog(log, index);
        expect(Math.abs(result.steps - walked.length)).toBeLessThanOrEqual(6);
        expect(result.checkpoints).toHaveLength(1);
        expect(result.checkpoints[0]!.error).toBeLessThan(6);
        // cách cũ (0,7 m/bước) trên cùng lần đi: người bước ngắn hơn nên lệch nhiều hơn
        expect(result.checkpoints[0]!.basicError).not.toBeNull();
        expect(result.checkpoints[0]!.basicError!).toBeGreaterThan(result.checkpoints[0]!.error);
    });
});
