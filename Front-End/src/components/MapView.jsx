import { useEffect, useRef, useState } from "react";
import L from "../utils/leaflet";
import "leaflet-rotate";
import terminals from "../data/terminals";
import floors from "../data/floors";
import { getGroup, getLocationType } from "../data/locationTypes";
import { createProjection } from "../utils/projection";

const DEFAULT_BEARING = 85;      // rotate the map so T1 lies horizontally, like the drawing
const DETAIL_ZOOM = 17.4;        // zoom >= 17.4: floor plan + markers. Below: terminal outlines only
const TERMINAL_ZOOM = 18.8;
const OVERVIEW_CENTER = [10.8133, 106.6574];
const OVERVIEW_ZOOM = 16.2;

const mainTerminal = terminals.find(terminal => terminal.id === "T1");
const projection = createProjection(mainTerminal.plan);

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

function MapView({ floor, locations, selectedLocation, onSelect, isPicking, onPickPoint }) {
    const containerRef = useRef(null);
    const mapRef = useRef(null);
    const layersRef = useRef(null);
    const [isDetailView, setIsDetailView] = useState(false);

    // 1. Create the Leaflet map once. React only renders the empty <div>, Leaflet draws inside it.
    useEffect(() => {
        const map = L.map(containerRef.current, {
            center: OVERVIEW_CENTER, zoom: OVERVIEW_ZOOM, minZoom: 14, maxZoom: 22,
            zoomSnap: 0.1, zoomDelta: 0.5, zoomControl: false,
            rotate: true, bearing: DEFAULT_BEARING, rotateControl: false, touchRotate: false
        });

        L.tileLayer("https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png", {
            maxZoom: 22, maxNativeZoom: 20,
            attribution: "&copy; Stadia Maps &copy; OpenMapTiles &copy; OpenStreetMap"
        }).addTo(map);

        const overview = L.layerGroup().addTo(map);
        const floorPlan = L.layerGroup().addTo(map);
        const markers = L.layerGroup().addTo(map);

        terminals.forEach(terminal => {
            const polygon = L.polygon(terminal.outline, {
                color: "#bd2e39", weight: 2, fillColor: "#dc4f59", fillOpacity: terminal.plan ? 0.8 : 0.6
            });
            polygon.bindTooltip(`✈ SGN · ${terminal.name}`, { permanent: true, direction: "center", className: "terminal-label" });
            // Terminals with a floor plan zoom straight into it
            polygon.on("click", () => map.setView(terminal.center, terminal.plan ? TERMINAL_ZOOM : 17));
            overview.addLayer(polygon);
        });

        map.on("zoomend", () => setIsDetailView(map.getZoom() >= DETAIL_ZOOM));

        mapRef.current = map;
        layersRef.current = { overview, floorPlan, markers };

        return () => {
            map.remove();
            mapRef.current = null;
        };
    }, []);

    // 2. Show terminal outlines OR the floor plan of the current floor
    useEffect(() => {
        const map = mapRef.current;
        const { overview, floorPlan } = layersRef.current;

        floorPlan.clearLayers();
        if (!isDetailView) {
            overview.addTo(map);
            return;
        }

        overview.remove();
        const floorData = floors.find(item => item.id === floor);
        if (floorData) {
            floorPlan.addLayer(L.svgOverlay(createFloorSvg(floorData), projection.bounds, { interactive: false }));
        }
    }, [floor, isDetailView]);

    // 3. Draw one marker per location (only when zoomed in)
    useEffect(() => {
        const { markers } = layersRef.current;
        markers.clearLayers();
        if (!isDetailView) return;

        locations.forEach(location => {
            const isSelected = selectedLocation?.id === location.id;
            const marker = L.marker(projection.toLatLng(location.x, location.y), {
                icon: createMarkerIcon(location, isSelected),
                alt: location.name,
                zIndexOffset: isSelected ? 1000 : 0
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
    }, [locations, selectedLocation, isDetailView, onSelect]);

    // 4. Move the map to the selected location
    useEffect(() => {
        if (!selectedLocation) return;
        const map = mapRef.current;
        map.setBearing(DEFAULT_BEARING);
        map.setView(projection.toLatLng(selectedLocation.x, selectedLocation.y), Math.max(map.getZoom(), 19.5));
    }, [selectedLocation]);

    // 5. Admin "pick a point" mode: the next click on the map becomes the new location's x, y
    useEffect(() => {
        if (!isPicking) return;
        const map = mapRef.current;

        if (map.getZoom() < DETAIL_ZOOM) {
            map.setBearing(DEFAULT_BEARING);
            map.setView(mainTerminal.center, TERMINAL_ZOOM);
        }

        const handleMapClick = (event) => onPickPoint(projection.toImagePoint(event.latlng));
        map.getContainer().classList.add("picking-location");
        map.once("click", handleMapClick);

        return () => {
            map.off("click", handleMapClick);
            map.getContainer().classList.remove("picking-location");
        };
    }, [isPicking, onPickPoint]);

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
