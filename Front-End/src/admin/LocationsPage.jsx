import { useMemo, useState } from "react";
import LocationEditor from "./LocationEditor";
import { getGroup, getLocationType, locationTypes, typeGroups } from "../data/locationTypes";
import { airportFloors, airportTerminals } from "../data/airportCatalog";
import { floorLabel, normalizeText, translateHours } from "../utils/text";

const PAGE_SIZE = 50;
const COLUMNS = [
    { key: "name", label: "Tên" },
    { key: "type", label: "Loại" },
    { key: "terminal", label: "Ga" },
    { key: "floor", label: "Tầng", isNumber: true },
    // optional: hidden while the editor drawer is open, so the table stays readable
    { key: "area", label: "Khu vực", optional: true },
    { key: "openingHours", label: "Giờ mở cửa", sortable: false, optional: true }
];

const sortValue = {
    name: location => location.name,
    type: location => getLocationType(location.type).label,
    terminal: location => location.terminal,
    floor: location => location.floor,
    area: location => location.area || "￿"   // empty last
};

// "Địa điểm": every location in a table. Search, filter, sort, then click a row to edit it in the side drawer.
// URL ?edit=<id> opens that location directly (links from "Kiểm tra dữ liệu").
function LocationsPage({ locations, params, onLocationsChange }) {
    const [query, setQuery] = useState("");
    const [terminal, setTerminal] = useState(params.get("terminal") || "all");
    const [floor, setFloor] = useState(params.get("floor") ?? "all");
    const [type, setType] = useState("all");
    const [sort, setSort] = useState({ key: "name", direction: 1 });
    const [pageIndex, setPageIndex] = useState(0);
    const [editing, setEditing] = useState(() => {
        const id = Number(params.get("edit"));
        return id ? locations.find(location => location.id === id) || null : null;
    });
    const [isAdding, setIsAdding] = useState(false);
    const [notice, setNotice] = useState("");

    const floors = terminal === "all" ? [] : airportFloors.filter(item => item.terminal === terminal);

    const rows = useMemo(() => {
        const words = normalizeText(query).split(/\s+/).filter(Boolean);
        const filtered = locations.filter(location => {
            if (terminal !== "all" && location.terminal !== terminal) return false;
            if (floor !== "all" && location.floor !== Number(floor)) return false;
            if (type !== "all" && location.type !== type && !(type.startsWith("group:") && getLocationType(location.type).group === type.slice(6))) return false;
            if (words.length === 0) return true;
            const text = normalizeText(`${location.name} ${getLocationType(location.type).label} ${location.area || ""} ${location.id}`);
            return words.every(word => text.includes(word));
        });
        const value = sortValue[sort.key];
        return filtered.sort((a, b) => {
            const x = value(a), y = value(b);
            const order = typeof x === "number" ? x - y : String(x).localeCompare(String(y), "vi", { numeric: true });
            return order * sort.direction || a.name.localeCompare(b.name, "vi", { numeric: true });
        });
    }, [locations, query, terminal, floor, type, sort]);

    const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    const page = Math.min(pageIndex, pageCount - 1);
    const visible = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    const hasFilter = query || terminal !== "all" || floor !== "all" || type !== "all";

    // Any filter change starts again from the first page
    const filterBy = (setter) => (value) => {
        setter(value);
        setPageIndex(0);
    };
    const changeQuery = filterBy(setQuery);
    const changeTerminal = filterBy((value) => {
        setTerminal(value);
        setFloor("all");
    });
    const changeFloor = filterBy(setFloor);
    const changeType = filterBy(setType);

    const openEditor = (location) => {
        setIsAdding(false);
        setEditing(location);
        window.history.replaceState(null, "", location ? `/admin/locations?edit=${location.id}` : "/admin/locations");
    };

    const closeEditor = () => {
        setEditing(null);
        setIsAdding(false);
        window.history.replaceState(null, "", "/admin/locations");
    };

    const handleSort = (key) => setSort(current => ({ key, direction: current.key === key ? -current.direction : 1 }));

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

    const clearFilters = () => {
        setQuery("");
        setTerminal("all");
        setFloor("all");
        setType("all");
        setPageIndex(0);
    };

    return (
        <div className={`admin-page ${editing || isAdding ? "has-editor" : ""}`}>
            <header className="page-head">
                <div>
                    <h1>Địa điểm</h1>
                    <p>{locations.length} địa điểm trong dữ liệu. Bấm một dòng để sửa.</p>
                </div>
                <button type="button" className="btn btn-dark" onClick={() => { setEditing(null); setIsAdding(true); }}>
                    <i className="bi bi-plus-lg me-1" />Thêm địa điểm
                </button>
            </header>

            <div className="filters" role="search">
                <div className="filter-search">
                    <i className="bi bi-search" aria-hidden="true" />
                    <input type="search" className="form-control" placeholder="Tìm theo tên, loại, khu vực hoặc mã" aria-label="Tìm địa điểm" value={query} onChange={(e) => changeQuery(e.target.value)} />
                </div>
                <select className="form-select" aria-label="Lọc theo nhà ga" value={terminal} onChange={(e) => changeTerminal(e.target.value)}>
                    <option value="all">Mọi nhà ga</option>
                    {airportTerminals.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                <select className="form-select" aria-label="Lọc theo tầng" value={floor} onChange={(e) => changeFloor(e.target.value)} disabled={terminal === "all"}>
                    <option value="all">{terminal === "all" ? "Chọn ga để lọc tầng" : "Mọi tầng"}</option>
                    {floors.map(item => <option key={item.id} value={item.id}>{floorLabel(item.id)}</option>)}
                </select>
                <select className="form-select" aria-label="Lọc theo loại" value={type} onChange={(e) => changeType(e.target.value)}>
                    <option value="all">Mọi loại</option>
                    {typeGroups.filter(group => group.id !== "all").map(group => (
                        <optgroup key={group.id} label={group.label}>
                            <option value={`group:${group.id}`}>Cả nhóm {group.label.toLowerCase()}</option>
                            {Object.entries(locationTypes).filter(([, item]) => item.group === group.id).map(([key, item]) => (
                                <option key={key} value={key}>{item.label}</option>
                            ))}
                        </optgroup>
                    ))}
                </select>
                {hasFilter && <button type="button" className="btn btn-link btn-sm" onClick={clearFilters}>Bỏ lọc</button>}
            </div>

            <div className="table-meta">
                <span>{rows.length === 0 ? "Không có địa điểm nào khớp." : `${page * PAGE_SIZE + 1}–${page * PAGE_SIZE + visible.length} trong ${rows.length} địa điểm`}</span>
                {notice && <span className="table-notice" role="status"><i className="bi bi-check2 me-1" />{notice}</span>}
            </div>

            <div className="table-wrap">
                <table className="data-table">
                    <thead>
                        <tr>
                            {COLUMNS.map(column => (
                                <th key={column.key} scope="col" className={[column.isNumber && "num", column.optional && "col-optional"].filter(Boolean).join(" ") || undefined} aria-sort={sort.key === column.key ? (sort.direction > 0 ? "ascending" : "descending") : undefined}>
                                    {column.sortable === false ? column.label : (
                                        <button type="button" onClick={() => handleSort(column.key)}>
                                            {column.label}
                                            <i className={`bi ${sort.key !== column.key ? "bi-arrow-down-up is-idle" : sort.direction > 0 ? "bi-arrow-up" : "bi-arrow-down"}`} aria-hidden="true" />
                                        </button>
                                    )}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {visible.map(location => {
                            const locationType = getLocationType(location.type);
                            const isOpen = editing?.id === location.id;
                            return (
                                <tr key={location.id} className={isOpen ? "is-open" : ""} onClick={() => openEditor(location)}
                                    tabIndex={0} onKeyDown={(e) => e.key === "Enter" && openEditor(location)} aria-label={`Sửa ${location.name}`}>
                                    <td>
                                        <span className="cell-name">
                                            <span className="type-dot" style={{ background: getGroup(locationType.group).color }}><i className={`bi ${locationType.icon}`} aria-hidden="true" /></span>
                                            <span className="min-w-0">
                                                <span className="d-block text-truncate">{location.name}</span>
                                                <small>Mã {location.id}</small>
                                            </span>
                                        </span>
                                    </td>
                                    <td className="nowrap">{locationType.label}</td>
                                    <td>{location.terminal === "SGN_CAMPUS" ? "Khuôn viên" : location.terminal}</td>
                                    <td className="num nowrap">{floorLabel(location.floor)}</td>
                                    <td className="muted col-optional">{location.area || "—"}</td>
                                    <td className="muted col-optional">{location.openingHours ? translateHours(location.openingHours) : "—"}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {pageCount > 1 && (
                <nav className="pager" aria-label="Phân trang">
                    <button type="button" className="btn btn-light btn-sm" disabled={page === 0} onClick={() => setPageIndex(page - 1)}><i className="bi bi-chevron-left" /> Trước</button>
                    <span>Trang {page + 1} / {pageCount}</span>
                    <button type="button" className="btn btn-light btn-sm" disabled={page >= pageCount - 1} onClick={() => setPageIndex(page + 1)}>Sau <i className="bi bi-chevron-right" /></button>
                </nav>
            )}

            {(editing || isAdding) && (
                <LocationEditor
                    key={editing ? editing.id : "new"}
                    location={editing}
                    defaults={{ terminal: terminal !== "all" && terminal !== "SGN_CAMPUS" ? terminal : "T1", floor: floor !== "all" ? Number(floor) : 1 }}
                    onSaved={handleSaved}
                    onDeleted={handleDeleted}
                    onClose={closeEditor}
                />
            )}
        </div>
    );
}

export default LocationsPage;
