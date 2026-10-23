import { useState } from "react";
import { getLocationType } from "../data/locationTypes";
import { normalizeText } from "../utils/text";

const MAX_RESULTS = 8;

function SearchBox({ locations, onSelect }) {
    const [keyword, setKeyword] = useState("");

    const query = normalizeText(keyword);
    const results = query
        ? locations.filter(location => {
            const type = getLocationType(location.type);
            return normalizeText(`${location.name} ${type.label} ${location.area || ""}`).includes(query);
        }).slice(0, MAX_RESULTS)
        : [];

    const handleSelect = (location) => {
        setKeyword("");
        onSelect(location);
    };

    const handleKeyDown = (e) => {
        if (e.key === "Escape") setKeyword("");
    };

    return (
        <div className="search-box">
            <div className="input-group shadow-sm">
                <span className="input-group-text bg-white"><i className="bi bi-search" /></span>
                <input
                    type="search"
                    className="form-control"
                    placeholder="Tìm cửa ra máy bay, WC, cà phê…"
                    aria-label="Tìm địa điểm"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    onKeyDown={handleKeyDown}
                />
            </div>

            {query && (
                <div className="search-results list-group shadow">
                    {results.length === 0 && <div className="list-group-item text-muted">Không tìm thấy địa điểm</div>}

                    {results.map(location => {
                        const type = getLocationType(location.type);
                        return (
                            <button type="button" key={location.id} className="list-group-item list-group-item-action d-flex align-items-center gap-2" onClick={() => handleSelect(location)}>
                                <i className={`bi ${type.icon} text-secondary`} />
                                <span>
                                    {location.name}
                                    <small className="d-block text-muted">{type.label} · Tầng {location.floor}</small>
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default SearchBox;
