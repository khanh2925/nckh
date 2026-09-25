import { useEffect, useMemo, useState } from "react";
import Header from "./components/Header";
import MapView from "./components/MapView";
import SearchBox from "./components/SearchBox";
import CategoryFilter from "./components/CategoryFilter";
import LocationDetail from "./components/LocationDetail";
import RoutePanel from "./components/RoutePanel";
import AdminPanel from "./components/AdminPanel";
import { getLocations } from "./api/locationApi";
import { getLocationType } from "./data/locationTypes";
import { findRoute } from "./utils/routing";

function App() {
    const [locations, setLocations] = useState([]);
    const [error, setError] = useState("");
    const [reloadCount, setReloadCount] = useState(0);

    const [floor, setFloor] = useState(1);
    const [activeGroup, setActiveGroup] = useState("all");
    const [selectedId, setSelectedId] = useState(null);

    // Directions
    const [isRouting, setIsRouting] = useState(false);
    const [routeFromId, setRouteFromId] = useState(null);
    const [routeToId, setRouteToId] = useState(null);

    // Admin: editingId = location id, "new" (adding) or null (showing the list)
    const [role, setRole] = useState("user");
    const [editingId, setEditingId] = useState(null);
    const [isPicking, setIsPicking] = useState(false);
    const [pickedPoint, setPickedPoint] = useState(null);

    // Runs on first render, and again every time "Thử lại" increases reloadCount
    useEffect(() => {
        getLocations()
            .then(data => {
                setLocations(data);
                setError("");
            })
            .catch(err => {
                console.error(err);
                setError("Không kết nối được backend (cổng 8080).");
            });
    }, [reloadCount]);

    const isAdmin = role === "admin";
    const findById = (id) => locations.find(location => location.id === id) || null;
    const isInGroup = (location, groupId) => groupId === "all" || getLocationType(location.type).group === groupId;

    // Derived data: calculated from state on every render, not stored in state
    const selectedLocation = findById(selectedId);
    const routeFrom = findById(routeFromId);
    const routeTo = findById(routeToId);
    const editingLocation = editingId === "new" ? null : findById(editingId);

    // useMemo: only search for a new path when the start or the end changes
    const route = useMemo(
        () => (routeFrom && routeTo && routeFrom.id !== routeTo.id ? findRoute(routeFrom, routeTo) : null),
        [routeFrom, routeTo]
    );

    // Places that must stay visible even when the filter hides their group
    const pinnedIds = [selectedId, routeFromId, routeToId, editingId];
    const visibleLocations = locations.filter(location =>
        location.floor === floor && (isInGroup(location, activeGroup) || pinnedIds.includes(location.id))
    );

    // ---------- Selecting a place (marker click or search result) ----------
    const handleSelect = (location) => {
        if (isPicking) return;   // the admin is choosing a point, ignore marker clicks
        if (isAdmin) {
            handleEdit(location.id);
        } else if (isRouting) {
            handleRoutePick(location);
        } else {
            setSelectedId(location.id);
            setFloor(location.floor);
        }
    };

    const handleFloorChange = (newFloor) => {
        setFloor(newFloor);
        if (selectedLocation && selectedLocation.floor !== newFloor) setSelectedId(null);
    };

    const handleGroupChange = (groupId) => {
        setActiveGroup(groupId);
        if (selectedLocation && !isInGroup(selectedLocation, groupId)) setSelectedId(null);
    };

    // ---------- Directions ----------
    const handleRouteFrom = (location) => {
        setIsRouting(true);
        setRouteFromId(location.id);
        setRouteToId(null);
        setSelectedId(null);
    };

    const handleRouteTo = (location) => {
        setIsRouting(true);
        setRouteToId(location.id);
        setRouteFromId(null);
        setSelectedId(null);
    };

    // While directions are open, a clicked place fills the missing end.
    // When both ends exist, a new click replaces the destination.
    const handleRoutePick = (location) => {
        if (!routeFrom) {
            setRouteFromId(location.id);
            setFloor(location.floor);
        } else if (location.id !== routeFrom.id) {
            setRouteToId(location.id);
            setFloor(routeFrom.floor);   // the route is shown from its start
        }
    };

    const handleSwapRoute = () => {
        setRouteFromId(routeToId);
        setRouteToId(routeFromId);
        if (routeTo) setFloor(routeTo.floor);
    };

    const handleCloseRoute = () => {
        setIsRouting(false);
        setRouteFromId(null);
        setRouteToId(null);
    };

    // ---------- Admin ----------
    const handleRoleChange = (newRole) => {
        setRole(newRole);
        setSelectedId(null);
        handleCloseRoute();
        handleCancelEdit();
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
        setPickedPoint({ ...point, floor });
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

    return (
        <main className="app-shell">
            <Header floor={floor} onFloorChange={handleFloorChange} role={role} onRoleChange={handleRoleChange} />

            <section className={`map-shell ${isAdmin ? "is-admin" : ""}`} aria-label="Bản đồ nhà ga T1">
                <MapView
                    floor={floor}
                    locations={visibleLocations}
                    selectedLocation={isAdmin ? editingLocation : selectedLocation}
                    onSelect={handleSelect}
                    isPicking={isPicking}
                    onPickPoint={handlePickPoint}
                    previewPoint={pickedPoint}
                    route={route}
                    onFloorChange={handleFloorChange}
                />

                <div className="map-top">
                    <SearchBox locations={locations} onSelect={handleSelect} />
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
                            fromLocation={routeFrom}
                            toLocation={routeTo}
                            route={route}
                            floor={floor}
                            onSwap={handleSwapRoute}
                            onClearFrom={() => setRouteFromId(null)}
                            onClearTo={() => setRouteToId(null)}
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
                        locations={locations}
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
                    />
                )}
            </section>
        </main>
    );
}

export default App;
