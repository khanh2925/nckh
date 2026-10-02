import { useEffect, useRef, useState } from "react";
import L from "../utils/leaflet";
import "leaflet-rotate";
import floors from "../data/floors";
import { getGroup, getLocationType } from "../data/locationTypes";
import { mainTerminal, projection } from "../utils/mapProjection";
import campusUrl from "../../../crawled_data/tan_son_nhat_full/overview_campus/svg_maps/SGN_CAMPUS_Level1_F1.svg?url";
import campusPois from "../../../crawled_data/tan_son_nhat_full/overview_campus/overview_campus_pois.json";
import { airportFloors } from "../data/airportCatalog";
import { getLatLng } from "../utils/geo";
import { floorLabel } from "../utils/text";

const DEFAULT_BEARING = 85;      // rotate the map so T1 lies horizontally, like the drawing
const DETAIL_ZOOM = 18.5;        // Keep the terminal overview until the floor plan is readable.
const TERMINAL_ZOOM = 19.5;
const OVERVIEW_CENTER = [10.8141, 106.6630];
const OVERVIEW_ZOOM = 17.1;
const ROUTE_COLOR = "#1a73e8";
const WALKWAY_COLOR = "#e8710a";

// Only devices with a real mouse get hover previews. On phones a tap opens the detail sheet instead.
const canHover = window.matchMedia("(hover: hover)").matches;

// Markers are built with DOM + textContent (not an HTML string),
// so a location name coming from the API can never inject HTML into the page.
function createMarkerIcon(location, isSelected) {
    const type = getLocationType(location.type);
    const isGate = location.type === "gate";

    const element = document.createElement("span");
    element.className = `location-marker${isGate ? " is-gate" : ""}${isSelected ? " is-selected" : ""}`;
    element.style.background = getGroup(type.group).color;

    if (isGate) {
        // Passengers look for the gate NUMBER, so show "09" instead of an icon
        element.textContent = location.name.replace(/^Cửa\s*/i, "");
    } else {
        const icon = document.createElement("i");
        icon.className = `bi ${type.icon}`;
        element.appendChild(icon);
    }

    const size = isGate ? [42, 26] : [32, 32];
    return L.divIcon({ className: "", html: element, iconSize: size, iconAnchor: [size[0] / 2, size[1] / 2] });
}

function createPreview(location) {
    const type = getLocationType(location.type);
    const element = document.createElement("div");

    const name = document.createElement("strong");
    name.textContent = location.name;

    const meta = document.createElement("small");
    meta.textContent = `${type.label} · ${location.terminal || "T1"} · Tầng ${location.floor}`;

    element.append(name, meta);
    if (location.openingHours) {
        const hours = document.createElement("small");
        hours.textContent = `Giờ mở cửa: ${location.openingHours}`;
        element.append(hours);
    }
    return element;
}

function createFloorSvg(floorData) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", projection.viewBox);
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("class", "floor-plan-svg");
    // floorData.svg is our own static drawing (not user input), so innerHTML is fine here
    svg.innerHTML = `<g transform="${projection.transform}">${floorData.svg}</g>`;
    return svg;
}

// Angle (degrees) on SCREEN from the first point to the first point at least 20px away.
// Screen angle, not map angle, because the map is rotated (bearing).
function getScreenAngle(map, latlngs) {
    const points = latlngs.map(latlng => map.latLngToContainerPoint(latlng));
    const start = points[0];
    const next = points.find(point => point.distanceTo(start) > 20) || points[points.length - 1];
    if (next.distanceTo(start) === 0) return 0;
    return Math.atan2(next.y - start.y, next.x - start.x) * 180 / Math.PI;
}

// Walking person inside a circle + an arrow around it pointing where to walk
function createWalkerIcon(angle) {
    const element = document.createElement("span");
    element.className = "route-walker";

    const arrow = document.createElement("span");
    arrow.className = "route-walker-arrow";
    arrow.style.transform = `rotate(${angle}deg)`;

    const person = document.createElement("i");
    person.className = "bi bi-person-walking";
    // The icon faces right, so mirror it when walking to the left
    if (Math.abs(angle) > 90) person.style.transform = "scaleX(-1)";

    element.append(arrow, person);
    return L.divIcon({ className: "", html: element, iconSize: [38, 38], iconAnchor: [19, 19] });
}

function createDestinationIcon() {
    const element = document.createElement("span");
    element.className = "route-destination";
    element.innerHTML = '<i class="bi bi-geo-alt-fill"></i>';
    // Anchor at the bottom tip of the pin
    return L.divIcon({ className: "", html: element, iconSize: [34, 34], iconAnchor: [17, 34] });
}

function createTransferIcon(connector, nextFloor, isGoingUp) {
    const element = document.createElement("button");
    element.type = "button";
    element.className = "route-transfer";
    element.innerHTML = `<i class="bi ${isGoingUp ? "bi-arrow-up" : "bi-arrow-down"}"></i>`;
    element.append(` ${connector} → ${floorLabel(nextFloor)}`);
    return L.divIcon({ className: "", html: element, iconSize: null, iconAnchor: [0, 36] });
}

// A start/end of the route that was picked on the map (not a location)
function createRouteEndIcon(isStart) {
    const element = document.createElement("span");
    element.className = `route-end ${isStart ? "is-start" : "is-end"}`;
    element.innerHTML = `<i class="bi ${isStart ? "bi-person-walking" : "bi-flag-fill"}"></i>`;
    return L.divIcon({ className: "", html: element, iconSize: [30, 30], iconAnchor: [15, 15] });
}

// Admin "Lối đi": one dot per walkway point. Elevator/escalator points are squares showing the linked floors.
function createWalkwayNodeIcon(node, isActive, isSelected, linkedFloors) {
    const element = document.createElement("span");
    element.className = `walkway-node${node.connector ? " is-connector" : ""}${isActive ? " is-active" : ""}${isSelected ? " is-selected" : ""}`;
    if (node.connector) {
        const icon = document.createElement("i");
        icon.className = "bi bi-arrow-down-up";
        element.append(icon);
        element.title = `${node.connector}${linkedFloors.length ? ` · nối tầng ${linkedFloors.join(", ")}` : " · chưa nối tầng nào"}`;
    }
    const size = node.connector ? 22 : 14;
    return L.divIcon({ className: "", html: element, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
}

// onMapClick: when set, a click on the floor plan calls it with { terminal, floor, lat, lng }
// (admin picking a location, choosing a route point, drawing walkways).
// walkwayEditor: when set, the walkway network of this floor is drawn and can be edited (admin).
function MapView({ terminal = 'T1', onTerminalChange, floor, locations, selectedLocation, onSelect, onMapClick, previewPoint, routeEnds = [], route, onFloorChange, walkwayEditor }) {
    const containerRef = useRef(null);
    const mapRef = useRef(null);
    const layersRef = useRef(null);
    const [isDetailView, setIsDetailView] = useState(false);
    const [viewRevision, setViewRevision] = useState(0);
    const terminalChangeRef = useRef(onTerminalChange);
    const isEditingWalkways = Boolean(walkwayEditor) && !walkwayEditor.isLocked;

    // Keep the latest callback for the campus labels created once in effect 1
    useEffect(() => {
        terminalChangeRef.current = onTerminalChange;
    });

    // 1. Create the Leaflet map once. React only renders the empty <div>, Leaflet draws inside it.
    useEffect(() => {
        const map = L.map(containerRef.current, {
            center: OVERVIEW_CENTER, zoom: OVERVIEW_ZOOM, minZoom: 14, maxZoom: 22,
            zoomSnap: 0.1, zoomDelta: 0.5, zoomControl: false,
            rotate: true, bearing: DEFAULT_BEARING, rotateControl: false, touchRotate: false
        });

        const baseTiles = L.tileLayer("https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png", {
            maxZoom: 22, maxNativeZoom: 20,
            attribution: "&copy; Stadia Maps &copy; OpenMapTiles &copy; OpenStreetMap"
        }).addTo(map);

        // The floor-plan SVG is its own layer on top of overlayPane, so the route line needs a pane above it.
        // It must live inside leaflet-rotate's "rotatePane" to rotate together with the map.
        map.createPane("routePane", map.getPane("rotatePane")).style.zIndex = 450;
        map.createPane("walkwayPane", map.getPane("rotatePane")).style.zIndex = 440;
        map.createPane("campusPane", map.getPane("rotatePane")).style.zIndex = 300;
        map.createPane("indoorBackdropPane", map.getPane("rotatePane")).style.zIndex = 350;
        map.createPane("indoorPlanPane", map.getPane("rotatePane")).style.zIndex = 410;
        ["campusPane", "indoorBackdropPane", "indoorPlanPane"].forEach(name => {
            map.getPane(name).style.pointerEvents = "none";
        });

        const overview = L.layerGroup().addTo(map);
        const floorPlan = L.layerGroup().addTo(map);
        const routeLayer = L.layerGroup().addTo(map);
        const markers = L.layerGroup().addTo(map);
        const pickLayer = L.layerGroup().addTo(map);
        const routeEndLayer = L.layerGroup().addTo(map);
        const walkwayLayer = L.layerGroup().addTo(map);

        // One georeferenced drawing keeps buildings, shadows and roads aligned.
        L.imageOverlay(campusUrl, [
            [10.802859, 106.633215], [10.831274, 106.678459]
        ], { interactive: false, pane: "campusPane" }).addTo(map);

        // Keep the same campus underneath at every zoom; fade only indoor detail.
        const updateIndoorOpacity = () => {
            const opacity = Math.max(0, Math.min(1, (map.getZoom() - (DETAIL_ZOOM - 0.5)) / 0.5));
            map.getPane("indoorBackdropPane").style.opacity = String(opacity);
            map.getPane("indoorPlanPane").style.opacity = String(opacity);
        };
        updateIndoorOpacity();
        map.on("zoom", updateIndoorOpacity);

        campusPois.forEach(poi => {
            const parking = poi.type_name === "poi-self-parking";
            const terminal = ['T1', 'T2', 'T3'].map(id => ({ id, plan: true })).find(item => poi.name_vi.includes(item.id));
            const label = document.createElement(terminal?.plan ? "button" : "span");
            label.className = parking ? "campus-parking" : "campus-terminal";
            if (terminal?.plan) label.type = "button";
            const icon = document.createElement("span");
            icon.className = "campus-symbol";
            icon.textContent = parking ? "P" : "✈";
            label.append(icon);
            if (!parking) {
                const name = document.createElement("span");
                name.textContent = poi.name_vi;
                label.append(name);
            }
            label.title = parking ? poi.name_vi : terminal?.plan ? "Mở mặt bằng T1" : poi.name_vi;
            const marker = L.marker([poi.lat, poi.lng], {
                icon: L.divIcon({ className: "campus-label-anchor", html: label, iconSize: [0, 0], iconAnchor: [0, 0] }),
                keyboard: Boolean(terminal?.plan),
                interactive: Boolean(terminal?.plan)
            });
            if (terminal?.plan) marker.on("click", () => {
                terminalChangeRef.current(terminal.id);
                map.setView([poi.lat, poi.lng], TERMINAL_ZOOM);
            });
            overview.addLayer(marker);
        });

        map.on("zoomend", () => setIsDetailView(map.getZoom() >= DETAIL_ZOOM));
        map.on("moveend", () => setViewRevision(value => value + 1));

        mapRef.current = map;
        layersRef.current = { overview, floorPlan, routeLayer, markers, pickLayer, routeEndLayer, walkwayLayer, baseTiles };

        return () => {
            map.remove();
            mapRef.current = null;
        };
    }, []);

    // 2. Keep the indoor layers mounted so zooming never reloads the drawing.
    useEffect(() => {
        const { floorPlan, baseTiles } = layersRef.current;

        // Keep roads visible outside the airport drawing instead of hiding all tiles.
        baseTiles.setOpacity(1);

        floorPlan.clearLayers();
        const catalogFloor = airportFloors.find(item => item.terminal === terminal && item.id === floor);
        if (!catalogFloor || terminal === 'SGN_CAMPUS') return;
        const bounds = catalogFloor.bounds;
        // Geographic bounds: this backdrop moves and scales with the floor plan.
        // Cover nearby street/building outlines that conflict with the indoor drawing.
        floorPlan.addLayer(L.rectangle(L.latLngBounds(bounds).pad(0.03), {
            pane: "indoorBackdropPane",
            stroke: false, fillColor: "#f1f1f1", fillOpacity: 1, interactive: false
        }));
        const overlayUrl = catalogFloor.url;
        if (overlayUrl) {
            floorPlan.addLayer(L.imageOverlay(overlayUrl, bounds, {
                opacity: 1,
                pane: "indoorPlanPane",
                interactive: false
            }));
        } else {
            const floorData = floors.find(item => item.id === floor);
            if (floorData) {
                floorPlan.addLayer(L.svgOverlay(createFloorSvg(floorData), projection.bounds, { interactive: false, pane: "indoorPlanPane" }));
            }
        }
    }, [floor, terminal]);

    useEffect(() => {
        const target = airportFloors.find(item => item.terminal === terminal);
        if (target) mapRef.current.setView(target.center, terminal === 'SGN_CAMPUS' ? OVERVIEW_ZOOM : TERMINAL_ZOOM);
    }, [terminal]);

    useEffect(() => {
        const { overview } = layersRef.current;
        if (isDetailView) overview.remove();
        else overview.addTo(mapRef.current);
    }, [isDetailView]);

    // 3. Draw one marker per location (only when zoomed in)
    useEffect(() => {
        const { markers } = layersRef.current;
        markers.clearLayers();
        if (!isDetailView) return;

        const map = mapRef.current;
        const occupied = [];
        // Show the selected place first, then gates; reveal other places as space allows.
        const priority = location => location.id === selectedLocation?.id ? 0 : location.type === "gate" ? 1 : 2;
        const ordered = [...locations].sort((a, b) => priority(a) - priority(b));
        ordered.forEach(location => {
            const isSelected = selectedLocation?.id === location.id;
            const latlng = getLatLng(location);

            const point = map.latLngToContainerPoint(latlng);
            const viewport = map.getSize();
            if (point.x < -40 || point.y < -40 || point.x > viewport.x + 40 || point.y > viewport.y + 40) return;
            const halfWidth = location.type === "gate" ? 26 : 20;
            const halfHeight = 20;
            const box = { left: point.x - halfWidth, right: point.x + halfWidth, top: point.y - halfHeight, bottom: point.y + halfHeight };
            if (!isSelected && occupied.some(other => box.left < other.right && box.right > other.left && box.top < other.bottom && box.bottom > other.top)) return;
            occupied.push(box);

            // While the admin draws walkways, clicks must reach the map, not the shops
            const marker = L.marker(latlng, {
                icon: createMarkerIcon(location, isSelected),
                alt: location.name,
                zIndexOffset: isSelected ? 1000 : 0,
                interactive: !isEditingWalkways,
                keyboard: !isEditingWalkways,
                opacity: isEditingWalkways ? 0.45 : 1
            });

            if (canHover) {
                marker.bindTooltip(createPreview(location), { direction: "top", offset: [0, -16], className: "location-preview" });
            }
            marker.on("click", () => onSelect(location));
            // Keyboard users: Tab to a marker, press Enter (Leaflet only does this for popups)
            marker.on("keypress", (event) => {
                if (event.originalEvent.key === "Enter") onSelect(location);
            });
            markers.addLayer(marker);
        });
    }, [locations, selectedLocation, isDetailView, onSelect, viewRevision, isEditingWalkways]);

    // 4. Move the map to the selected location
    useEffect(() => {
        if (!selectedLocation) return;
        const map = mapRef.current;
        map.setBearing(DEFAULT_BEARING);
        map.setView(getLatLng(selectedLocation), Math.max(map.getZoom(), 19.5));
    }, [selectedLocation]);

    // 5. Clicks on the floor plan of the current floor (see onMapClick above)
    useEffect(() => {
        if (!onMapClick) return;
        const map = mapRef.current;

        const handleMapClick = (event) => {
            const catalogFloor = airportFloors.find(item => item.terminal === terminal && item.id === floor);
            if (!catalogFloor || terminal === "SGN_CAMPUS" || !L.latLngBounds(catalogFloor.bounds).contains(event.latlng)) return;
            // Too far away to click precisely: the first click only zooms in
            if (map.getZoom() < DETAIL_ZOOM) {
                map.setView(event.latlng, TERMINAL_ZOOM);
                return;
            }
            onMapClick({ terminal, floor, lat: event.latlng.lat, lng: event.latlng.lng });
        };

        map.getContainer().classList.add("picking-location");
        map.on("click", handleMapClick);
        return () => {
            map.off("click", handleMapClick);
            map.getContainer().classList.remove("picking-location");
        };
    }, [onMapClick, terminal, floor]);

    // 6. Admin: show where the picked point is before saving
    useEffect(() => {
        const { pickLayer } = layersRef.current;
        pickLayer.clearLayers();
        if (!previewPoint || previewPoint.floor !== floor) return;

        const icon = L.divIcon({ className: "", html: '<span class="pick-preview"><i class="bi bi-crosshair"></i></span>', iconSize: [30, 30], iconAnchor: [15, 15] });
        pickLayer.addLayer(L.marker([previewPoint.lat, previewPoint.lng], { icon, interactive: false, zIndexOffset: 3000 }));
    }, [previewPoint, floor]);

    // 6b. Route ends picked on the map get a marker until the route is drawn
    useEffect(() => {
        const { routeEndLayer } = layersRef.current;
        routeEndLayer.clearLayers();
        if (route?.legs) return;
        routeEnds.forEach((end, index) => {
            if (!end?.isPoint || end.terminal !== terminal || end.floor !== floor) return;
            routeEndLayer.addLayer(L.marker([end.lat, end.lng], { icon: createRouteEndIcon(index === 0), interactive: false, zIndexOffset: 2600 }));
        });
    }, [routeEnds, route, terminal, floor]);

    // 7. Draw the route of the CURRENT floor: dots + walking person + destination / floor change
    useEffect(() => {
        const map = mapRef.current;
        const { routeLayer } = layersRef.current;
        routeLayer.clearLayers();
        if (!route?.legs || !isDetailView) return;

        const walkers = [];
        route.legs.forEach((leg, index) => {
            if (leg.floor !== floor) return;
            const latlngs = leg.points.map(point => [point.lat, point.lng]);

            // Dotted line: each dash has length 0 and round ends, so it looks like a row of dots
            routeLayer.addLayer(L.polyline(latlngs, { pane: "routePane", color: ROUTE_COLOR, weight: 7, dashArray: "0 13", lineCap: "round", interactive: false }));

            const walker = L.marker(latlngs[0], { icon: createWalkerIcon(getScreenAngle(map, latlngs)), interactive: false, zIndexOffset: 2000 });
            routeLayer.addLayer(walker);
            walkers.push({ marker: walker, latlngs });

            const nextLeg = route.legs[index + 1];
            const end = latlngs[latlngs.length - 1];
            if (nextLeg) {
                const transfer = L.marker(end, { icon: createTransferIcon(leg.connector, nextLeg.floor, nextLeg.floor > leg.floor), zIndexOffset: 2500 });
                transfer.on("click", () => onFloorChange(nextLeg.floor));
                routeLayer.addLayer(transfer);
            } else {
                routeLayer.addLayer(L.marker(end, { icon: createDestinationIcon(), interactive: false, zIndexOffset: 1500 }));
            }
        });

        // The arrow direction depends on the map rotation, so redraw it when the map rotates
        const handleRotate = () => {
            walkers.forEach(({ marker, latlngs }) => marker.setIcon(createWalkerIcon(getScreenAngle(map, latlngs))));
        };
        map.on("rotate", handleRotate);
        return () => map.off("rotate", handleRotate);
    }, [route, floor, isDetailView, onFloorChange]);

    // 8. Zoom to the part of the route on the current floor
    useEffect(() => {
        if (!route?.legs) return;
        const leg = route.legs.find(item => item.floor === floor);
        if (!leg) return;

        const map = mapRef.current;
        const bounds = L.latLngBounds(leg.points.map(point => [point.lat, point.lng]));
        // Leave room for the panels: left column on desktop, bottom sheet on phones
        const isPhone = window.matchMedia("(max-width: 767.98px)").matches;
        map.setBearing(DEFAULT_BEARING);
        map.fitBounds(bounds, {
            paddingTopLeft: isPhone ? [30, 140] : [440, 60],
            paddingBottomRight: isPhone ? [60, 300] : [80, 60],
            maxZoom: 20,
            animate: false
        });
        // Never stay below DETAIL_ZOOM, otherwise the floor plan disappears
        if (map.getZoom() < DETAIL_ZOOM + 0.2) map.setZoom(DETAIL_ZOOM + 0.2, { animate: false });
    }, [route, floor]);

    // 9. Admin "Lối đi": draw the walkway network of this floor, ready to be edited
    useEffect(() => {
        const map = mapRef.current;
        const { walkwayLayer } = layersRef.current;
        walkwayLayer.clearLayers();
        if (!walkwayEditor || !isDetailView) return;

        const { network, tool, activeId, selectedId, isLocked, onNodeClick, onEdgeClick, onNodeMove } = walkwayEditor;
        const nodeById = new Map(network.nodes.map(node => [node.id, node]));
        const isOnThisFloor = (node) => node.terminal === terminal && node.floor === floor;
        const linkedFloors = new Map();   // node id -> other floors it is linked to

        network.edges.forEach(edge => {
            const a = nodeById.get(edge.from);
            const b = nodeById.get(edge.to);
            if (!a || !b) return;
            if (a.floor !== b.floor) {
                if (isOnThisFloor(a)) linkedFloors.set(a.id, [...(linkedFloors.get(a.id) || []), b.floor]);
                if (isOnThisFloor(b)) linkedFloors.set(b.id, [...(linkedFloors.get(b.id) || []), a.floor]);
                return;
            }
            if (!isOnThisFloor(a)) return;
            const latlngs = [[a.lat, a.lng], [b.lat, b.lng]];
            walkwayLayer.addLayer(L.polyline(latlngs, { pane: "walkwayPane", color: WALKWAY_COLOR, weight: 4, opacity: isLocked ? 0.5 : 0.9, interactive: false }));
            if (isLocked) return;
            // A wide invisible line on top, so the thin line is easy to click
            const hitArea = L.polyline(latlngs, { pane: "walkwayPane", weight: 16, opacity: 0, bubblingMouseEvents: false, className: `walkway-hit tool-${tool}` });
            hitArea.on("click", event => onEdgeClick(edge, { lat: event.latlng.lat, lng: event.latlng.lng }));
            walkwayLayer.addLayer(hitArea);
        });

        network.nodes.filter(isOnThisFloor).forEach(node => {
            const marker = L.marker([node.lat, node.lng], {
                icon: createWalkwayNodeIcon(node, node.id === activeId, node.id === selectedId, linkedFloors.get(node.id) || []),
                draggable: !isLocked && tool !== "erase",
                interactive: !isLocked,
                keyboard: false,
                zIndexOffset: 500
            });
            marker.on("click", () => onNodeClick(node));
            marker.on("dragend", () => {
                const point = marker.getLatLng();
                onNodeMove(node, { lat: point.lat, lng: point.lng });
            });
            walkwayLayer.addLayer(marker);
        });

        // Dashed "rubber band" from the last point to the mouse, so the admin sees the next segment
        const active = nodeById.get(activeId);
        if (isLocked || tool !== "draw" || !active || !isOnThisFloor(active)) return;
        const guide = L.polyline([[active.lat, active.lng], [active.lat, active.lng]], { pane: "walkwayPane", color: WALKWAY_COLOR, weight: 3, dashArray: "6 8", interactive: false });
        walkwayLayer.addLayer(guide);
        const handleMouseMove = (event) => guide.setLatLngs([[active.lat, active.lng], event.latlng]);
        map.on("mousemove", handleMouseMove);
        return () => map.off("mousemove", handleMouseMove);
    }, [walkwayEditor, terminal, floor, isDetailView]);

    // Double-click would add 2 points and zoom at the same time, so it is off while drawing
    useEffect(() => {
        const map = mapRef.current;
        if (!isEditingWalkways) return;
        map.doubleClickZoom.disable();
        return () => map.doubleClickZoom.enable();
    }, [isEditingWalkways]);

    const handleZoomIn = () => mapRef.current.zoomIn();
    const handleZoomOut = () => mapRef.current.zoomOut();
    const handleResetBearing = () => mapRef.current.setBearing(DEFAULT_BEARING);

    const handleShowOverview = () => {
        mapRef.current.setBearing(DEFAULT_BEARING);
        mapRef.current.setView(OVERVIEW_CENTER, OVERVIEW_ZOOM);
    };

    const handleShowTerminal = () => {
        mapRef.current.setBearing(DEFAULT_BEARING);
        mapRef.current.setView(mainTerminal.center, TERMINAL_ZOOM);
    };

    const statusText = isDetailView
        ? `Mặt bằng Tầng ${floor} · Phân vùng gần đúng, không dùng để chỉ đường thực tế`
        : "Toàn cảnh sân bay · Chạm vào Ga T1 để xem mặt bằng";

    return (
        <div className="map-view">
            <div ref={containerRef} className="map-canvas" />

            <div className="map-controls" aria-label="Điều khiển bản đồ">
                <button type="button" onClick={handleZoomIn} aria-label="Phóng to" title="Phóng to"><i className="bi bi-plus-lg" /></button>
                <button type="button" onClick={handleZoomOut} aria-label="Thu nhỏ" title="Thu nhỏ"><i className="bi bi-dash-lg" /></button>
                <button type="button" onClick={handleResetBearing} aria-label="Đặt lại hướng" title="Đặt lại hướng"><i className="bi bi-compass" /></button>
                <button type="button" onClick={handleShowOverview} aria-label="Xem toàn sân bay" title="Xem toàn sân bay"><i className="bi bi-house" /></button>
                <button type="button" onClick={handleShowTerminal} aria-label="Về Ga T1" title="Về Ga T1" className="fw-bold">T1</button>
            </div>

            {isDetailView && (
                <div className="legend" aria-label="Chú giải mặt bằng">
                    <span><i className="room" />Khu dịch vụ</span>
                    <span><i className="lounge" />Phòng chờ</span>
                    <span><i className="shop" />Cửa hàng</span>
                    <span><i className="security" />Khu kiểm soát</span>
                </div>
            )}

            <p className="map-footnote">{statusText}</p>
        </div>
    );
}

export default MapView;
