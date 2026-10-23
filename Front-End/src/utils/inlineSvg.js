// Turns the text of a floor-plan SVG file into an <svg> element for L.svgOverlay.
//
// Why not L.imageOverlay(url)? An <img> SVG is redrawn in full at its displayed size after every zoom.
// Zoomed in, the campus drawing is ~24000 x 15000 px, so each zoom froze the map for a moment.
// An inline <svg> is only painted where it is visible on screen.
//
// The drawings are exported from CorelDRAW and all use the same class names (.fil0, .str1…) in their <style>,
// which would clash once several are in the same page. Every class and id gets a unique prefix.
let counter = 0;

export function inlineSvg(text) {
    const prefix = `svg${counter++}-`;
    const svg = new DOMParser().parseFromString(text, "image/svg+xml").documentElement;

    svg.querySelectorAll("style").forEach(style => {
        // ".fil0 {…}" -> ".svg3-fil0 {…}" (a class name starts with a letter, so "0.5" is not touched)
        style.textContent = style.textContent.replace(/\.([A-Za-z_][\w-]*)/g, `.${prefix}$1`);
    });
    svg.querySelectorAll("[class]").forEach(element => {
        element.setAttribute("class", element.getAttribute("class").split(/\s+/).filter(Boolean).map(name => prefix + name).join(" "));
    });
    svg.querySelectorAll("[id]").forEach(element => element.setAttribute("id", prefix + element.id));

    // Leaflet sizes the element with CSS; the file's own size in mm would only get in the way
    svg.removeAttribute("width");
    svg.removeAttribute("height");
    return document.importNode(svg, true);
}
