import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LOST_THRESHOLD_METERS, bearing, pointAt, positionUncertainty, viewTrip, type Trip, type TripView } from "@indoor-map/core";
import { getSettings, useSettings } from "../lib/settings";
import { hasMotionSensors, needsSensorPermission, requestSensorPermission, speak, useCompass, useSensorPermission, useStepDetector, vibrate } from "../lib/sensors";
import { useVenue } from "./VenueContext";

// "Động cơ" của chuyến đi, dùng chung cho màn 2D và màn camera:
// - mỗi bước chân (cảm biến gia tốc) tiến thêm stepLength mét dọc tuyến
// - la bàn cho hướng nhìn; khi mô phỏng thì lấy hướng của tuyến
// - tới bước mới thì rung + đọc chỉ dẫn (nếu bật trong Cài đặt)
// - ước lượng độ lệch vị trí, quá ngưỡng thì gợi ý quét QR căn lại
export interface TripEngine {
    trip: Trip;
    view: TripView;
    heading: number | null;
    /** Hướng của đoạn tuyến phía trước (độ từ Bắc) */
    routeBearing: number | null;
    compassLive: boolean;
    stepsLive: boolean;
    simulating: boolean;
    setSimulating(on: boolean): void;
    needPermission: boolean;
    enableSensors(): Promise<void>;
    uncertainty: number;
    lost: boolean;
    steps: number;
}

const SIM_SPEED = 1.3; // m/s

export function useTripEngine(trip: Trip): TripEngine {
    const { advance } = useVenue();
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

    const heading = simulating ? routeBearing : compass;

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

    const uncertainty = positionUncertainty(trip.metersSinceFix, trip.lastFixSource);
    return {
        trip, view, heading, routeBearing, compassLive: compass != null && !simulating, stepsLive, simulating, setSimulating,
        needPermission: needsSensorPermission && permission !== "granted",
        enableSensors: async () => {
            await requestSensorPermission();
        },
        uncertainty,
        lost: !simulating && uncertainty > LOST_THRESHOLD_METERS + 6,
        steps
    };
}

export const canSimulateByDefault = !hasMotionSensors;
