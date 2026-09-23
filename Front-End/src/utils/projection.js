import L from "./leaflet";

// Converts positions on a floor-plan drawing (pixels) to positions on the real map (lat/lng), and back.
//
// We know 2 points ("anchor" and "end") both in pixels and in lat/lng.
// From them we get (ux, uy) = how far 1 pixel along the drawing's x-axis moves on the real map
// (this already includes scale + rotation). 1 pixel along the y-axis moves in the perpendicular
// direction (uy, -ux), multiplied by depthScale because the drawing is stretched in depth.
// This kind of mapping is called an "affine transform": move + rotate + scale.
export function createProjection(plan) {
    const { imageSize, anchor, end, depthScale } = plan;

    // Web Mercator: converts lat/lng <-> meters on a flat map (y goes UP / north)
    const crs = L.CRS.EPSG3857;
    const start = crs.project(L.latLng(anchor.latlng));
    const finish = crs.project(L.latLng(end.latlng));
    const span = end.image[0] - anchor.image[0];
    const ux = (finish.x - start.x) / span;
    const uy = (finish.y - start.y) / span;

    const imageToWorld = (x, y) => {
        const dx = x - anchor.image[0];
        const dy = y - anchor.image[1];
        return {
            x: start.x + dx * ux + dy * uy * depthScale,
            y: start.y + dx * uy - dy * ux * depthScale
        };
    };

    const toLatLng = (x, y) => {
        const point = imageToWorld(x, y);
        return crs.unproject(L.point(point.x, point.y));
    };

    // Inverse of imageToWorld: solve the 2 equations above for dx and dy
    const toImagePoint = (latlng) => {
        const point = crs.project(latlng);
        const dx = point.x - start.x;
        const dy = point.y - start.y;
        const square = ux * ux + uy * uy;
        return {
            x: anchor.image[0] + (dx * ux + dy * uy) / square,
            y: anchor.image[1] + (dx * uy - dy * ux) / (depthScale * square)
        };
    };

    // Leaflet can only stretch an SVG over a straight (not rotated) lat/lng rectangle.
    // So: project the 4 corners of the drawing, take their bounding box, make an SVG of that size
    // (1 unit = 1 meter) and draw the original pixel drawing inside a <g transform="matrix(...)">
    // that does the same math as imageToWorld. The y-axis is flipped because SVG y goes DOWN.
    const corners = [[0, 0], [imageSize.width, 0], [imageSize.width, imageSize.height], [0, imageSize.height]]
        .map(([x, y]) => imageToWorld(x, y));
    const minX = Math.min(...corners.map(p => p.x));
    const maxX = Math.max(...corners.map(p => p.x));
    const minY = Math.min(...corners.map(p => p.y));
    const maxY = Math.max(...corners.map(p => p.y));
    const origin = imageToWorld(0, 0);

    const bounds = L.latLngBounds(crs.unproject(L.point(minX, minY)), crs.unproject(L.point(maxX, maxY)));
    const viewBox = `0 0 ${maxX - minX} ${maxY - minY}`;
    const transform = `matrix(${ux} ${-uy} ${uy * depthScale} ${ux * depthScale} ${origin.x - minX} ${maxY - origin.y})`;

    return { toLatLng, toImagePoint, bounds, viewBox, transform };
}
