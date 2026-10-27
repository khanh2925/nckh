import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
    HeadingFilter, StepDetector, advanceTrip, buildVenueModel, confirmFloorChange, createProjection, distance, findPieces, buildGraph,
    findRoute, fixTripPosition, isAtFloorChange, isRouteError, parseQrPayload, findNodeByCode, plateText, planRoute, searchPlaces,
    startTrip, translateHours, viewTrip, type Position, type VenueMapDto
} from "../src";

// Dữ liệu thật của Sân bay Tân Sơn Nhất (sinh bởi Front-End/scripts/build-demo-venue.py)
const bundle = JSON.parse(
    readFileSync(new URL("../../../Front-End/public/data/venues/tan-son-nhat.json", import.meta.url), "utf8")
) as VenueMapDto;
const model = buildVenueModel(bundle);

const t1 = model.buildings.find(b => b.code === "T1")!;
const [t1f1, t1f0] = model.floorsOf(t1.id); // cao xuống thấp: Tầng 1, Tầng trệt

describe("venue model", () => {
    it("lập chỉ mục đủ dữ liệu", () => {
        expect(model.buildings.map(b => b.code)).toEqual(["T1", "T2", "T3", "KV"]);
        expect(model.floors).toHaveLength(11);
        expect(model.locations.length).toBe(705);
        expect(t1f1!.level).toBe(1);
        expect(t1f0!.level).toBe(0);
        expect(model.groups[0]!.code).toBe("gate");
    });

    it("tìm kiếm không dấu, gần trước khi biết vị trí", () => {
        const hits = searchPlaces(model, "nha ve sinh", { floorId: t1f1!.id });
        expect(hits.length).toBeGreaterThan(0);
        const near = { floorId: t1f1!.id, lat: hits[0]!.place.lat, lng: hits[0]!.place.lng };
        const sorted = searchPlaces(model, "cua", { near });
        for (let i = 1; i < sorted.length; i++) expect(sorted[i]!.meters!).toBeGreaterThanOrEqual(sorted[i - 1]!.meters!);
    });
});

describe("projection", () => {
    it("bản vẽ InMapz: góc trên-trái và trên-phải khớp điểm mốc, chiếu xuôi rồi ngược ra lại", () => {
        const p = createProjection(t1f1!.plan!)!;
        const tl = p.toLatLng(0, 0);
        expect(tl.lat).toBeCloseTo(t1f1!.plan!.anchor!.latlng[0], 6);
        expect(tl.lng).toBeCloseTo(t1f1!.plan!.anchor!.latlng[1], 6);
        const back = p.toImage(p.toLatLng(12345, 23456));
        expect(back.x).toBeCloseTo(12345, 3);
        expect(back.y).toBeCloseTo(23456, 3);
        // góc dưới-phải phải gần đông-nam của khung bao crawl (sw.lat 10.812182, ne.lng 106.663239)
        const br = p.toLatLng(t1f1!.plan!.width!, t1f1!.plan!.height!);
        expect(br.lat).toBeCloseTo(10.812182, 4);
        expect(br.lng).toBeCloseTo(106.663239, 5);
    });
});

describe("routing", () => {
    const gate = model.locations.find(l => l.floorId === t1f1!.id && l.type === "gate")!;
    const checkin = model.locations.find(l => l.floorId === t1f0!.id && l.type === "checkin")!;

    it("cùng tầng: tuyến một chặng, dài hơn đường chim bay", () => {
        const other = model.locations.find(l => l.floorId === t1f1!.id && l.type === "restroom")!;
        const route = findRoute(model.walkways, gate, other);
        expect(isRouteError(route)).toBe(false);
        if (isRouteError(route)) return;
        expect(route.legs).toHaveLength(1);
        expect(route.distance).toBeGreaterThanOrEqual(Math.floor(distance(gate, other)) - 1);
    });

    it("khác tầng: hai chặng, có thang, chỉ dẫn có bước đổi tầng và bước đến nơi", () => {
        const planned = planRoute(model, checkin, gate);
        expect("error" in planned).toBe(false);
        if ("error" in planned) return;
        expect(planned.legs.length).toBeGreaterThanOrEqual(2);
        expect(planned.legs[0]!.connector).toBeTruthy();
        const kinds = planned.steps.map(s => s.kind);
        expect(kinds[0]).toBe("depart");
        expect(kinds).toContain("floor-up");
        expect(kinds[kinds.length - 1]).toBe("arrive");
        // "at" tăng dần
        for (let i = 1; i < planned.steps.length; i++) expect(planned.steps[i]!.at).toBeGreaterThanOrEqual(planned.steps[i - 1]!.at - 0.01);
    });

    it("tránh thang cuốn: chỉ đổi tầng bằng thang máy (hoặc báo lỗi rõ ràng)", () => {
        const route = findRoute(model.walkways, checkin, gate, { avoidStairs: true });
        if (isRouteError(route)) {
            expect(route.error).toMatch(/thang máy/);
        } else {
            route.legs.slice(0, -1).forEach(leg => expect(leg.connector).toBe("Thang máy"));
        }
    });

    it("mảnh rời được đánh số", () => {
        const pieces = new Set(findPieces(buildGraph(model.walkways)).values());
        expect(pieces.size).toBeGreaterThan(0);
    });
});

describe("trip", () => {
    const gate = model.locations.find(l => l.floorId === t1f1!.id && l.type === "gate")!;
    const checkin = model.locations.find(l => l.floorId === t1f0!.id && l.type === "checkin")!;
    const from: Position = { floorId: checkin.floorId, lat: checkin.lat, lng: checkin.lng, source: "place" };

    it("đi hết chặng 1 thì dừng chờ đổi tầng, xác nhận rồi đi tiếp tới nơi", () => {
        const planned = planRoute(model, from, gate);
        if ("error" in planned) throw new Error(planned.error);
        let trip = startTrip(planned, from, gate, 0);
        trip = advanceTrip(trip, 10_000, 1);
        expect(trip.progress).toBeCloseTo(planned.legs[0]!.distance, 3);
        expect(isAtFloorChange(trip)).toBe(true);
        expect(viewTrip(trip).atFloorChange).toBe(true);
        trip = confirmFloorChange(trip);
        expect(trip.activeLeg).toBe(1);
        for (let i = 0; i < 1000 && !trip.arrived; i++) {
            if (isAtFloorChange(trip)) trip = confirmFloorChange(trip);
            trip = advanceTrip(trip, 1.3, i);
        }
        expect(trip.arrived).toBe(true);
    });

    it("quét QR gần tuyến thì nhảy tới chỗ đó, xa thì lập lại tuyến", () => {
        const planned = planRoute(model, from, gate);
        if ("error" in planned) throw new Error(planned.error);
        const trip = startTrip(planned, from, gate, 0);
        const onRoute = planned.legs[0]!.points[Math.floor(planned.legs[0]!.points.length / 2)]!;
        const fixed = fixTripPosition(model, trip, { ...onRoute, source: "qr" });
        expect(fixed.progress).toBeGreaterThan(0);
        expect(fixed.qrFixes).toBe(1);
        expect(fixed.rerouted).toBe(0);
    });
});

describe("qr, text, pdr", () => {
    it("đọc nội dung mã QR", () => {
        expect(parseQrPayload("https://indoormap.vn/q/tan-son-nhat/T1-1-17")).toEqual({ slug: "tan-son-nhat", code: "T1-1-17" });
        expect(parseQrPayload("tan-son-nhat:T1-0-5")).toEqual({ slug: "tan-son-nhat", code: "T1-0-5" });
        expect(parseQrPayload(" t1-1-17 ")).toEqual({ slug: null, code: "t1-1-17" });
        expect(findNodeByCode(model, "t1-1-17")?.id).toBe("T1-1-17");
    });

    it("biển số và giờ mở cửa", () => {
        expect(plateText({ type: "gate", name: "Cửa 12" })).toBe("12");
        expect(plateText({ type: "restroom", name: "WC" })).toBe("WC");
        expect(translateHours("5AM-9PM")).toBe("05:00 – 21:00");
    });

    it("đếm bước từ dao động gia tốc ~2 Hz", () => {
        const detector = new StepDetector();
        let steps = 0;
        for (let t = 0; t < 10_000; t += 20) {
            const z = 9.8 + 3 * Math.sin((2 * Math.PI * 2 * t) / 1000);
            if (detector.push(0, 0, z, t)) steps++;
        }
        expect(steps).toBeGreaterThanOrEqual(17);
        expect(steps).toBeLessThanOrEqual(21);
    });

    it("làm mượt la bàn qua mốc 0°", () => {
        const f = new HeadingFilter(0.5);
        f.push(350);
        const v = f.push(10);
        expect(v === 0 || v > 350 || v < 10).toBe(true);
    });
});

describe("search relevance", () => {
    it("từ khoá khớp đầu từ, tên khớp nhiều từ lên trước", () => {
        const hits = searchPlaces(model, "quay thu tuc b");
        expect(hits[0]!.place.name).toBe("Quầy Thủ Tục B");
        expect(searchPlaces(model, "cua 05")[0]!.place.name).toBe("Cửa 05");
    });
});

describe("trip view at floor change", () => {
    it("bước hiện tại là bước đổi tầng", () => {
        const gate = model.locations.find(l => l.floorId === t1f1!.id && l.type === "gate")!;
        const checkin = model.locations.find(l => l.floorId === t1f0!.id && l.type === "checkin")!;
        const from: Position = { floorId: checkin.floorId, lat: checkin.lat, lng: checkin.lng, source: "place" };
        const planned = planRoute(model, from, gate);
        if ("error" in planned) throw new Error(planned.error);
        let trip = startTrip(planned, from, gate, 0);
        trip = advanceTrip(trip, planned.legs[0]!.distance - 1.5, 1);
        const view = viewTrip(trip);
        expect(view.atFloorChange).toBe(true);
        expect(view.step?.kind.startsWith("floor")).toBe(true);
    });
});

describe("analyzeVenue", () => {
    it("báo cáo dữ liệu Tân Sơn Nhất", async () => {
        const { analyzeVenue } = await import("../src");
        const r = analyzeVenue(model);
        expect(r.nodes).toBe(2138);
        expect(r.unreachable.length + r.isolated.length).toBeLessThan(model.locations.length);
        expect(r.floorsWithoutPlan).toHaveLength(0);
        console.log("unreachable", r.unreachable.length, "isolated", r.isolated.length, "stray", r.strayNodes.size, "loose", r.looseConnectors.length);
    });
});

describe("calibration from two arbitrary points", () => {
    it("đặt lại đúng hai điểm mốc", async () => {
        const { anchorsFromTwoPoints, createProjection: cp, describeProjection } = await import("../src");
        const A = { image: [120, 340] as [number, number], latlng: [10.81300, 106.66200] as [number, number] };
        const B = { image: [900, 80] as [number, number], latlng: [10.81420, 106.66310] as [number, number] };
        const r = anchorsFromTwoPoints(A, B)!;
        const p = cp({ width: 1000, height: 600, anchor: r.anchor, end: r.end, depthScale: 1 })!;
        const b = p.toLatLng(900, 80);
        expect(b.lat).toBeCloseTo(10.81420, 6);
        expect(b.lng).toBeCloseTo(106.66310, 6);
        const d = describeProjection({ width: 1000, height: 600, anchor: r.anchor, end: r.end })!;
        expect(d.metersPerPixel).toBeGreaterThan(0);
    });
});

describe("đặt tỉ lệ bằng số đo", () => {
    it("kéo B tới đúng khoảng cách, giữ hướng; mét/pixel khớp số đo", async () => {
        const { withMeasuredDistance, controlDistance, anchorsFromTwoPoints, describeProjection, svgPixelsPerMeter } = await import("../src");
        const A = { image: [643, 765] as [number, number], latlng: [10.8000, 106.6600] as [number, number] };
        const B = { image: [2873, 765] as [number, number], latlng: [10.8001, 106.6603] as [number, number] }; // ước lượng ~35 m
        const fixed = withMeasuredDistance(A, B, 22.3);
        expect(controlDistance(A, fixed)).toBeCloseTo(22.3, 2);
        const r = anchorsFromTwoPoints(A, fixed)!;
        const d = describeProjection({ width: 2931, height: 1792, anchor: r.anchor, end: r.end })!;
        expect(d.metersPerPixel).toBeCloseTo(0.01, 4);
        expect(svgPixelsPerMeter('<svg xmlns="http://www.w3.org/2000/svg" data-px-per-meter="100" viewBox="0 0 10 10">')).toBe(100);
        expect(svgPixelsPerMeter("<svg viewBox='0 0 1 1'><g data-px-per-meter='5'/></svg>")).toBeNull();
    });
});

describe("chỉ đường trong không gian nhỏ (căn hộ quét LiDAR)", () => {
    it("giữ lượt rẽ vào cửa, mốc là phòng/cửa, không lặp 'đi qua'", async () => {
        const fs = await import("fs");
        const { buildVenueModel, planRoute, findNodeByCode } = await import("../src");
        const d = JSON.parse(fs.readFileSync(new URL("./fixtures/nha-khanh.json", import.meta.url), "utf8"));
        const types = [{ id: 1, code: "room", name: "Phòng" }, { id: 2, code: "entrance", name: "Lối vào" }, { id: 3, code: "corridor", name: "Hành lang" }];
        const model = buildVenueModel({ venue: { id: 1, slug: "nha-khanh", name: "Nhà Khánh" } as never, buildings: [d.building], floors: [d.floor], zones: [], types: types as never, facilities: [], locations: d.locations, walkways: { nodes: d.nodes, edges: d.edges } });
        const qr = findNodeByCode(model, "nha-c3")!;
        const to = model.locations.find(l => l.name === "Phòng khách")!;
        const r = planRoute(model, { floorId: qr.floorId, lat: qr.lat, lng: qr.lng }, to) as { distance: number; steps: { title: string; detail?: string }[] };
        expect(r.distance).toBeGreaterThan(11);
        expect(r.distance).toBeLessThan(15);
        expect(r.steps.map(s => s.title)).toEqual(["Đi thẳng 4 m", "Rẽ phải tại Cửa căn hộ", "Rẽ phải tại Phòng ăn", "Đến Phòng khách"]);
        expect(r.steps.some(s => s.detail?.includes("qua Bếp"))).toBe(false);
    });
});

describe("đếm bước thích nghi", () => {
    // Giả lập gia tốc khi đi: trọng lực + dao động theo nhịp bước + nhiễu
    function walk(stepsPerSec: number, amplitude: number, seconds: number, noise = 0.15, seed = 1) {
        let r = seed;
        const rand = () => ((r = (r * 16807) % 2147483647) / 2147483647 - 0.5) * 2;
        const out: [number, number, number, number][] = [];
        for (let t = 0; t < seconds * 60; t++) {
            const time = (t / 60) * 1000;
            const a = amplitude * Math.sin(2 * Math.PI * stepsPerSec * (t / 60)) + noise * rand();
            out.push([0.3 * rand() * noise, 0.2, 9.81 + a, time]);
        }
        return out;
    }
    const count = async (samples: [number, number, number, number][]) => {
        const { AdaptiveStepDetector } = await import("../src");
        const d = new AdaptiveStepDetector();
        return samples.filter(s => d.push(...s)).length;
    };
    it("đi thường (1,8 bước/s, mạnh) và đi chậm nhẹ trong nhà (1,3 bước/s) đều đếm sát", async () => {
        const normal = await count(walk(1.8, 2.0, 10));
        const gentle = await count(walk(1.3, 0.7, 10, 0.1, 7));
        expect(Math.abs(normal - 18)).toBeLessThanOrEqual(2);
        expect(Math.abs(gentle - 13)).toBeLessThanOrEqual(2);
    });
    it("đứng yên rung tay không đếm bước; StepDetector cũ sót bước khi đi nhẹ", async () => {
        expect(await count(walk(1.5, 0, 10, 0.12, 3))).toBe(0);
        const { StepDetector } = await import("../src");
        const old = new StepDetector();
        expect(walk(1.3, 0.7, 10, 0.1, 7).filter(s => old.push(...s)).length).toBeLessThan(5);
    });
    it("độ dài bước từ lần đo", async () => {
        const { stepLengthFrom } = await import("../src");
        expect(stepLengthFrom(10, 16)).toBe(0.63);
        expect(stepLengthFrom(10, 2)).toBeNull();
    });
});

