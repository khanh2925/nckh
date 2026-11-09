import { useCallback, useSyncExternalStore } from "react";
import type { JourneyAnswers, JourneyDto } from "@indoor-map/core";
import type { LucideName } from "../design/lucide";
import { LUCIDE } from "../design/lucide";

// Tiến độ khách đang đi theo một quy trình (BR-34): lưu trên trình duyệt, tải lại trang thì đi tiếp.
// Mỗi địa điểm một phiên; chuyến đi từng bước vẫn là Trip của VenueContext, ở đây chỉ nhớ đang ở bước nào.
export interface JourneyRun {
    journeyId: number;
    answers: JourneyAnswers;
    /** Đã trả lời xong câu hỏi đầu */
    answered: boolean;
    /** Nơi khách tự chọn cho bước (chỉ số bước -> id điểm) */
    pinned: Record<number, number>;
    /** Bước đang đi tới (chỉ số trong journey.steps); null = chưa bắt đầu */
    current: number | null;
    /** Điểm đích của bước đang đi, để màn "Đã tới" biết đây là một bước của quy trình */
    targetId: number | null;
    done: number[];
    skipped: number[];
    startedAt?: number;
    finishedAt?: number;
    /** Quãng đã đi qua các bước (m) */
    meters: number;
}

const key = (slug: string) => `journey:${slug}`;
const listeners = new Set<() => void>();
const cache = new Map<string, { raw: string | null; value: JourneyRun | null }>();

function read(slug: string): JourneyRun | null {
    let raw: string | null = null;
    try {
        raw = localStorage.getItem(key(slug));
    } catch {
        raw = null;
    }
    const hit = cache.get(slug);
    if (hit && hit.raw === raw) return hit.value;
    let value: JourneyRun | null = null;
    try {
        value = raw ? (JSON.parse(raw) as JourneyRun) : null;
    } catch {
        value = null;
    }
    cache.set(slug, { raw, value });
    return value;
}

function write(slug: string, run: JourneyRun | null): void {
    try {
        if (run) localStorage.setItem(key(slug), JSON.stringify(run));
        else localStorage.removeItem(key(slug));
    } catch {
        // trình duyệt chặn lưu: tiến độ chỉ còn trong phiên này
    }
    listeners.forEach(fn => fn());
}

const subscribe = (fn: () => void) => {
    listeners.add(fn);
    return () => {
        listeners.delete(fn);
    };
};

export function useJourneyRun(slug: string): [JourneyRun | null, (next: JourneyRun | null) => void] {
    const run = useSyncExternalStore(subscribe, () => read(slug));
    const set = useCallback((next: JourneyRun | null) => write(slug, next), [slug]);
    return [run, set];
}

export function newRun(journeyId: number, answers: JourneyAnswers = {}): JourneyRun {
    return { journeyId, answers, answered: true, pinned: {}, current: null, targetId: null, done: [], skipped: [], meters: 0 };
}

/** Biểu tượng quy trình (chủ địa điểm chọn tên icon Lucide); không có thì dùng biểu tượng chung */
export function journeyIcon(journey: Pick<JourneyDto, "icon">): LucideName {
    return journey.icon && journey.icon in LUCIDE ? (journey.icon as LucideName) : "workflow";
}
