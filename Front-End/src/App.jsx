import { useEffect, useMemo, useState } from "react";
import Header from "./components/Header";
import MapView from "./components/MapView";
import SearchBox from "./components/SearchBox";
import CategoryFilter from "./components/CategoryFilter";
import LocationDetail from "./components/LocationDetail";
import RoutePanel from "./components/RoutePanel";
import { API_BASE, getLocations, isStaticMode } from "./api/locationApi";
import { getWalkways } from "./api/walkwayApi";
import { getLocationType } from "./data/locationTypes";
import { findRoute } from "./utils/routing";
import { airportFloors } from "./data/airportCatalog";

const EMPTY_WALKWAYS = { nodes: [], edges: [] };

// Public map: search, details and directions. Editing lives in the admin app (src/admin, /admin).
function App() {
    const [locations, setLocations] = useState([]);
    const [walkways, setWalkways] = useState(EMPTY_WALKWAYS);
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [reloadCount, setReloadCount] = useState(0);

    const [floor, setFloor] = useState(1);
    const [terminal, setTerminal] = useState("T1");
    const [activeGroup, setActiveGroup] = useState("all");
    const [selectedId, setSelectedId] = useState(null);

    // Directions: each end is a location OR a point picked on the map (see handleRoutePoint)
    const [isRouting, setIsRouting] = useState(false);
    const [routeFrom, setRouteFrom] = useState(null);
    const [routeTo, setRouteTo] = useState(null);
    const [pickTarget, setPickTarget] = useState(null);   // end chosen with the crosshair button: "from" | "to" | null

    // Runs on first render, and again every time "Thử lại" increases reloadCount.
    // allSettled: the map still shows the locations even if the walkways fail to load.
    useEffect(() => {
        Promise.allSettled([getLocations(), getWalkways()]).then(([locationResult, walkwayResult]) => {
            setIsLoading(false);
            if (locationResult.status === "fulfilled") setLocations(locationResult.value);
            if (walkwayResult.status === "fulfilled") setWalkways(walkwayResult.value);

            if (locationResult.status === "rejected") {
                console.error(locationResult.reason);
                setError(isStaticMode || API_BASE ? "Không tải được dữ liệu địa điểm." : "Không kết nối được backend (cổng 8080).");
            } else if (walkwayResult.status === "rejected") {
                console.error(walkwayResult.reason);
                setError("Không tải được lối đi nên chưa thể chỉ đường.");
            } else {
                setError("");
            }
        });
    }, [reloadCount]);

    const handleReload = () => {
        setError("");
        setIsLoading(true);
        setReloadCount(reloadCount + 1);
    };

    const findById = (id) => locations.find(location => location.id === id) || null;
    const isInGroup = (location, groupId) => groupId === "all" || getLocationType(location.type).group === groupId;

    // Derived data: calculated from state on every render, not stored in state
    const selectedLocation = findById(selectedId);
    // Which end the next click on the map fills: the one chosen with the crosshair, otherwise the missing one
    const routePickTarget = !isRouting ? null : pickTarget || (!routeFrom ? "from" : !routeTo ? "to" : null);

    // useMemo: only search for a new path when the ends or the network change
    const route = useMemo(
        () => (routeFrom && routeTo && routeFrom.id !== routeTo.id ? findRoute(walkways, routeFrom, routeTo) : null),
        [walkways, routeFrom, routeTo]
    );

    // Places that must stay visible even when the filter hides their group
    const pinnedIds = [selectedId, routeFrom?.id, routeTo?.id];
    const visibleLocations = locations.filter(location =>
        location.terminal === terminal && location.floor === floor && (isInGroup(location, activeGroup) || pinnedIds.includes(location.id))
    );

    // ---------- Selecting a place (marker click or search result) ----------
    const handleSelect = (location) => {
        setTerminal(location.terminal);
        setFloor(location.floor);
        if (isRouting) {
            handleRoutePlace(location);
        } else {
            setSelectedId(location.id);
        }
    };

    const handleFloorChange = (newFloor) => {
        setFloor(newFloor);
        if (selectedLocation && selectedLocation.floor !== newFloor) setSelectedId(null);
    };

    const handleTerminalChange = (value) => {
        setTerminal(value);
        setFloor(airportFloors.find(item => item.terminal === value)?.id ?? 0);
        setSelectedId(null);
        handleCloseRoute();
    };

    const handleGroupChange = (groupId) => {
        setActiveGroup(groupId);
        if (selectedLocation && !isInGroup(selectedLocation, groupId)) setSelectedId(null);
    };

    // ---------- Directions ----------
    const handleOpenRoute = () => {
        setIsRouting(true);
        setSelectedId(null);
    };

    const handleRouteFrom = (location) => {
        setIsRouting(true);
        setRouteFrom(location);
        setRouteTo(null);
        setPickTarget(null);
        setSelectedId(null);
    };

    const handleRouteTo = (location) => {
        setIsRouting(true);
        setRouteTo(location);
        setRouteFrom(null);
        setPickTarget(null);
        setSelectedId(null);
    };

    // While directions are open, a chosen place fills the end that is being picked.
    // When both ends exist, a new place replaces the destination.
    const handleRoutePlace = (place) => {
        const isFrom = routePickTarget === "from";
        const from = isFrom ? place : routeFrom;
        if (isFrom) setRouteFrom(place);
        else setRouteTo(place);
        setPickTarget(null);
        // When both ends are known, show the route from its start
        if (from && (isFrom ? routeTo : place) && from.terminal === place.terminal) setFloor(from.floor);
    };

    // Any spot on the floor plan can be a start or an end, not only a location
    const handleRoutePoint = (point) => {
        handleRoutePlace({
            id: `point-${point.terminal}-${point.floor}-${point.lat.toFixed(6)}-${point.lng.toFixed(6)}`,
            isPoint: true,
            name: "Vị trí đã chọn trên bản đồ",
            ...point
        });
    };

    const handleSwapRoute = () => {
        setRouteFrom(routeTo);
        setRouteTo(routeFrom);
        if (routeTo && routeTo.terminal === terminal) setFloor(routeTo.floor);
    };

    const handleCloseRoute = () => {
        setIsRouting(false);
        setRouteFrom(null);
        setRouteTo(null);
        setPickTarget(null);
    };

    // While directions wait for an end, a click on the floor plan picks that spot
    const handleMapClick = routePickTarget ? handleRoutePoint : null;

    return (
        <main className="app-shell">
            <Header terminal={terminal} onTerminalChange={handleTerminalChange} floor={floor} onFloorChange={handleFloorChange} />

            <section className="map-shell" aria-label="Bản đồ nhà ga">
                <MapView
                    terminal={terminal}
                    onTerminalChange={handleTerminalChange}
                    floor={floor}
                    locations={visibleLocations}
                    selectedLocation={selectedLocation}
                    onSelect={handleSelect}
                    onMapClick={handleMapClick}
                    routeEnds={[routeFrom, routeTo]}
                    route={route}
                    onFloorChange={handleFloorChange}
                />

                <div className="map-top">
                    <div className="search-row">
                        <SearchBox locations={locations} onSelect={handleSelect} terminal={terminal} floor={floor} />
                        {!isRouting && (
                            <button type="button" className="btn btn-primary route-open" onClick={handleOpenRoute} aria-label="Chỉ đường" title="Chỉ đường">
                                <i className="bi bi-signpost-2" />
                            </button>
                        )}
                    </div>
                    <CategoryFilter activeGroup={activeGroup} onChange={handleGroupChange} />

                    {isLoading && (
                        <div className="alert alert-light d-flex align-items-center gap-2 py-2 mb-0 shadow-sm" role="status">
                            <span className="spinner-border spinner-border-sm text-primary" aria-hidden="true" />
                            <span>Đang tải dữ liệu…{API_BASE && " Máy chủ miễn phí có thể mất khoảng 1 phút để khởi động."}</span>
                        </div>
                    )}

                    {error && (
                        <div className="alert alert-danger d-flex align-items-center gap-2 py-2 mb-0" role="alert">
                            <i className="bi bi-exclamation-triangle" />
                            <span className="flex-grow-1">{error}</span>
                            <button type="button" className="btn btn-sm btn-outline-danger" onClick={handleReload}>Thử lại</button>
                        </div>
                    )}

                    {isRouting && (
                        <RoutePanel
                            fromPlace={routeFrom}
                            toPlace={routeTo}
                            route={route}
                            floor={floor}
                            pickTarget={routePickTarget}
                            onPickTargetChange={setPickTarget}
                            onSwap={handleSwapRoute}
                            onClearFrom={() => setRouteFrom(null)}
                            onClearTo={() => setRouteTo(null)}
                            onClose={handleCloseRoute}
                            onFloorChange={handleFloorChange}
                        />
                    )}

                    {/* key = location id: choosing another place creates a fresh (collapsed) panel */}
                    {!isRouting && selectedLocation && (
                        <LocationDetail
                            key={selectedLocation.id}
                            location={selectedLocation}
                            onClose={() => setSelectedId(null)}
                            onRouteFrom={handleRouteFrom}
                            onRouteTo={handleRouteTo}
                        />
                    )}
                </div>

            </section>
        </main>
    );
}

export default App;
