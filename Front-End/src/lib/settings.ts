import { useSyncExternalStore } from "react";

// Cài đặt của khách, lưu trong trình duyệt. Mọi đọc/ghi bọc try/catch: chế độ ẩn danh hoặc trình duyệt chặn lưu trữ
// thì vẫn chạy với giá trị mặc định.
export interface Settings {
    /** Chỉ đổi tầng bằng thang máy (xe lăn, xe đẩy) */
    avoidStairs: boolean;
    vibrate: boolean;
    voice: boolean;
    largeText: boolean;
    /** Hỏi quét QR trước khi bắt đầu đi */
    preferQr: boolean;
    /** Mét mỗi bước chân */
    stepLength: number;
    /** "slug:id" địa điểm đã xem gần đây */
    recent: string[];
}

const KEY = "indoor-map.settings.v2";
const DEFAULTS: Settings = { avoidStairs: false, vibrate: true, voice: false, largeText: false, preferQr: true, stepLength: 0.7, recent: [] };

function read(): Settings {
    try {
        return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) || "{}") as Partial<Settings>) };
    } catch {
        return { ...DEFAULTS };
    }
}

let state = read();
const listeners = new Set<() => void>();
const applyRootClasses = () => document.documentElement.classList.toggle("large-text", state.largeText);
applyRootClasses();

export function updateSettings(patch: Partial<Settings> | ((s: Settings) => Partial<Settings>)): void {
    state = { ...state, ...(typeof patch === "function" ? patch(state) : patch) };
    try {
        localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
        // không lưu được thì chỉ giữ trong phiên này
    }
    applyRootClasses();
    listeners.forEach(fn => fn());
}

export const getSettings = (): Settings => state;

export function useSettings(): Settings {
    return useSyncExternalStore(
        fn => {
            listeners.add(fn);
            return () => listeners.delete(fn);
        },
        () => state
    );
}

export function pushRecent(slug: string, id: number): void {
    const key = `${slug}:${id}`;
    updateSettings(s => ({ recent: [key, ...s.recent.filter(r => r !== key)].slice(0, 8) }));
}
