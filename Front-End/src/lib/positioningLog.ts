import { useSyncExternalStore } from "react";
import type { PositioningLog, PositioningLogEvent, WalkwayNetworkDto } from "@indoor-map/core";
import { getSettings } from "./settings";

// Nhật ký cảm biến của định vị nâng cao (Cài đặt -> Ghi nhật ký cảm biến). Chỉ giữ trong bộ nhớ của trang;
// đi xong thì "Tải nhật ký" ra tệp JSON, rồi chạy lại trong packages/core (PF_LOG=... npx vitest run test/positioning.eval.test.ts)
// để đo sai số tại các mốc QR và tinh chỉnh tham số mà không phải đi lại.

const MAX_EVENTS = 400_000; // ~ 40 phút gia tốc + hướng ở 60 Hz
let events: PositioningLogEvent[] = [];
let venue = "";
let walkways: WalkwayNetworkDto | undefined;
let startedAt = "";
const listeners = new Set<() => void>();
let lastNotify = 0;

function notify(force = false): void {
    // đừng báo React 60 lần mỗi giây
    const now = Date.now();
    if (!force && now - lastNotify < 1000) return;
    lastNotify = now;
    listeners.forEach(fn => fn());
}

export const isRecording = (): boolean => getSettings().recordLog;

/** Gắn địa điểm đang đi (gọi khi bắt đầu dẫn đường) */
export function setLogVenue(slug: string, network: WalkwayNetworkDto): void {
    if (venue !== slug) {
        events = [];
        startedAt = "";
    }
    venue = slug;
    walkways = network;
}

export function logEvent(event: PositioningLogEvent): void {
    if (!getSettings().recordLog || events.length >= MAX_EVENTS) return;
    if (!startedAt) startedAt = new Date().toISOString();
    events.push(event);
    notify();
}

export function clearLog(): void {
    events = [];
    startedAt = "";
    uploadedCount = 0;
    notify(true);
}

export function useLogSize(): number {
    return useSyncExternalStore(
        fn => {
            listeners.add(fn);
            return () => listeners.delete(fn);
        },
        () => events.length
    );
}

function currentLog(): PositioningLog {
    const s = getSettings();
    return {
        version: 1, venue, startedAt, device: navigator.userAgent,
        settings: { stepLength: s.stepLength, weinbergK: s.weinbergK }, walkways, events
    };
}

// Gửi nhật ký về máy đang chạy "npm run dev" (vite.config.ts lưu vào Front-End/.field-logs/), để người phân tích
// đọc ngay mà khách không phải tải tệp rồi gửi tay. Mỗi lần ghi là một tệp, gửi lại thì ghi đè tệp đó.
// Bản build tĩnh không có đường /__field-log: báo không gửi được, vẫn còn nút Tải về.
let uploadedCount = 0;
let uploading: Promise<boolean> | null = null;
let lastUpload: { at: number; ok: boolean } | null = null;

export function uploadLog(): Promise<boolean> {
    if (!events.length) return Promise.resolve(false);
    if (uploading) return uploading;
    const count = events.length;
    const id = `${(startedAt || new Date().toISOString()).slice(0, 19).replace(/[:T]/g, "-")}-${venue || "dia-diem"}`;
    uploading = fetch(`/__field-log?id=${encodeURIComponent(id)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(currentLog()) })
        .then(r => r.ok)
        .catch(() => false)
        .then(ok => {
            if (ok) uploadedCount = count;
            lastUpload = { at: Date.now(), ok };
            uploading = null;
            notify(true);
            return ok;
        });
    return uploading;
}

/** Lần gửi gần nhất (để hiện "Đã gửi lúc …") */
export const lastLogUpload = (): { at: number; ok: boolean } | null => lastUpload;

// Đang ghi thì cứ 30 giây gửi phần mới một lần
setInterval(() => {
    if (getSettings().recordLog && events.length > uploadedCount + 50) void uploadLog();
}, 30_000);

/** Tải nhật ký ra tệp JSON */
export function downloadLog(): void {
    const log = currentLog();
    const blob = new Blob([JSON.stringify(log)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nhat-ky-dinh-vi-${venue || "dia-diem"}-${(startedAt || new Date().toISOString()).slice(0, 16).replace(/[:T]/g, "-")}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
