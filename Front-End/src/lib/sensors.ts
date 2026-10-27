import { useEffect, useRef, useState } from "react";
import { HeadingFilter, StepDetector } from "@indoor-map/core";

// Cảm biến trên trình duyệt điện thoại. Thuật toán (đếm bước, làm mượt la bàn) nằm ở @indoor-map/core;
// tệp này chỉ đọc sự kiện của trình duyệt. App React Native sau này đọc expo-sensors rồi dùng cùng thuật toán.
// - La bàn: Android "deviceorientationabsolute", iOS webkitCompassHeading. Cần HTTPS.
// - iOS 13+ bắt buộc xin quyền bằng một cú bấm: gọi requestSensorPermission() trong onClick.

type PermissionFn = () => Promise<"granted" | "denied">;
const orientationPermission = (window.DeviceOrientationEvent as unknown as { requestPermission?: PermissionFn } | undefined)?.requestPermission;
const motionPermission = (window.DeviceMotionEvent as unknown as { requestPermission?: PermissionFn } | undefined)?.requestPermission;

export const needsSensorPermission = typeof orientationPermission === "function";
export const hasMotionSensors = "DeviceMotionEvent" in window && ("ontouchstart" in window || navigator.maxTouchPoints > 0);

type PermissionState = "unknown" | "granted" | "denied";
let permission: PermissionState = needsSensorPermission ? "unknown" : "granted";
const permissionListeners = new Set<(p: PermissionState) => void>();

export async function requestSensorPermission(): Promise<PermissionState> {
    if (!needsSensorPermission) return "granted";
    try {
        const a = await orientationPermission!.call(window.DeviceOrientationEvent);
        const b = typeof motionPermission === "function" ? await motionPermission.call(window.DeviceMotionEvent) : "granted";
        permission = a === "granted" && b === "granted" ? "granted" : "denied";
    } catch {
        permission = "denied";
    }
    permissionListeners.forEach(fn => fn(permission));
    return permission;
}

export function useSensorPermission(): PermissionState {
    const [value, setValue] = useState(permission);
    useEffect(() => {
        permissionListeners.add(setValue);
        return () => {
            permissionListeners.delete(setValue);
        };
    }, []);
    return value;
}

const screenAngle = () => window.screen?.orientation?.angle ?? 0;

/** Hướng điện thoại (0 = Bắc, theo chiều kim đồng hồ); null khi chưa có số liệu */
export function useCompass(enabled = true): { heading: number | null; accuracy: number | null } {
    const granted = useSensorPermission() === "granted";
    const [heading, setHeading] = useState<number | null>(null);
    const [accuracy, setAccuracy] = useState<number | null>(null);

    useEffect(() => {
        if (!enabled || !granted) return undefined;
        const filter = new HeadingFilter();
        let gotAbsolute = false;
        let frame = 0;
        const apply = (value: number, acc: number | null) => {
            const smoothed = filter.push(value + screenAngle());
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                setHeading(Math.round(smoothed));
                if (acc != null) setAccuracy(acc);
            });
        };
        const onAbsolute = (e: DeviceOrientationEvent) => {
            if (e.alpha == null) return;
            gotAbsolute = true;
            apply(360 - e.alpha, null);
        };
        const onOrientation = (e: DeviceOrientationEvent) => {
            if (typeof e.webkitCompassHeading === "number") apply(e.webkitCompassHeading, e.webkitCompassAccuracy ?? null);
            else if (!gotAbsolute && e.absolute && e.alpha != null) apply(360 - e.alpha, null);
        };
        window.addEventListener("deviceorientationabsolute", onAbsolute as EventListener);
        window.addEventListener("deviceorientation", onOrientation);
        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener("deviceorientationabsolute", onAbsolute as EventListener);
            window.removeEventListener("deviceorientation", onOrientation);
        };
    }, [enabled, granted]);

    return { heading, accuracy };
}

/** Gọi onStep() mỗi bước chân. Trả về true khi đã nhận được số liệu gia tốc. */
export function useStepDetector(enabled: boolean, onStep: () => void): boolean {
    const granted = useSensorPermission() === "granted";
    const callback = useRef(onStep);
    useEffect(() => {
        callback.current = onStep;
    }, [onStep]);
    const [active, setActive] = useState(false);

    useEffect(() => {
        if (!enabled || !granted || !("DeviceMotionEvent" in window)) return undefined;
        const detector = new StepDetector();
        let seen = false;
        const onMotion = (e: DeviceMotionEvent) => {
            const g = e.accelerationIncludingGravity;
            if (!g || g.x == null || g.y == null || g.z == null) return;
            if (!seen) {
                seen = true;
                setActive(true);
            }
            if (detector.push(g.x, g.y, g.z, e.timeStamp || performance.now())) callback.current();
        };
        window.addEventListener("devicemotion", onMotion);
        return () => {
            window.removeEventListener("devicemotion", onMotion);
            setActive(false);
        };
    }, [enabled, granted]);
    return active;
}

export function vibrate(pattern: number | number[]): void {
    try {
        navigator.vibrate?.(pattern);
    } catch {
        // không hỗ trợ
    }
}

export function speak(text: string): void {
    try {
        if (!("speechSynthesis" in window)) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "vi-VN";
        utterance.rate = 1.05;
        window.speechSynthesis.speak(utterance);
    } catch {
        // không hỗ trợ
    }
}
