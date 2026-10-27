import type { VenueModel } from "./venueModel";
import type { WalkwayNodeDto } from "./types";

// Mã QR định vị = id một nút lối đi (ví dụ "T1-1-17"), in kèm dưới mã để gõ tay khi camera hỏng.
// Nội dung mã có thể là:
//   https://<website>/q/<slug>/<mã>   (khuyến nghị: quét bằng app camera là mở thẳng bản đồ)
//   <slug>:<mã>
//   <mã>
export interface QrPayload {
    slug: string | null;
    code: string;
}

export function parseQrPayload(text: string): QrPayload | null {
    const value = (text || "").trim();
    if (!value) return null;
    const url = value.match(/^https?:\/\/[^/]+(\/[^?#]*)/i);
    if (url?.[1]) {
        const match = url[1].match(/\/q\/([a-z0-9-]+)\/([^/]+)\/?$/i);
        if (match?.[1] && match[2]) return { slug: match[1], code: decodeURIComponent(match[2]) };
    }
    const pair = value.match(/^([a-z0-9-]+):(.+)$/i);
    if (pair?.[1] && pair[2]) return { slug: pair[1], code: pair[2] };
    return { slug: null, code: value };
}

/** Tìm nút theo mã, không phân biệt hoa/thường, bỏ khoảng trắng */
export function findNodeByCode(model: VenueModel, code: string): WalkwayNodeDto | null {
    const exact = model.nodesById.get(code);
    if (exact) return exact;
    const wanted = code.replace(/\s+/g, "").toUpperCase();
    if (!wanted) return null;
    return model.walkways.nodes.find(n => n.id.toUpperCase() === wanted) ?? null;
}

export function qrUrl(origin: string, slug: string, code: string): string {
    return `${origin.replace(/\/+$/, "")}/q/${slug}/${encodeURIComponent(code)}`;
}
