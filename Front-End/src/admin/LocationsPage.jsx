import { useEffect, useState } from "react";
import MapView from "../components/MapView";
import LocationEditor from "./LocationEditor";
import LocationsTable from "./LocationsTable";
import { getGroup, getLocationType, typeGroups } from "../data/locationTypes";
import { airportFloors, airportTerminals } from "../data/airportCatalog";
import { floorLabel, normalizeText } from "../utils/text";

const TERMINALS = airportTerminals.filter(item => item.id !== "SGN_CAMPUS");
const firstFloor = (terminal) => airportFloors.find(item => item.terminal === terminal)?.id ?? 0;
const positionOf = (location) => ({ terminal: location.terminal, floor: location.floor, lat: location.lat, lng: location.lng, x: location.x, y: location.y });

// "Địa điểm": the map is the workspace.
//   left  = the locations of the floor on screen (search covers every terminal), "Thêm địa điểm"
//   map   = click a marker to edit it; when placing, click the floor plan to put the location there
//   right = the editor of the selected location (LocationEditor), only while editing
// "Bảng" switches to a table of every location (LocationsTable); a row opens it here on the map.
// URL: ?edit=<id> opens a location, ?view=table opens the table, ?terminal=T2&floor=0 picks the floor.
function LocationsPage({ locations, params, onLocationsChange }) {
    const linked = locations.find(location => location.id === Number(params.get("edit"))) || null;
    const [view, setView] = useState(params.get("view") === "table" ? "table" : "map");
    const [terminal, setTerminal] = useState(linked?.terminal || (TERMINALS.some(item => item.id === params.get("terminal")) ? params.get("terminal") : "T1"));
    const [floor, setFloor] = useState(linked?.floor ?? (params.get("floor") != null ? Number(params.get("floor")) : firstFloor(terminal)));
    const [editing, setEditing] = useState(linked);        // location, "new", or null
    const [position, setPosition] = useState(linked ? positionOf(linked) : null);
    const [isPlacing, setIsPlacing] = useState(false);
    const [query, setQuery] = useState("");
    const [group, setGroup] = useState("all");
    const [notice, setNotice] = useState("");

    const isEditing = editing !== null;
    const editingLocation = editing === "new" ? null : editing;

    const setUrl = (search) => window.history.replaceState(null, "", `/admin/locations${search}`);

    // Esc stops placing (the location keeps its previous position)
    useEffect(() => {
        if (!isPlacing) return;
        const handleKeyDown = (event) => {
            if (event.key === "Escape") setIsPlacing(false);
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isPlacing]);

    const showFloor = (newTerminal, newFloor) => {
        setTerminal(newTerminal);
        setFloor(newFloor);
    };

    const openLocation = (location) => {
        setView("map");
        showFloor(location.terminal, location.floor);
        setEditing(location);
        setPosition(positionOf(location));
        setIsPlacing(false);
        setNotice("");
        setUrl(`?edit=${location.id}`);
    };

    const startNew = () => {
        setView("map");
        setEditing("new");
        setPosition(null);
        setIsPlacing(true);
        setNotice("");
        setUrl("");
    };

    const closeEditor = () => {
        setEditing(null);
        setPosition(null);
        setIsPlacing(false);
        setUrl("");
    };

    const handlePlace = (point) => {
        setPosition({ terminal: point.terminal, floor: point.floor, lat: point.lat, lng: point.lng });
        setIsPlacing(false);
    };

    const handleSaved = (saved, isNew) => {
        onLocationsChange(isNew ? [...locations, saved] : locations.map(item => (item.id === saved.id ? saved : item)));
        setNotice(isNew ? `Đã thêm “${saved.name}”.` : `Đã lưu “${saved.name}”.`);
        closeEditor();
    };

    const handleDeleted = (deleted) => {
        onLocationsChange(locations.filter(item => item.id !== deleted.id));
        setNotice(`Đã xóa “${deleted.name}”.`);
        closeEditor();
    };

    const switchView = (newView) => {
        setView(newView);
        if (newView === "table") {
            closeEditor();
            setUrl("?view=table");
        } else {
            setUrl("");
        }
    };

    const viewSwitch = (
        <div className="segmented" role="group" aria-label="Cách xem">
            <button type="button" className={view === "map" ? "is-active" : ""} aria-pressed={view === "map"} onClick={() => switchView("map")}><i className="bi bi-map me-1" />Bản đồ</button>
            <button type="button" className={view === "table" ? "is-active" : ""} aria-pressed={view === "table"} onClick={() => switchView("table")}><i className="bi bi-table me-1" />Bảng</button>
        </div>
    );

    if (view === "table") {
        return <LocationsTable locations={locations} params={params} notice={notice} onOpen={openLocation} onAdd={startNew} viewSwitch={viewSwitch} />;
    }

    // Left list: the floor on screen; a search looks through every terminal
    const words = normalizeText(query).split(/\s+/).filter(Boolean);
    const inGroup = (location) => group === "all" || getLocationType(location.type).group === group;
    const listed = locations
        .filter(location => (words.length > 0 || (location.terminal === terminal && location.floor === floor)) && inGroup(location))
        .filter(location => {
            if (words.length === 0) return true;
            const text = normalizeText(`${location.name} ${getLocationType(location.type).label} ${location.area || ""} ${location.id}`);
            return words.every(word => text.includes(word));
        })
        .sort((a, b) => a.name.localeCompare(b.name, "vi", { numeric: true }));
    const floorLocations = locations.filter(location => location.terminal === terminal && location.floor === floor);
    const floors = airportFloors.filter(item => item.terminal === terminal);

    // The pin of the location being edited, where it is now (moved or new) and not yet saved
    const isMoved = position && (!editingLocation || position.lat !== editingLocation.lat || position.lng !== editingLocation.lng || position.floor !== editingLocation.floor);

    return (
        <div className={`locations-workspace ${isEditing ? "has-editor" : ""}`}>
            <aside className="locations-list" aria-label="Danh sách địa điểm">
                <header>
                    <div className="d-flex align-items-center justify-content-between gap-2">
                        <h1>Địa điểm</h1>
                        {viewSwitch}
                    </div>
                    <button type="button" className="btn btn-dark w-100" onClick={startNew} disabled={isPlacing && editing === "new"}>
                        <i className="bi bi-plus-lg me-1" />Thêm địa điểm
                    </button>
                    <div className="filter-search">
                        <i className="bi bi-search" aria-hidden="true" />
                        <input type="search" className="form-control" placeholder="Tìm ở mọi nhà ga" aria-label="Tìm địa điểm" value={query} onChange={(e) => setQuery(e.target.value)} />
                    </div>
                    <select className="form-select" aria-label="Lọc theo nhóm" value={group} onChange={(e) => setGroup(e.target.value)}>
                        {typeGroups.map(item => <option key={item.id} value={item.id}>{item.id === "all" ? "Mọi nhóm" : item.label}</option>)}
                    </select>
                    <p className="list-meta">
                        {words.length > 0 ? `${listed.length} kết quả ở mọi nhà ga` : `${listed.length} địa điểm ở ${floorLabel(floor).toLowerCase()} ${terminal}`}
                    </p>
                    {notice && <p className="list-notice" role="status"><i className="bi bi-check2 me-1" />{notice}</p>}
                </header>

                <ul className="list-items">
                    {listed.map(location => {
                        const type = getLocationType(location.type);
                        return (
                            <li key={location.id}>
                                <button type="button" className={editingLocation?.id === location.id ? "is-open" : ""} onClick={() => openLocation(location)}>
                                    <span className="type-dot is-small" style={{ background: getGroup(type.group).color }}><i className={`bi ${type.icon}`} aria-hidden="true" /></span>
                                    <span className="min-w-0">
                                        <span className="d-block text-truncate">{location.name}</span>
                                        <small>{words.length > 0 ? `${location.terminal}, ${floorLabel(location.floor)}` : type.label}</small>
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </aside>

            <section className={`locations-map ${isPlacing ? "is-placing" : ""}`} aria-label="Bản đồ địa điểm">
                <MapView
                    terminal={terminal}
                    onTerminalChange={(value) => showFloor(value, firstFloor(value))}
                    floor={floor}
                    onFloorChange={(value) => setFloor(value)}
                    locations={floorLocations}
                    selectedLocation={editingLocation}
                    onSelect={(location) => !isPlacing && openLocation(location)}
                    onMapClick={isPlacing ? handlePlace : null}
                    previewPoint={isMoved ? position : null}
                />

                <div className="map-switch">
                    <select className="form-select form-select-sm" aria-label="Nhà ga" value={terminal} onChange={(e) => showFloor(e.target.value, firstFloor(e.target.value))}>
                        {TERMINALS.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                    <div className="segmented" role="group" aria-label="Tầng">
                        {floors.map(item => (
                            <button type="button" key={item.id} className={item.id === floor ? "is-active" : ""} aria-pressed={item.id === floor} title={item.name} onClick={() => setFloor(item.id)}>
                                {floorLabel(item.id)}
                            </button>
                        ))}
                    </div>
                </div>

                {isPlacing && (
                    <div className="placing-banner" role="status">
                        <i className="bi bi-crosshair" aria-hidden="true" />
                        <span>Bấm vào mặt bằng để đặt {editing === "new" ? "địa điểm mới" : `“${editingLocation.name}”`}</span>
                        <button type="button" className="btn btn-sm btn-light" onClick={() => (editing === "new" && !position ? closeEditor() : setIsPlacing(false))}>Hủy</button>
                    </div>
                )}
            </section>

            {isEditing && (
                <LocationEditor
                    key={editingLocation ? editingLocation.id : "new"}
                    location={editingLocation}
                    position={position}
                    isPlacing={isPlacing}
                    onStartPlacing={() => setIsPlacing(true)}
                    onSaved={handleSaved}
                    onDeleted={handleDeleted}
                    onClose={closeEditor}
                />
            )}
        </div>
    );
}

export default LocationsPage;
