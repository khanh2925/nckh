import { useEffect, useState } from "react";
import Header from "./components/Header";
import MapView from "./components/MapView";
import SearchBox from "./components/SearchBox";
import CategoryFilter from "./components/CategoryFilter";
import LocationDetail from "./components/LocationDetail";
import AdminForm from "./components/AdminForm";
import { getLocations } from "./api/locationApi";
import { getLocationType } from "./data/locationTypes";

function App() {
    const [locations, setLocations] = useState([]);
    const [error, setError] = useState("");
    const [reloadCount, setReloadCount] = useState(0);

    const [floor, setFloor] = useState(1);
    const [activeGroup, setActiveGroup] = useState("all");
    const [selectedId, setSelectedId] = useState(null);

    const [role, setRole] = useState("user");
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

    const isInGroup = (location, groupId) => groupId === "all" || getLocationType(location.type).group === groupId;

    // Derived data: calculated from state on every render, not stored in state
    const selectedLocation = locations.find(location => location.id === selectedId) || null;
    const visibleLocations = locations.filter(location => location.floor === floor && isInGroup(location, activeGroup));

    const handleSelect = (location) => {
        setSelectedId(location.id);
        setFloor(location.floor);
        // The chosen place is hidden by the current filter -> show everything again
        if (!isInGroup(location, activeGroup)) setActiveGroup("all");
    };

    const handleFloorChange = (newFloor) => {
        setFloor(newFloor);
        if (selectedLocation && selectedLocation.floor !== newFloor) setSelectedId(null);
    };

    const handleGroupChange = (groupId) => {
        setActiveGroup(groupId);
        if (selectedLocation && !isInGroup(selectedLocation, groupId)) setSelectedId(null);
    };

    const handleRoleChange = (newRole) => {
        setRole(newRole);
        setIsPicking(false);
        setPickedPoint(null);
    };

    const handleStartPick = (pickFloor) => {
        setFloor(pickFloor);
        setSelectedId(null);
        setPickedPoint(null);
        setIsPicking(true);
    };

    const handlePickPoint = (point) => {
        setPickedPoint(point);
        setIsPicking(false);
    };

    const handleSaved = (newLocation) => {
        setLocations([...locations, newLocation]);
        setPickedPoint(null);
        handleSelect(newLocation);
    };

    return (
        <main className="app-shell">
            <Header floor={floor} onFloorChange={handleFloorChange} role={role} onRoleChange={handleRoleChange} />

            <section className={`map-shell ${role === "admin" ? "is-admin" : ""}`} aria-label="Bản đồ nhà ga T1">
                <MapView
                    floor={floor}
                    locations={visibleLocations}
                    selectedLocation={selectedLocation}
                    onSelect={handleSelect}
                    isPicking={isPicking}
                    onPickPoint={handlePickPoint}
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

                    {/* key = location id: choosing another place creates a fresh (collapsed) panel */}
                    {selectedLocation && (
                        <LocationDetail key={selectedLocation.id} location={selectedLocation} onClose={() => setSelectedId(null)} />
                    )}
                </div>

                {role === "admin" && (
                    <AdminForm pickedPoint={pickedPoint} isPicking={isPicking} onStartPick={handleStartPick} onSaved={handleSaved} />
                )}
            </section>
        </main>
    );
}

export default App;
