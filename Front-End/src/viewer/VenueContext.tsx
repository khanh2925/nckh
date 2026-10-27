import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
    advanceTrip, buildVenueModel, confirmFloorChange as confirmFloorChangeCore, fixTripPosition, planRoute as planRouteCore,
    startTrip as startTripCore, type Place, type PlannedRoute, type Position, type Trip, type VenueModel
} from "@indoor-map/core";
import { api } from "../lib/data";
import { getSettings } from "../lib/settings";

// Trạng thái một địa điểm đang xem, dùng chung cho mọi màn hình Viewer:
// - model: dữ liệu bản đồ đã lập chỉ mục
// - position: vị trí của khách (quét QR, chọn trên bản đồ, hoặc "đang ở địa điểm X")
// - trip: chuyến đi đang chỉ đường — màn 2D và màn camera dùng chung
// Logic chuyến đi là hàm thuần trong @indoor-map/core (app React Native dùng lại được).
interface VenueState {
    slug: string;
    model: VenueModel | null;
    error: Error | null;
    position: Position | null;
    setPosition(position: Position | null): void;
    trip: Trip | null;
    planRoute(from: Position, to: Place): PlannedRoute | { error: string } | null;
    startTrip(from: Position, to: Place): Trip | { error: string } | null;
    endTrip(): void;
    advance(meters: number): void;
    confirmFloorChange(): void;
    fixPosition(position: Position): void;
}

const VenueContext = createContext<VenueState | null>(null);

function readSession<T>(key: string): T | null {
    try {
        return JSON.parse(sessionStorage.getItem(key) || "null") as T | null;
    } catch {
        return null;
    }
}
function writeSession(key: string, value: unknown): void {
    try {
        if (value == null) sessionStorage.removeItem(key);
        else sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
        // bỏ qua
    }
}

export function VenueProvider({ slug, children }: { slug: string; children: ReactNode }) {
    const [model, setModel] = useState<VenueModel | null>(null);
    const [error, setError] = useState<Error | null>(null);
    const [position, setPositionState] = useState<Position | null>(() => readSession<Position>(`pos:${slug}`));
    const [trip, setTrip] = useState<Trip | null>(null);
    const modelRef = useRef<VenueModel | null>(null);

    // Provider được gắn key = slug nên mỗi địa điểm là một lần mount mới, không cần đặt lại state
    useEffect(() => {
        let alive = true;
        api.fetchVenueMap(slug)
            .then(bundle => {
                if (!alive) return;
                const built = buildVenueModel(bundle);
                modelRef.current = built;
                setModel(built);
                // Khôi phục chuyến đi sau khi tải lại trang
                const saved = readSession<{ toId: number; from: Position }>(`trip:${slug}`);
                const to = saved ? built.locationsById.get(saved.toId) : undefined;
                if (saved && to) {
                    const planned = planRouteCore(built, saved.from, to, { avoidStairs: getSettings().avoidStairs });
                    if (!("error" in planned)) setTrip(startTripCore(planned, saved.from, to));
                }
            })
            .catch((err: Error) => alive && setError(err));
        return () => {
            alive = false;
        };
    }, [slug]);

    const setPosition = useCallback((next: Position | null) => {
        const value = next ? { ...next, at: Date.now() } : null;
        setPositionState(value);
        writeSession(`pos:${slug}`, value);
    }, [slug]);

    const planRoute = useCallback((from: Position, to: Place) => {
        if (!model) return null;
        return planRouteCore(model, from, to, { avoidStairs: getSettings().avoidStairs });
    }, [model]);

    const startTrip = useCallback((from: Position, to: Place) => {
        const planned = planRoute(from, to);
        if (!planned || "error" in planned) return planned;
        const value = startTripCore(planned, from, to);
        setTrip(value);
        writeSession(`trip:${slug}`, { toId: to.id, from });
        return value;
    }, [planRoute, slug]);

    const endTrip = useCallback(() => {
        setTrip(null);
        writeSession(`trip:${slug}`, null);
    }, [slug]);

    const advance = useCallback((meters: number) => setTrip(t => (t ? advanceTrip(t, meters) : t)), []);
    const confirmFloorChange = useCallback(() => setTrip(t => (t ? confirmFloorChangeCore(t) : t)), []);
    const fixPosition = useCallback((point: Position) => {
        setPosition(point);
        setTrip(t => {
            if (!t) return t;
            // chuyến đã đến nơi thì vị trí mới không thuộc chuyến đó nữa
            if (t.arrived) {
                writeSession(`trip:${slug}`, null);
                return null;
            }
            return modelRef.current ? fixTripPosition(modelRef.current, t, point, { avoidStairs: getSettings().avoidStairs }) : t;
        });
    }, [setPosition, slug]);

    const value = useMemo<VenueState>(() => ({
        slug, model, error, position, setPosition, trip, planRoute, startTrip, endTrip, advance, confirmFloorChange, fixPosition
    }), [slug, model, error, position, setPosition, trip, planRoute, startTrip, endTrip, advance, confirmFloorChange, fixPosition]);

    return <VenueContext.Provider value={value}>{children}</VenueContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useVenue(): VenueState {
    const value = useContext(VenueContext);
    if (!value) throw new Error("useVenue() phải nằm trong <VenueProvider>");
    return value;
}

/** Dùng trong các trang đã chắc chắn có model (bọc bởi VenueGate) */
// eslint-disable-next-line react-refresh/only-export-components
export function useModel(): VenueModel {
    const { model } = useVenue();
    if (!model) throw new Error("Chưa tải xong dữ liệu địa điểm");
    return model;
}
