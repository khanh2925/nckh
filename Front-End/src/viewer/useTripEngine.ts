import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GPS_USABLE_ACCURACY, LOST_THRESHOLD_METERS, angleDiff, isOutdoorFloor, bearing, pointAt, positionUncertainty, viewTrip, type Trip, type TripView } from "@indoor-map/core";
import { getSettings, updateSettings, useSettings } from "../lib/settings";
import { hasMotionSensors, needsSensorPermission, requestSensorPermission, speak, useCompass, useGps, useSensorPermission, useStepDetector, vibrate } from "../lib/sensors";
import { useVenue } from "./VenueContext";

// "Động cơ" của chuyến đi, dùng chung cho màn 2D và màn camera:
// - mỗi bước chân (cảm biến gia tốc) tiến thêm stepLength mét dọc tuyến
// - la bàn cho hướng nhìn; khi mô phỏng thì lấy hướng của tuyến
// - tới bước mới thì rung + đọc chỉ dẫn (nếu bật trong Cài đặt)
// - ngoài trời (khuôn viên) GPS đủ tốt thì kéo vị trí theo GPS, bước chân lấp khoảng giữa hai lần đo
// - ước lượng độ lệch vị trí, quá ngưỡng thì gợi ý quét QR căn lại
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
}

const SIM_SPEED = 1.3; // m/s

export function useTripEngine(trip: Trip): TripEngine {
    const { advance, gpsUpdate, model, slug } = useVenue();
    const settings = useSettings();
    const permission = useSensorPermission();
    const [simulating, setSimulating] = useState(false);
    const [steps, setSteps] = useState(0);
    const view = useMemo(() => viewTrip(trip), [trip]);
    const { heading: compass } = useCompass(!simulating);

    const paused = trip.arrived || view.atFloorChange;
    const onStep = useCallback(() => {
        if (paused) return;
        setSteps(s => s + 1);
        advance(getSettings().stepLength);
    }, [advance, paused]);
    const stepsLive = useStepDetector(!simulating, onStep);

    // GPS chỉ bật trên tầng ngoài trời (không có bản vẽ); trong nhà nó sai vài chục mét
    const legFloor = trip.route.legs[trip.activeLeg]?.floorId;
    const outdoor = legFloor != null && isOutdoorFloor(model?.floorsById.get(legFloor));
    const gps = useGps(outdoor && !simulating && !trip.arrived);
    const gpsLive = gps != null && gps.accuracy <= GPS_USABLE_ACCURACY;
    useEffect(() => {
        if (!gps || gps.accuracy > GPS_USABLE_ACCURACY || paused || legFloor == null) return;
        gpsUpdate({ floorId: legFloor, lat: gps.lat, lng: gps.lng, source: "gps", accuracy: gps.accuracy });
    }, [gps, paused, legFloor, gpsUpdate]);

    // Mô phỏng đi bộ (máy tính / trình diễn): tiến đều SIM_SPEED m/s
    useEffect(() => {
        if (!simulating || paused) return undefined;
        const timer = window.setInterval(() => advance(SIM_SPEED / 2), 500);
        return () => window.clearInterval(timer);
    }, [simulating, paused, advance]);

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

    const uncertainty = gpsLive ? Math.max(3, gps.accuracy) : positionUncertainty(trip.metersSinceFix, trip.lastFixSource);
    return {
        trip, view, heading, routeBearing, compassLive: compass != null && !simulating, stepsLive, gpsLive, simulating, setSimulating,
        needPermission: needsSensorPermission && permission !== "granted",
        enableSensors: async () => {
            await requestSensorPermission();
        },
        uncertainty,
        lost: !simulating && uncertainty > LOST_THRESHOLD_METERS + 6,
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
        })
    };
}

export const canSimulateByDefault = !hasMotionSensors;
