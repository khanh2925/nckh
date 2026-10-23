import { floorLabel } from "../utils/text";

// One row of the panel: the chosen place, a "pick on the map" button and a clear button
function RouteEnd({ icon, place, placeholder, isPicking, onPick, onClear, pickLabel, clearLabel }) {
    return (
        <div className={`route-point ${isPicking ? "is-picking" : ""}`}>
            <i className={icon} />
            <span className={place ? "" : "text-muted"}>
                {place ? place.name : placeholder}
                {place?.isPoint && <small className="text-muted"> · {floorLabel(place.floor)}</small>}
            </span>
            <button type="button" className={`btn btn-sm route-pick ${isPicking ? "btn-primary" : "btn-light"}`} onClick={onPick} aria-pressed={isPicking} aria-label={pickLabel} title={pickLabel}>
                <i className="bi bi-crosshair" />
            </button>
            {place && (
                <button type="button" className="btn btn-link btn-sm p-0 text-secondary" onClick={onClear} aria-label={clearLabel}>
                    <i className="bi bi-x-circle-fill" />
                </button>
            )}
        </div>
    );
}

// fromPlace / toPlace: a location, or a point picked on the map ({ isPoint: true, name, terminal, floor, lat, lng })
// pickTarget: "from" | "to" | null = which end the next click on the map fills
function RoutePanel({ fromPlace, toPlace, route, floor, pickTarget, onPickTargetChange, onSwap, onClearFrom, onClearTo, onClose, onFloorChange }) {
    const isSamePlace = fromPlace && toPlace && fromPlace.id === toPlace.id;
    const pickText = pickTarget === "from" ? "điểm xuất phát" : "điểm đến";

    return (
        <aside className="route-panel" aria-label="Chỉ đường">
            <div className="d-flex align-items-center mb-2">
                <strong className="flex-grow-1"><i className="bi bi-signpost-2 me-2" />Chỉ đường</strong>
                <button type="button" className="btn btn-light btn-sm rounded-circle" onClick={onClose} aria-label="Đóng chỉ đường">
                    <i className="bi bi-x-lg" />
                </button>
            </div>

            <div className="d-flex align-items-center gap-2">
                <div className="flex-grow-1 min-w-0">
                    <RouteEnd
                        icon="bi bi-person-walking text-primary"
                        place={fromPlace}
                        placeholder="Chọn điểm xuất phát"
                        isPicking={pickTarget === "from"}
                        onPick={() => onPickTargetChange(pickTarget === "from" ? null : "from")}
                        onClear={onClearFrom}
                        pickLabel="Chọn điểm xuất phát trên bản đồ"
                        clearLabel="Chọn lại điểm xuất phát"
                    />
                    <RouteEnd
                        icon="bi bi-geo-alt-fill text-danger"
                        place={toPlace}
                        placeholder="Chọn điểm đến"
                        isPicking={pickTarget === "to"}
                        onPick={() => onPickTargetChange(pickTarget === "to" ? null : "to")}
                        onClear={onClearTo}
                        pickLabel="Chọn điểm đến trên bản đồ"
                        clearLabel="Chọn lại điểm đến"
                    />
                </div>
                <button type="button" className="btn btn-light border btn-sm" onClick={onSwap} aria-label="Đảo chiều" title="Đảo chiều">
                    <i className="bi bi-arrow-down-up" />
                </button>
            </div>

            {pickTarget && (
                <p className="small text-primary mt-2 mb-0">
                    <i className="bi bi-hand-index me-1" />
                    Chạm vào vị trí bất kỳ trên mặt bằng, vào một địa điểm, hoặc dùng ô tìm kiếm để chọn {pickText}.
                </p>
            )}

            {isSamePlace && <p className="small text-danger mt-2 mb-0">Điểm xuất phát và điểm đến đang trùng nhau.</p>}

            {route?.error && <p className="small text-danger mt-2 mb-0">{route.error}</p>}

            {route?.legs && (
                <div className="mt-3">
                    <div className="route-summary">
                        <strong>{route.minutes} phút</strong>
                        <span className="text-muted"> · khoảng {route.distance} m đi bộ</span>
                    </div>

                    {/* Only show steps when the route uses more than one floor */}
                    {route.legs.length > 1 && (
                        <ol className="route-steps">
                            {route.legs.map((leg, index) => {
                                const nextLeg = route.legs[index + 1];
                                return (
                                    <li key={index}>
                                        <button
                                            type="button"
                                            className={`btn btn-sm ${leg.floor === floor ? "btn-primary" : "btn-outline-primary"}`}
                                            onClick={() => onFloorChange(leg.floor)}
                                        >
                                            {floorLabel(leg.floor)}
                                        </button>
                                        <span>
                                            Đi bộ ~{Math.round(leg.distance)} m
                                            {nextLeg
                                                ? `, rồi đi ${leg.connector.toLowerCase()} ${nextLeg.floor > leg.floor ? "lên" : "xuống"} ${floorLabel(nextLeg.floor)}`
                                                : ` đến ${toPlace.name}`}
                                        </span>
                                    </li>
                                );
                            })}
                        </ol>
                    )}

                    <p className="small text-muted mt-2 mb-0">Đường đi gần đúng, chỉ để tham khảo.</p>
                </div>
            )}
        </aside>
    );
}

export default RoutePanel;
