import type { FloorProjection, PlanDto } from "@indoor-map/core";

// Chữ của tệp SVG mặt bằng -> phần tử <svg> cho L.svgOverlay.
//
// Vì sao không dùng L.imageOverlay(url)? Ảnh <img> SVG bị vẽ lại toàn bộ ở kích thước hiển thị sau mỗi lần phóng to,
// zoom sâu là hàng chục nghìn pixel nên giật. <svg> nội tuyến chỉ vẽ phần đang thấy.
//
// Bản vẽ xuất từ CorelDRAW dùng chung tên class (.fil0, .str1…), đặt nhiều bản vẽ cùng trang sẽ đè nhau:
// mỗi class/id được thêm tiền tố riêng. <script>, <foreignObject> và thuộc tính on* bị xoá
// (bản vẽ có thể do chủ địa điểm tải lên).
let counter = 0;

export function parsePlanSvg(text: string): SVGSVGElement | null {
    const prefix = `p${counter++}-`;
    const root = new DOMParser().parseFromString(text, "image/svg+xml").documentElement;
    if (!root || root.nodeName.toLowerCase() !== "svg") return null;

    root.querySelectorAll("script, foreignObject").forEach(node => node.remove());
    root.querySelectorAll("*").forEach(node => {
        [...node.attributes].forEach(attr => {
            if (/^on/i.test(attr.name) || (/href$/i.test(attr.name) && /^\s*javascript:/i.test(attr.value))) node.removeAttribute(attr.name);
        });
    });
    root.querySelectorAll("style").forEach(style => {
        style.textContent = (style.textContent || "").replace(/\.([A-Za-z_][\w-]*)/g, `.${prefix}$1`);
    });
    root.querySelectorAll("[class]").forEach(element => {
        const names = (element.getAttribute("class") || "").split(/\s+/).filter(Boolean);
        element.setAttribute("class", names.map(name => prefix + name).join(" "));
    });
    root.querySelectorAll("[id]").forEach(element => element.setAttribute("id", prefix + element.id));
    return document.importNode(root, true) as unknown as SVGSVGElement;
}

/** Đặt bản vẽ (đơn vị pixel của bản vẽ) vào khung lat/lng thẳng trục theo phép chiếu của tầng */
export function buildPlanOverlay(planSvg: SVGSVGElement, plan: PlanDto, projection: FloorProjection): SVGSVGElement {
    const ns = "http://www.w3.org/2000/svg";
    const outer = document.createElementNS(ns, "svg");
    outer.setAttribute("viewBox", projection.viewBox);
    outer.setAttribute("preserveAspectRatio", "none");
    const group = document.createElementNS(ns, "g");
    group.setAttribute("transform", projection.transform);
    planSvg.setAttribute("x", "0");
    planSvg.setAttribute("y", "0");
    planSvg.setAttribute("width", String(plan.width));
    planSvg.setAttribute("height", String(plan.height));
    planSvg.setAttribute("preserveAspectRatio", "none");
    if (!planSvg.getAttribute("viewBox")) planSvg.setAttribute("viewBox", `0 0 ${plan.width} ${plan.height}`);
    planSvg.removeAttribute("style");
    group.appendChild(planSvg);
    outer.appendChild(group);
    return outer;
}

/** Màu mặt bằng theo vai trò (Viewer: kiểu biển chỉ dẫn). Màu là chuỗi cụ thể (#hex), không dùng var(). */
export interface PlanPalette {
    /** sàn, sảnh, hành lang */
    floor: string;
    /** nét viền ngoài dày nhất (tường bao) */
    wall: string;
    /** nét viền phòng */
    edge: string;
    gate: string;
    amenity: string;
    lounge: string;
    retail: string;
    /** thang, lõi giao thông */
    core: string;
    /** khu kỹ thuật (gạch chéo) */
    service: string;
    hatch: string;
}

type PlanRole = "floor" | "gate" | "amenity" | "lounge" | "retail" | "core" | "service";

function parseColor(value: string): [number, number, number] | null {
    const v = value.trim().toLowerCase();
    if (v === "white") return [255, 255, 255];
    if (v === "black") return [0, 0, 0];
    const hex = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
    if (hex?.[1]) {
        const h = hex[1].length === 3 ? [...hex[1]].map(c => c + c).join("") : hex[1];
        return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
    }
    const rgb = v.match(/^rgb\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/);
    if (rgb?.[1] && rgb[2] && rgb[3]) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
    return null;
}

/** Đoán vai trò của một vùng theo màu gốc của bản vẽ (bảng màu InMapz/CorelDRAW: trắng = sàn, xám = kỹ thuật, xanh lá = cửa hàng…) */
function roleOf([r, g, b]: [number, number, number]): PlanRole {
    const max = Math.max(r, g, b) / 255;
    const min = Math.min(r, g, b) / 255;
    const l = (max + min) / 2;
    const d = max - min;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    if (l > 0.97) return "floor";
    if (s < 0.12) return l > 0.9 ? "gate" : "service";
    let h = 0;
    const R = r / 255, G = g / 255, B = b / 255;
    if (max === R) h = ((G - B) / d) % 6;
    else if (max === G) h = (B - R) / d + 2;
    else h = (R - G) / d + 4;
    h = (h * 60 + 360) % 360;
    if (h >= 45 && h < 165) return "retail";
    if (h >= 165 && h < 250) return s < 0.35 ? "floor" : "gate";
    if (h >= 250 && h < 300) return "lounge";
    if (h >= 15 && h < 45) return "core";
    return l > 0.8 ? "amenity" : "core";
}

let hatchCounter = 0;

/**
 * Tô lại bản vẽ (đã qua parsePlanSvg) theo bảng màu phẳng của Viewer: thay màu fill/stroke trong <style> và thuộc tính,
 * nét dày nhất thành tường than chì, khu kỹ thuật gạch chéo. Không đổi hình học, không đổi toạ độ.
 */
export function themePlanSvg(svg: SVGSVGElement, palette: PlanPalette): void {
    const ns = "http://www.w3.org/2000/svg";
    const viewBox = (svg.getAttribute("viewBox") || "").split(/[\s,]+/).map(Number);
    const width = viewBox[2] && viewBox[2] > 0 ? viewBox[2] : Number(svg.getAttribute("width")) || 1000;
    const hatchId = `plan-hatch-${hatchCounter++}`;
    const size = width * 0.014;
    const defs = document.createElementNS(ns, "defs");
    const pattern = document.createElementNS(ns, "pattern");
    pattern.setAttribute("id", hatchId);
    pattern.setAttribute("patternUnits", "userSpaceOnUse");
    pattern.setAttribute("width", String(size));
    pattern.setAttribute("height", String(size));
    pattern.setAttribute("patternTransform", "rotate(45)");
    const bg = document.createElementNS(ns, "rect");
    bg.setAttribute("width", String(size));
    bg.setAttribute("height", String(size));
    bg.setAttribute("fill", palette.service);
    const line = document.createElementNS(ns, "line");
    line.setAttribute("x1", "0");
    line.setAttribute("y1", "0");
    line.setAttribute("x2", "0");
    line.setAttribute("y2", String(size));
    line.setAttribute("stroke", palette.hatch);
    line.setAttribute("stroke-width", String(size / 6));
    pattern.append(bg, line);
    defs.appendChild(pattern);
    svg.insertBefore(defs, svg.firstChild);

    const fillFor = (value: string): string => {
        const v = value.trim().toLowerCase();
        if (v === "none" || v.startsWith("url(")) return value;
        const rgb = parseColor(v);
        if (!rgb) return value;
        const role = roleOf(rgb);
        return role === "service" ? `url(#${hatchId})` : palette[role];
    };

    // Nét dày nhất trong <style> = tường bao
    const styles = [...svg.querySelectorAll("style")];
    let maxStroke = 0;
    styles.forEach(style => {
        for (const m of (style.textContent || "").matchAll(/stroke-width\s*:\s*([\d.]+)/g)) maxStroke = Math.max(maxStroke, Number(m[1]));
    });
    styles.forEach(style => {
        style.textContent = (style.textContent || "").replace(/\{([^}]*)\}/g, (_all, body: string) => {
            const widthMatch = body.match(/stroke-width\s*:\s*([\d.]+)/);
            const isWall = maxStroke > 0 && widthMatch?.[1] != null && Number(widthMatch[1]) >= maxStroke * 0.9;
            const next = body
                .replace(/(^|;|\s)fill\s*:\s*([^;]+)/g, (_m, pre: string, val: string) => `${pre}fill:${fillFor(val)}`)
                .replace(/(^|;|\s)stroke\s*:\s*([^;]+)/g, (_m, pre: string, val: string) => (val.trim() === "none" ? `${pre}stroke:none` : `${pre}stroke:${isWall ? palette.wall : palette.edge}`));
            return `{${next}}`;
        });
    });
    svg.querySelectorAll("[fill]").forEach(el => {
        if (el.closest("pattern")) return;
        el.setAttribute("fill", fillFor(el.getAttribute("fill") || ""));
    });
    svg.querySelectorAll("[stroke]").forEach(el => {
        if (el.closest("pattern")) return;
        if ((el.getAttribute("stroke") || "").trim() !== "none") el.setAttribute("stroke", palette.edge);
    });
}

/** Ảnh PNG/JPG (data URL) bọc trong <svg> để dùng chung phép chiếu với bản vẽ SVG */
export function rasterAsSvg(href: string, width: number, height: number): SVGSVGElement {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    const image = document.createElementNS(ns, "image");
    image.setAttribute("href", href);
    image.setAttribute("width", String(width));
    image.setAttribute("height", String(height));
    svg.appendChild(image);
    return svg;
}
