import L from "./leaflet";

// Touchpad pinch / mouse wheel zoom that follows the fingers on every frame.
//
// Leaflet's own scrollWheelZoom waits until the wheel events stop, then animates to the final zoom,
// so pinching on a touchpad feels slow and laggy. Here every wheel event moves the target zoom and the
// map is redrawn on the next animation frame, keeping the point under the cursor in place.
// It works like leaflet-rotate's touch pinch: map._move() while zooming, then one short snap at the end.

// Touchpad pinch arrives as wheel events with ctrlKey; browsers send deltaY ≈ -100·ln(scale)
const PINCH_SPEED = 1 / (100 * Math.LN2);
// Plain wheel: two-finger scroll on a touchpad (small deltas) or a mouse wheel (~100 per notch)
const WHEEL_SPEED = 1 / 250;
// Mouse wheel notches are big jumps, so they glide to the target instead of jumping
const EASING = 0.3;
const END_DELAY = 160;   // ms without wheel events = the gesture is over

export function enableSmoothWheelZoom(map) {
    const container = map.getContainer();
    let target = null;    // zoom we are heading to, null = not zooming
    let current = null;   // zoom drawn on screen right now
    let isGliding = false;
    let anchor = null;    // map point that must stay under the cursor
    let offset = null;    // cursor position from the map center, in screen pixels
    let center = null;
    let frame = null;
    let endTimer = null;

    const draw = () => {
        frame = null;
        current = isGliding && Math.abs(target - current) > 0.01 ? current + (target - current) * EASING : target;
        // The map is rotated: turn the screen offset back into map pixels before moving the center
        const angle = -map.getBearing() * L.DomUtil.DEG_TO_RAD;
        center = map.unproject(map.project(anchor, current).subtract(offset.rotate(angle)), current);
        map._move(center, current, { pinch: true, round: false });
        if (current !== target) frame = L.Util.requestAnimFrame(draw);
    };

    const finish = () => {
        endTimer = null;
        if (frame) {
            L.Util.cancelAnimFrame(frame);
            isGliding = false;
            draw();
        }
        target = null;
        // End like Leaflet's pinch so tiles, markers… update for the new zoom, but keep the exact zoom:
        // rounding to zoomSnap (0.1) would bounce small pinches back and feel sticky
        if (map._zoomAnimated) map._animateZoom(center, current, true, true);
        else map._resetView(center, current);
    };

    const handleWheel = (event) => {
        event.preventDefault();
        const point = map.mouseEventToContainerPoint(event);
        if (target === null) {
            // A new gesture during the end snap of the previous one: finish that snap first,
            // otherwise getZoom() still returns the zoom from before it and the new pinch would jump back
            if (map._animatingZoom) map._onZoomTransitionEnd();
            map._stop();
            current = target = map.getZoom();
            map._moveStart(true, false);
        }

        // deltaMode: 0 = pixels, 1 = lines, 2 = pages
        const pixels = event.deltaY * (event.deltaMode === 1 ? 20 : event.deltaMode === 2 ? 400 : 1);
        isGliding = !event.ctrlKey && Math.abs(pixels) >= 50;
        target = Math.min(map.getMaxZoom(), Math.max(map.getMinZoom(), target - pixels * (event.ctrlKey ? PINCH_SPEED : WHEEL_SPEED)));
        anchor = map.containerPointToLatLng(point);
        offset = point.subtract(map.getSize().divideBy(2));

        if (!frame) frame = L.Util.requestAnimFrame(draw);
        clearTimeout(endTimer);
        endTimer = setTimeout(finish, END_DELAY);
    };

    // passive: false, otherwise preventDefault can't stop the browser from zooming the whole page
    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
        container.removeEventListener("wheel", handleWheel);
        clearTimeout(endTimer);
        if (frame) L.Util.cancelAnimFrame(frame);
    };
}
