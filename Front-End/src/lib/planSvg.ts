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
