import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    GPS_USABLE_ACCURACY, LOST_THRESHOLD_METERS, ParticleFilter, StrideCalibrator, angleDiff, bearing, buildWalkwayIndex, isOutdoorFloor, legStart,
    mergeStride, pointAt, positionUncertainty, viewTrip, weinbergLength, type HeadingPrior, type LatLng, type PositionEstimate, type Trip, type TripView
} from "@indoor-map/core";
import { logEvent, setLogVenue } from "../lib/positioningLog";
import { getSettings, updateSettings, useSettings } from "../lib/settings";
import {
    hasMotionSensors, needsSensorPermission, requestSensorPermission, speak, useCompass, useGps, usePdrSensors, useSensorPermission, useStepDetector,
    useWakeLock, vibrate, type PdrStep
} from "../lib/sensors";
import { useVenue } from "./VenueContext";

// "Động cơ" của chuyến đi, dùng chung cho màn 2D và màn camera:
// - mỗi bước chân (cảm biến gia tốc) tiến thêm stepLength mét dọc tuyến
// - la bàn cho hướng nhìn; khi mô phỏng thì lấy hướng của tuyến
// - tới bước mới thì rung + đọc chỉ dẫn (nếu bật trong Cài đặt)
// - ngoài trời (khuôn viên) GPS đủ tốt thì kéo vị trí theo GPS, bước chân lấp khoảng giữa hai lần đo
// - ước lượng độ lệch vị trí, quá ngưỡng thì gợi ý quét QR căn lại
// - ngoài trời, đoạn đi thẳng đều nhịp có GPS tốt thì tự đo độ dài bước (như Apple Watch)
// Định vị nâng cao (Cài đặt, thử nghiệm): thay "cộng stepLength" bằng bộ lọc hạt (@indoor-map/core/positioning):
// bước Weinberg + hướng con quay + ràng buộc lối đi; QR, "Đã xong bước này", chọn trên bản đồ, GPS là mốc.
// Mô phỏng khi bật định vị nâng cao: giả lập cảm biến có nhiễu (bước ngắn hơn giả định, con quay lệch) đưa vào bộ lọc.
export interface TripEngine {
    trip: Trip;
    view: TripView;
    heading: number | null;
    /** Hướng của đoạn tuyến phía trước (độ từ Bắc) */
    routeBearing: number | null;
    compassLive: boolean;
    stepsLive: boolean;
    /** GPS đang đủ tốt để dùng (ngoài trời) */
    gpsLive: boolean;
    simulating: boolean;
    setSimulating(on: boolean): void;
    needPermission: boolean;
    enableSensors(): Promise<void>;
    uncertainty: number;
    lost: boolean;
    steps: number;
    /** Độ bù la bàn đang áp dụng cho địa điểm này */
    headingOffset: number;
    /** Có thể căn hướng ngay lúc này (có la bàn + biết hướng tuyến) */
    canAlign: boolean;
    /** Khách đang quay mặt đúng hướng mũi tên: lấy độ lệch la bàn – tuyến làm độ bù. Trả về độ bù mới. */
    alignHeading(): number | null;
    resetHeading(): void;
    /** "pf" khi định vị nâng cao đang chạy (cảm biến thật hoặc mô phỏng) */
    positioning: "basic" | "pf";
    /** Ước lượng của bộ lọc hạt (định vị nâng cao) */
    estimate: PositionEstimate | null;
    /** Các giả thuyết để vẽ khi bật "Hiện các giả thuyết" */
    particles: LatLng[] | null;
    /** Bộ lọc cho rằng khách đã đi khác tuyến (rẽ nhầm) và chưa đủ chắc để tự lập lại tuyến */
    offRoute: boolean;
}

const SIM_SPEED = 1.3; // m/s
const DEFAULT_STEP = 0.7;
// Mô phỏng định vị nâng cao: "người" có bước Weinberg K 0,5 (≈0,62 m, ngắn hơn giả định 0,7 m) và con quay lệch 40°
const SIM_K = 0.5;
const SIM_GYRO_OFFSET = 40;
const SIM_STEP_MS = 480;

/** Bán kính sai số (m) khi đặt lại bộ lọc theo nguồn của mốc */
function anchorSigma(source: string, accuracy?: number, previous?: number): number {
    if (source === "qr") return 1.5;
    if (source === "gps") return Math.max(3, accuracy ?? 8);
    if (source === "pdr") return Math.max(2, previous ?? 4);
    if (source === "pick") return 4;
    return 3; // "place": đang đứng ở một địa điểm ("Đã xong bước này", bắt đầu từ địa điểm)
}

const gaussian = () => Math.sqrt(-2 * Math.log(Math.max(Math.random(), 1e-12))) * Math.cos(2 * Math.PI * Math.random());

export function useTripEngine(trip: Trip): TripEngine {
    const { advance, gpsUpdate, pdrUpdate, model, slug, position } = useVenue();
    const settings = useSettings();
    const permission = useSensorPermission();
    const [simulating, setSimulating] = useState(false);
    const [steps, setSteps] = useState(0);
    const view = useMemo(() => viewTrip(trip), [trip]);
    const { heading: compass } = useCompass(!simulating);

    const paused = trip.arrived || view.atFloorChange;
    const pfMode = settings.positioning === "pf";
    const pfSensors = pfMode && hasMotionSensors && !simulating;
    const pfSim = pfMode && simulating;
    const pfWanted = pfSensors || pfSim;

    // Tự đo độ dài bước bằng GPS ngoài trời (dùng cho cả hai cách định vị)
    const calibratorRef = useRef<StrideCalibrator | null>(null);

    // ---------- Cách cơ bản: mỗi bước cộng stepLength dọc tuyến ----------
    const onStep = useCallback(() => {
        if (paused) return;
        setSteps(s => s + 1);
        (calibratorRef.current ??= new StrideCalibrator()).addStep(Date.now(), null);
        advance(getSettings().stepLength);
    }, [advance, paused]);
    const basicStepsLive = useStepDetector(!simulating && !pfMode, onStep);

    // ---------- Định vị nâng cao: bộ lọc hạt ----------
    const walkIndex = useMemo(() => (model ? buildWalkwayIndex(model.walkways) : null), [model]);
    const filterRef = useRef<ParticleFilter | null>(null);
    const [estimate, setEstimate] = useState<PositionEstimate | null>(null);
    const [particles, setParticles] = useState<LatLng[] | null>(null);

    useEffect(() => {
        if (pfWanted && model) setLogVenue(slug, model.walkways);
    }, [pfWanted, model, slug]);

    const publish = useCallback((filter: ParticleFilter) => {
        const est = filter.estimate();
        setEstimate(est);
        setParticles(est && getSettings().showParticles ? filter.sample(est.floorId, 250) : null);
        if (!est) return est;
        logEvent({ t: performance.now(), type: "estimate", floorId: est.floorId, lat: est.lat, lng: est.lng, spread: est.spread });
        // Rẽ nhầm mà bộ lọc còn mơ hồ: không kéo chấm theo tuyến, giao diện gợi ý quét QR.
        // Đã chắc (±5 m) thì đưa vị trí vào chuyến đi: lệch xa tuyến sẽ tự lập lại tuyến từ chỗ đó.
        if (!est.offRoute || est.spread <= 5) {
            pdrUpdate({ floorId: est.floorId, lat: est.lat, lng: est.lng, source: "pdr", accuracy: est.spread, label: "Vị trí ước lượng" });
        }
        return est;
    }, [pdrUpdate]);

    const learn = useCallback((est: PositionEstimate | null) => {
        // Học bước chân: K đã hội tụ thì lưu để lần sau bắt đầu chính xác hơn
        if (est && est.steps % 25 === 0 && est.kSpread < 0.06) updateSettings({ weinbergK: Math.round(est.k * 1000) / 1000 });
    }, []);

    const onPdrStep = useCallback((s: PdrStep) => {
        if (paused) return;
        setSteps(n => n + 1);
        (calibratorRef.current ??= new StrideCalibrator()).addStep(Date.now(), s.amplitude);
        const filter = filterRef.current;
        // Máy không có con quay (không có DeviceOrientation): đi như cách cơ bản
        if (!filter || s.heading == null) {
            advance(getSettings().stepLength);
            return;
        }
        // Hướng la bàn tuyệt đối (một số máy Android) nhiễu hơn trong nhà: nới nhiễu hướng
        filter.step(s, s.heading, s.absolute ? 12 : undefined);
        learn(publish(filter));
    }, [paused, advance, publish, learn]);
    const onPostureChange = useCallback(() => filterRef.current?.loosen(), []);
    const pdr = usePdrSensors(pfSensors, onPdrStep, onPostureChange);
    const pfLive = (pfSensors && pdr.active) || pfSim;
    const stepsLive = pfSensors ? pdr.active : basicStepsLive;

    // GPS chỉ bật trên tầng ngoài trời (không có bản vẽ); trong nhà nó sai vài chục mét
    const legFloor = trip.route.legs[trip.activeLeg]?.floorId;
    const outdoor = legFloor != null && isOutdoorFloor(model?.floorsById.get(legFloor));
    const gps = useGps(outdoor && !simulating && !trip.arrived);
    const gpsLive = gps != null && gps.accuracy <= GPS_USABLE_ACCURACY;
    useEffect(() => {
        if (!gps || legFloor == null) return;
        // Tự đo độ dài bước: đoạn thẳng, đều nhịp, GPS tốt (≤ 10 m)
        const result = (calibratorRef.current ??= new StrideCalibrator()).addFix({ lat: gps.lat, lng: gps.lng, accuracy: gps.accuracy, t: Date.now() });
        if (result) {
            updateSettings(s => {
                const merged = mergeStride(s.strideCalibration, result);
                return { strideCalibration: merged, stepLength: Math.round(merged.stepLength * 100) / 100, weinbergK: merged.k ?? s.weinbergK };
            });
        }
        if (gps.accuracy > GPS_USABLE_ACCURACY || paused) return;
        const filter = filterRef.current;
        if (pfWanted && filter?.isStarted) {
            // định vị nâng cao: GPS là một mốc của bộ lọc
            logEvent({ t: performance.now(), type: "gps", floorId: legFloor, lat: gps.lat, lng: gps.lng, accuracy: gps.accuracy });
            filter.observe({ floorId: legFloor, lat: gps.lat, lng: gps.lng }, Math.max(3, gps.accuracy));
            publish(filter);
            return;
        }
        gpsUpdate({ floorId: legFloor, lat: gps.lat, lng: gps.lng, source: "gps", accuracy: gps.accuracy });
    }, [gps, paused, legFloor, gpsUpdate, pfWanted, publish]);

    // Mô phỏng đi bộ (máy tính / trình diễn): cách cơ bản tiến đều SIM_SPEED m/s
    useEffect(() => {
        if (!simulating || pfMode || paused) return undefined;
        const timer = window.setInterval(() => advance(SIM_SPEED / 2), 500);
        return () => window.clearInterval(timer);
    }, [simulating, pfMode, paused, advance]);

    // Mô phỏng định vị nâng cao: một "người thật" đi đúng tuyến (simTruth = mét dọc tuyến),
    // cảm biến giả có nhiễu đưa vào bộ lọc; chấm trên bản đồ là kết quả của bộ lọc, không phải người thật.
    const simTruth = useRef(0);
    const tripRef = useRef(trip);
    useEffect(() => {
        tripRef.current = trip;
    }, [trip]);
    useEffect(() => {
        if (!pfSim || paused) return undefined;
        const timer = window.setInterval(() => {
            const t = tripRef.current;
            const filter = filterRef.current;
            const leg = t.route.legs[t.activeLeg];
            if (!filter || !leg) return;
            const legEnd = legStart(t.route, t.activeLeg) + leg.distance;
            const amplitude = 2.4 * (1 + 0.1 * gaussian());
            const here = pointAt(t.route, simTruth.current);
            const ahead = pointAt(t.route, Math.min(legEnd, simTruth.current + 1.5));
            if (!here || !ahead || simTruth.current >= legEnd) return; // "người thật" đã tới chân thang / nơi đến
            const trueBearing = here.lat === ahead.lat && here.lng === ahead.lng ? 0 : bearing(here, ahead);
            simTruth.current = Math.min(legEnd, simTruth.current + weinbergLength(SIM_K, amplitude));
            setSteps(n => n + 1);
            filter.step({ amplitude }, trueBearing - SIM_GYRO_OFFSET + 4 * gaussian());
            learn(publish(filter));
        }, SIM_STEP_MS);
        return () => window.clearInterval(timer);
    }, [pfSim, paused, publish, learn]);

    const routeBearing = useMemo(() => {
        const here = view.here;
        const ahead = pointAt(trip.route, trip.progress + 6);
        if (!here || !ahead || ahead.floorId !== here.floorId) return null;
        const b = bearing(here, ahead);
        return Number.isFinite(b) && (here.lat !== ahead.lat || here.lng !== ahead.lng) ? b : null;
    }, [view.here, trip.route, trip.progress]);

    // La bàn thật lệch so với bản vẽ (bản vẽ đặt sai hướng, nhiễu từ trong nhà): cộng độ bù khách đã căn
    const headingOffset = settings.headingOffsets?.[slug] ?? 0;
    const heading = simulating ? routeBearing : compass == null ? null : (compass + headingOffset + 360) % 360;
    const canAlign = !simulating && compass != null && routeBearing != null;

    // Hướng ban đầu cho bộ lọc: la bàn nếu có (±40°), không thì giả định khách nhìn theo tuyến (±60°)
    const priorRef = useRef<HeadingPrior | null>(null);
    useEffect(() => {
        priorRef.current = heading != null && !simulating
            ? { absolute: heading, spread: 40 }
            : routeBearing != null ? { absolute: routeBearing, spread: 60 } : null;
    }, [heading, routeBearing, simulating]);

    // Đặt lại bộ lọc ở mỗi mốc: bắt đầu chuyến, quét QR / chọn vị trí (position đổi), lập lại tuyến, đổi tầng xong,
    // bật / tắt mô phỏng. Những gì đã học (bước chân, độ lệch hướng) được giữ qua các lần đặt lại.
    const anchorKey = `${trip.startedAt}|${position?.at ?? 0}|${trip.rerouted}|${trip.activeLeg}|${pfSim}`;
    useEffect(() => {
        if (!pfWanted || !walkIndex) {
            filterRef.current = null;
            return;
        }
        let filter = filterRef.current;
        if (!filter) {
            const s = getSettings();
            const calibrated = Math.abs(s.stepLength - DEFAULT_STEP) > 0.005;
            filter = new ParticleFilter(walkIndex, {
                seed: Date.now() % 1_000_000, learnedK: s.weinbergK, stepLength: { mean: s.stepLength, spread: calibrated ? 0.08 : 0.2 }
            });
            filterRef.current = filter;
        }
        const previous = filter.estimate()?.spread;
        filter.setRoute(trip.route.legs);
        const leg = trip.route.legs[trip.activeLeg];
        // Mốc vừa đặt (QR, chọn trên bản đồ, đang ở địa điểm) cùng tầng: dùng chính chỗ đó; không thì chỗ hiện tại trên tuyến
        const fix = position && leg && position.floorId === leg.floorId && (position.at ?? 0) >= trip.startedAt - 5000 ? position : null;
        const here = fix ?? pointAt(trip.route, trip.progress);
        if (!here) return;
        const source = trip.activeLeg > 0 && !fix ? "floor" : fix?.source ?? trip.lastFixSource;
        const sigma = source === "floor" ? 3 : anchorSigma(source, fix?.accuracy, previous);
        const prior = pfSim ? (routeBearing != null ? { absolute: routeBearing, spread: 60 } : null) : priorRef.current;
        logEvent({
            t: performance.now(), type: "route",
            legs: trip.route.legs.map(l => ({ floorId: l.floorId, points: l.points.map(p => [p.lat, p.lng] as [number, number]) }))
        });
        logEvent({ t: performance.now(), type: "anchor", source, floorId: here.floorId, lat: here.lat, lng: here.lng, sigma, prior });
        filter.reset({ floorId: here.floorId, lat: here.lat, lng: here.lng }, sigma, prior);
        simTruth.current = trip.progress;
        const est = filter.estimate();
        setEstimate(est);
        setParticles(est && getSettings().showParticles ? filter.sample(est.floorId, 250) : null);
        // anchorKey gói đủ các thay đổi cần đặt lại; trip / position đổi mỗi bước nên không đưa vào
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [anchorKey, pfWanted, walkIndex]);

    // Màn hình tắt / chuyển tab: trình duyệt ngừng gửi cảm biến, không biết đã đi bao xa -> nới rộng giả thuyết
    useEffect(() => {
        if (!pfSensors) return undefined;
        let hiddenAt: number | null = null;
        const onVisibility = () => {
            if (document.visibilityState === "hidden") {
                hiddenAt = Date.now();
            } else if (hiddenAt != null) {
                const seconds = (Date.now() - hiddenAt) / 1000;
                filterRef.current?.diffuse(Math.min(15, 1 + seconds * 0.6));
                hiddenAt = null;
            }
        };
        document.addEventListener("visibilitychange", onVisibility);
        return () => document.removeEventListener("visibilitychange", onVisibility);
    }, [pfSensors]);

    // Rời màn hình: lưu bước chân đã học nếu đã hội tụ (mô phỏng thì không, đó không phải bước chân của khách)
    useEffect(() => {
        if (!pfSensors) return undefined;
        return () => {
            const est = filterRef.current?.estimate();
            if (est && est.steps >= 20 && est.kSpread < 0.08) updateSettings({ weinbergK: Math.round(est.k * 1000) / 1000 });
        };
    }, [pfSensors]);

    useWakeLock(!simulating && !trip.arrived);

    // Báo khi sang bước mới
    const lastAnnounced = useRef<number | null>(null);
    const message = view.atFloorChange ? view.step?.title : trip.arrived ? `Đã đến ${trip.to.name}` : view.next ? view.next.title : null;
    useEffect(() => {
        const key = trip.arrived ? -1 : view.atFloorChange ? 1000 + view.stepIndex : view.stepIndex;
        if (lastAnnounced.current === key) return;
        const first = lastAnnounced.current == null;
        lastAnnounced.current = key;
        if (first) return;
        if (settings.vibrate) vibrate(trip.arrived ? [80, 60, 80, 60, 200] : [120, 60, 120]);
        if (settings.voice && message) speak(message);
    }, [view.stepIndex, view.atFloorChange, trip.arrived, message, settings.vibrate, settings.voice]);

    const pfEstimate = pfLive ? estimate : null;
    const offRoute = Boolean(pfEstimate?.offRoute && pfEstimate.spread > 5);
    const uncertainty = pfEstimate
        ? Math.max(1.5, pfEstimate.spread)
        : gpsLive ? Math.max(3, gps.accuracy) : positionUncertainty(trip.metersSinceFix, trip.lastFixSource);
    return {
        trip, view, heading, routeBearing, compassLive: compass != null && !simulating, stepsLive, gpsLive, simulating, setSimulating,
        needPermission: needsSensorPermission && permission !== "granted",
        enableSensors: async () => {
            await requestSensorPermission();
        },
        uncertainty,
        lost: (!simulating || pfSim) && (offRoute || uncertainty > LOST_THRESHOLD_METERS + 6),
        steps,
        headingOffset,
        canAlign,
        alignHeading: () => {
            if (compass == null || routeBearing == null) return null;
            const offset = Math.round(angleDiff(routeBearing, compass));
            updateSettings(s => ({ headingOffsets: { ...s.headingOffsets, [slug]: offset } }));
            return offset;
        },
        resetHeading: () => updateSettings(s => {
            const next = { ...s.headingOffsets };
            delete next[slug];
            return { headingOffsets: next };
        }),
        positioning: pfLive ? "pf" : "basic",
        estimate: pfEstimate,
        particles: pfLive ? particles : null,
        offRoute
    };
}

export const canSimulateByDefault = !hasMotionSensors;
