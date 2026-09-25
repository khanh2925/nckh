function RoutePanel({ fromLocation, toLocation, route, floor, onSwap, onClearFrom, onClearTo, onClose, onFloorChange }) {
    const isSamePlace = fromLocation && toLocation && fromLocation.id === toLocation.id;
    const waitingFor = !fromLocation ? "điểm xuất phát" : !toLocation ? "điểm đến" : null;

    return (
        <aside className="route-panel" aria-label="Chỉ đường">
            <div className="d-flex align-items-center mb-2">
                <strong className="flex-grow-1"><i className="bi bi-signpost-2 me-2" />Chỉ đường</strong>
                <button type="button" className="btn btn-light btn-sm rounded-circle" onClick={onClose} aria-label="Đóng chỉ đường">
                    <i className="bi bi-x-lg" />
                </button>
            </div>

            <div className="d-flex align-items-center gap-2">
                <div className="flex-grow-1">
                    <div className="route-point">
                        <i className="bi bi-person-walking text-primary" />
                        <span className={fromLocation ? "" : "text-muted"}>{fromLocation ? fromLocation.name : "Chọn điểm xuất phát"}</span>
                        {fromLocation && (
                            <button type="button" className="btn btn-link btn-sm p-0 text-secondary" onClick={onClearFrom} aria-label="Chọn lại điểm xuất phát">
                                <i className="bi bi-x-circle-fill" />
                            </button>
                        )}
                    </div>
                    <div className="route-point">
                        <i className="bi bi-geo-alt-fill text-danger" />
                        <span className={toLocation ? "" : "text-muted"}>{toLocation ? toLocation.name : "Chọn điểm đến"}</span>
                        {toLocation && (
                            <button type="button" className="btn btn-link btn-sm p-0 text-secondary" onClick={onClearTo} aria-label="Chọn lại điểm đến">
                                <i className="bi bi-x-circle-fill" />
                            </button>
                        )}
                    </div>
                </div>
                <button type="button" className="btn btn-light border btn-sm" onClick={onSwap} aria-label="Đảo chiều" title="Đảo chiều">
                    <i className="bi bi-arrow-down-up" />
                </button>
            </div>

            {waitingFor && (
                <p className="small text-muted mt-2 mb-0">
                    <i className="bi bi-info-circle me-1" />
                    Chạm vào một địa điểm trên bản đồ hoặc dùng ô tìm kiếm để chọn {waitingFor}.
                </p>
            )}

            {isSamePlace && <p className="small text-danger mt-2 mb-0">Điểm xuất phát và điểm đến đang trùng nhau.</p>}

            {!waitingFor && !isSamePlace && !route && (
                <p className="small text-danger mt-2 mb-0">Không tìm được đường đi giữa hai địa điểm này.</p>
            )}

            {route && (
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
                                            Tầng {leg.floor}
                                        </button>
                                        <span>
                                            Đi bộ ~{Math.round(leg.distance)} m
                                            {nextLeg
                                                ? `, rồi đi ${leg.connector.toLowerCase()} ${nextLeg.floor > leg.floor ? "lên" : "xuống"} Tầng ${nextLeg.floor}`
                                                : ` đến ${toLocation.name}`}
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
