import { useState } from "react";
import { getLocationType } from "../data/locationTypes";
import { floorLabel, normalizeText } from "../utils/text";

const MAX_RESULTS = 8;

// terminal / floor: what the user is looking at, so matches there are listed first
function SearchBox({ locations, onSelect, terminal, floor }) {
    const [keyword, setKeyword] = useState("");
    const [isOpen, setIsOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);   // result highlighted by the arrow keys

    const query = normalizeText(keyword);
    // Same terminal first, then same floor; Array.sort is stable, so the original order is kept otherwise
    const closeness = location => (location.terminal === terminal ? 0 : 2) + (location.floor === floor ? 0 : 1);
    const results = query
        ? locations
            .filter(location => {
                const type = getLocationType(location.type);
                return normalizeText(`${location.name} ${type.label} ${location.area || ""}`).includes(query);
            })
            .sort((a, b) => closeness(a) - closeness(b))
            .slice(0, MAX_RESULTS)
        : [];
    const showResults = isOpen && query !== "";

    const handleChange = (e) => {
        setKeyword(e.target.value);
        setActiveIndex(0);
        setIsOpen(true);
    };

    const handleSelect = (location) => {
        setKeyword("");
        setIsOpen(false);
        onSelect(location);
    };

    // ↑ ↓ move through the results, Enter opens the highlighted one, Esc closes the list
    const handleKeyDown = (e) => {
        if (e.key === "Escape") {
            setKeyword("");
            setIsOpen(false);
        } else if (e.key === "ArrowDown" && results.length > 0) {
            e.preventDefault();
            setIsOpen(true);
            setActiveIndex((activeIndex + 1) % results.length);
        } else if (e.key === "ArrowUp" && results.length > 0) {
            e.preventDefault();
            setActiveIndex((activeIndex - 1 + results.length) % results.length);
        } else if (e.key === "Enter" && showResults && results[activeIndex]) {
            e.preventDefault();
            handleSelect(results[activeIndex]);
        }
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
                    role="combobox"
                    aria-expanded={showResults}
                    aria-controls="search-results"
                    aria-activedescendant={showResults && results[activeIndex] ? `search-result-${results[activeIndex].id}` : undefined}
                    autoComplete="off"
                    value={keyword}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    onFocus={() => setIsOpen(true)}
                    onBlur={() => setIsOpen(false)}
                />
            </div>

            {showResults && (
                // preventDefault on mousedown keeps the focus in the input, so blur doesn't close the list before the click
                <div id="search-results" className="search-results list-group shadow" role="listbox" aria-label="Kết quả tìm kiếm" onMouseDown={e => e.preventDefault()}>
                    {results.length === 0 && <div className="list-group-item text-muted">Không tìm thấy địa điểm</div>}

                    {results.map((location, index) => {
                        const type = getLocationType(location.type);
                        return (
                            <button
                                type="button"
                                key={location.id}
                                id={`search-result-${location.id}`}
                                role="option"
                                aria-selected={index === activeIndex}
                                className={`list-group-item list-group-item-action d-flex align-items-center gap-2 ${index === activeIndex ? "is-active" : ""}`}
                                onClick={() => handleSelect(location)}
                                onMouseEnter={() => setActiveIndex(index)}
                            >
                                <i className={`bi ${type.icon} text-secondary`} />
                                <span className="min-w-0">
                                    {location.name}
                                    <small className="d-block text-muted text-truncate">
                                        {type.label} · Ga {location.terminal} · {floorLabel(location.floor)}{location.area ? ` · ${location.area}` : ""}
                                    </small>
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
