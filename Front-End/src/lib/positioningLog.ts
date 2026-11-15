import { useSyncExternalStore } from "react";
import type { PositioningLog, PositioningLogEvent, WalkwayNetworkDto } from "@indoor-map/core";
import { addMonitoringBreadcrumb } from "./monitoring";
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

/** Tải nhật ký ra tệp JSON */
export function downloadLog(): void {
    const s = getSettings();
    const log: PositioningLog = {
        version: 1, venue, startedAt, device: navigator.userAgent,
        settings: { stepLength: s.stepLength, weinbergK: s.weinbergK }, walkways, events
    };
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

// ---------- Sự cố định vị: luôn đếm (không cần bật ghi nhật ký), xem trong Cài đặt ----------
// jump = chấm nhảy xa hơn quãng đi được mà không do QR; correction = QR / chọn trên bản đồ sửa vị trí (khoảng sửa = sai số);
// outlier = số đo GPS bị loại vì nhảy bất thường; stepReject = "bước" bị bỏ vì tới quá sớm so với nhịp.

export type IssueKind = "jump" | "correction" | "outlier" | "stepReject";

export interface IssueSummary {
    jump: number;
    correction: number;
    outlier: number;
    stepReject: number;
    /** Khoảng sửa trung bình / lớn nhất khi quét QR (m): sai số thật của vị trí ngay trước đó */
    correctionMean: number | null;
    correctionMax: number | null;
    /** Vài lần nhảy gần nhất: nguyên nhân và khoảng nhảy (m) */
    recent: { cause: string; meters: number; at: number }[];
}

const EMPTY: IssueSummary = { jump: 0, correction: 0, outlier: 0, stepReject: 0, correctionMean: null, correctionMax: null, recent: [] };
let issues: IssueSummary = EMPTY;
const issueListeners = new Set<() => void>();

export function recordIssue(kind: IssueKind, detail?: { cause: string; meters: number }): void {
    const next = { ...issues, [kind]: issues[kind] + 1 };
    if (kind === "correction" && detail) {
        next.correctionMean = ((issues.correctionMean ?? 0) * issues.correction + detail.meters) / next.correction;
        next.correctionMax = Math.max(issues.correctionMax ?? 0, detail.meters);
    }
    if ((kind === "jump" || kind === "correction") && detail) {
        next.recent = [{ ...detail, at: Date.now() }, ...issues.recent].slice(0, 5);
    }
    issues = next;
    issueListeners.forEach(fn => fn());
    // đi kèm lỗi xảy ra sau đó (nếu có), để biết trước lỗi định vị đã gặp gì
    addMonitoringBreadcrumb("positioning", kind, detail);
}

export function clearIssues(): void {
    issues = EMPTY;
    issueListeners.forEach(fn => fn());
}

export function useIssues(): IssueSummary {
    return useSyncExternalStore(
        fn => {
            issueListeners.add(fn);
            return () => issueListeners.delete(fn);
        },
        () => issues
    );
}
