import { useEffect, useMemo, useState } from "react";
import Header from "./components/Header";
import MapView from "./components/MapView";
import SearchBox from "./components/SearchBox";
import CategoryFilter from "./components/CategoryFilter";
import LocationDetail from "./components/LocationDetail";
import RoutePanel from "./components/RoutePanel";
import AdminPanel from "./components/AdminPanel";
import WalkwayPanel from "./components/WalkwayPanel";
import { getLocations, isStaticMode } from "./api/locationApi";
import { getWalkways } from "./api/walkwayApi";
import { getLocationType } from "./data/locationTypes";
import { findRoute } from "./utils/routing";
import { airportFloors } from "./data/airportCatalog";
import { useWalkwayEditor } from "./hooks/useWalkwayEditor";

const EMPTY_WALKWAYS = { nodes: [], edges: [] };

function App() {
    const [locations, setLocations] = useState([]);
    const [walkways, setWalkways] = useState(EMPTY_WALKWAYS);
    const [error, setError] = useState("");
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

    // Admin: adminTab = "locations" | "walkways"; editingId = location id, "new" (adding) or null (showing the list)
    const [role, setRole] = useState("user");
    const [adminTab, setAdminTab] = useState("locations");
    const [editingId, setEditingId] = useState(null);
    const [isPicking, setIsPicking] = useState(false);
    const [pickedPoint, setPickedPoint] = useState(null);

    const walkwayEditor = useWalkwayEditor({ terminal, floor, onSaved: setWalkways });

    // Runs on first render, and again every time "Thử lại" increases reloadCount.
    // allSettled: the map still shows the locations even if the walkways fail to load.
    useEffect(() => {
        Promise.allSettled([getLocations(), getWalkways()]).then(([locationResult, walkwayResult]) => {
            if (locationResult.status === "fulfilled") setLocations(locationResult.value);
            if (walkwayResult.status === "fulfilled") setWalkways(walkwayResult.value);

            if (locationResult.status === "rejected") {
                console.error(locationResult.reason);
                setError(isStaticMode ? "Không tải được dữ liệu địa điểm." : "Không kết nối được backend (cổng 8080).");
            } else if (walkwayResult.status === "rejected") {
                console.error(walkwayResult.reason);
                setError("Không tải được lối đi nên chưa thể chỉ đường.");
            } else {
                setError("");
            }
        });
    }, [reloadCount]);

    const isAdmin = role === "admin";
    const isEditingWalkways = isAdmin && adminTab === "walkways" && walkwayEditor.isEditing;
    const findById = (id) => locations.find(location => location.id === id) || null;
    const isInGroup = (location, groupId) => groupId === "all" || getLocationType(location.type).group === groupId;

    // Derived data: calculated from state on every render, not stored in state
    const selectedLocation = findById(selectedId);
    const editingLocation = editingId === "new" ? null : findById(editingId);
    // Which end the next click on the map fills: the one chosen with the crosshair, otherwise the missing one
    const routePickTarget = !isRouting ? null : pickTarget || (!routeFrom ? "from" : !routeTo ? "to" : null);

    // While the admin is drawing, directions use the unsaved drawing, so it can be tested before saving
    const routeNetwork = walkwayEditor.draft || walkways;
    // useMemo: only search for a new path when the ends or the network change
    const route = useMemo(
        () => (routeFrom && routeTo && routeFrom.id !== routeTo.id ? findRoute(routeNetwork, routeFrom, routeTo) : null),
        [routeNetwork, routeFrom, routeTo]
    );

    // Places that must stay visible even when the filter hides their group
    const pinnedIds = [selectedId, routeFrom?.id, routeTo?.id, editingId];
    const visibleLocations = locations.filter(location =>
        location.terminal === terminal && location.floor === floor && (isInGroup(location, activeGroup) || pinnedIds.includes(location.id))
    );

    // ---------- Selecting a place (marker click or search result) ----------
    const handleSelect = (location) => {
        if (isPicking) return;   // the admin is choosing a point, ignore marker clicks
        setTerminal(location.terminal);
        setFloor(location.floor);
        if (isRouting) {
            handleRoutePlace(location);
        } else if (location.catalogOnly && isAdmin) {
            setSelectedId(location.id);
            setRole("user");
        } else if (isAdmin && adminTab === "locations") {
            handleEdit(location.id);
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
        handleCancelEdit();
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

    // ---------- Admin ----------
    const confirmDropWalkways = () => !walkwayEditor.isDirty || window.confirm("Lối đi có thay đổi chưa lưu. Bỏ các thay đổi này?");

    const handleRoleChange = (newRole) => {
        if (!confirmDropWalkways()) return;
        walkwayEditor.stop();
        setAdminTab("locations");
        setRole(newRole);
        setSelectedId(null);
        handleCloseRoute();
        handleCancelEdit();
    };

    const handleAdminTabChange = (tab) => {
        if (tab === adminTab) return;
        if (tab === "walkways") {
            handleCancelEdit();
            walkwayEditor.start(walkways);
        } else {
            if (!confirmDropWalkways()) return;
            walkwayEditor.stop();
        }
        setAdminTab(tab);
    };

    const handleEdit = (id) => {
        const location = findById(id);
        setEditingId(id);
        setPickedPoint(null);
        setIsPicking(false);
        if (location) setFloor(location.floor);
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setPickedPoint(null);
        setIsPicking(false);
    };

    const handleStartPick = (pickFloor) => {
        setFloor(pickFloor);
        setIsPicking(true);
    };

    const handlePickPoint = (point) => {
        setPickedPoint(point);
        setIsPicking(false);
    };

    const handleSaved = (saved, isNew) => {
        setLocations(isNew
            ? [...locations, saved]
            : locations.map(location => (location.id === saved.id ? saved : location)));
        handleCancelEdit();
    };

    const handleDeleted = (id) => {
        setLocations(locations.filter(location => location.id !== id));
        handleCancelEdit();
    };

    // What a click on the floor plan does right now (null = nothing special)
    let handleMapClick = null;
    if (isPicking) handleMapClick = handlePickPoint;
    else if (routePickTarget) handleMapClick = handleRoutePoint;
    else if (isEditingWalkways && !isRouting) handleMapClick = walkwayEditor.handleMapClick;

    // Directions open = the drawing is shown but locked, so clicks pick route ends instead
    const mapWalkwayEditor = isEditingWalkways
        ? {
            network: walkwayEditor.draft,
            tool: walkwayEditor.tool,
            activeId: walkwayEditor.activeId,
            selectedId: walkwayEditor.selectedId,
            isLocked: isRouting,
            onNodeClick: walkwayEditor.handleNodeClick,
            onEdgeClick: walkwayEditor.handleEdgeClick,
            onNodeMove: walkwayEditor.handleNodeMove
        }
        : null;

    return (
        <main className="app-shell">
            <Header terminal={terminal} onTerminalChange={handleTerminalChange} floor={floor} onFloorChange={handleFloorChange} role={role} onRoleChange={handleRoleChange} />

            <section className={`map-shell ${isAdmin ? "is-admin" : ""}`} aria-label="Bản đồ nhà ga">
                <MapView
                    terminal={terminal}
                    onTerminalChange={handleTerminalChange}
                    floor={floor}
                    locations={visibleLocations}
                    selectedLocation={isAdmin && adminTab === "locations" ? editingLocation : selectedLocation}
                    onSelect={handleSelect}
                    onMapClick={handleMapClick}
                    previewPoint={pickedPoint}
                    routeEnds={[routeFrom, routeTo]}
                    route={route}
                    onFloorChange={handleFloorChange}
                    walkwayEditor={mapWalkwayEditor}
                />

                <div className="map-top">
                    <div className="search-row">
                        <SearchBox locations={locations} onSelect={handleSelect} />
                        {!isRouting && (
                            <button type="button" className="btn btn-primary route-open" onClick={handleOpenRoute} aria-label="Chỉ đường" title="Chỉ đường">
                                <i className="bi bi-signpost-2" />
                            </button>
                        )}
                    </div>
                    <CategoryFilter activeGroup={activeGroup} onChange={handleGroupChange} />

                    {error && (
                        <div className="alert alert-danger d-flex align-items-center gap-2 py-2 mb-0" role="alert">
                            <i className="bi bi-exclamation-triangle" />
                            <span className="flex-grow-1">{error}</span>
                            <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setReloadCount(reloadCount + 1)}>Thử lại</button>
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

                {isAdmin && (
                    <AdminPanel
                        tab={adminTab}
                        onTabChange={handleAdminTabChange}
                        terminal={terminal}
                        locations={locations.filter(item => item.terminal === terminal)}
                        floor={floor}
                        editingLocation={editingLocation}
                        isCreating={editingId === "new"}
                        pickedPoint={pickedPoint}
                        isPicking={isPicking}
                        onEdit={handleEdit}
                        onCreate={() => handleEdit("new")}
                        onCancel={handleCancelEdit}
                        onStartPick={handleStartPick}
                        onSaved={handleSaved}
                        onDeleted={handleDeleted}
                    >
                        {walkwayEditor.isEditing && <WalkwayPanel editor={walkwayEditor} terminal={terminal} floor={floor} />}
                    </AdminPanel>
                )}
            </section>
        </main>
    );
}

export default App;
