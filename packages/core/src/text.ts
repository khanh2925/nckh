import type { LocationDto } from "./types";

/** Chữ thường + bỏ dấu tiếng Việt, để "cua 09" vẫn tìm ra "Cửa 09" */
export function normalizeText(text: string | null | undefined): string {
    return (text || "")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .toLowerCase()
        .trim();
}

/** Nhãn ngắn của tầng cho ô chọn tầng: 0 -> "TR", -1 -> "H1", 2 -> "2" */
export function floorChip(level: number): string {
    if (level === 0) return "TR";
    if (level < 0) return `H${-level}`;
    return String(level);
}

export function floorWord(level: number): string {
    if (level === 0) return "Tầng trệt";
    if (level < 0) return `Tầng hầm ${-level}`;
    return `Tầng ${level}`;
}

/** Dữ liệu crawl ghi giờ mở cửa tiếng Anh: "24 Hours", "5AM-9PM", "6AM - 11:45PM" */
export function translateHours(text: string | null | undefined): string {
    if (!text) return "";
    if (/^24\s*hours?$/i.test(text.trim())) return "Mở cửa 24 giờ";
    return text
        .replace(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/gi, (_match, hour: string, minute = "00", half: string) => {
            const value = (Number(hour) % 12) + (half.toUpperCase() === "PM" ? 12 : 0);
            return `${String(value).padStart(2, "0")}:${minute}`;
        })
        .replace(/\s*-\s*/g, " – ");
}

export function formatMeters(meters: number | null | undefined): string {
    if (meters == null || Number.isNaN(meters)) return "";
    if (meters >= 1000) return `${(meters / 1000).toFixed(1).replace(".", ",")} km`;
    return `${Math.max(0, Math.round(meters))} m`;
}

export function formatMinutes(seconds: number): number {
    return Math.max(1, Math.round(seconds / 60));
}

/** Biển ngắn của một địa điểm: cửa ra "Cửa 12" -> "12", nhà vệ sinh -> "WC"; còn lại null (dùng icon) */
export function plateText(location: Pick<LocationDto, "type" | "name">): string | null {
    if (location.type === "gate") {
        const match = location.name.match(/(\d+[A-Z]?(?:\s*-\s*\d+[A-Z]?)?)/);
        if (match?.[1]) return match[1].replace(/\s+/g, "");
    }
    if (location.type === "restroom") return "WC";
    return null;
}
