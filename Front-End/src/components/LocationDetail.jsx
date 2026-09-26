import { useState } from "react";
import { getGroup, getLocationType } from "../data/locationTypes";

// Desktop: a panel on the left, always showing everything.
// Phone: a bottom sheet. Collapsed = short preview, "Xem chi tiết" expands it (see App.css).
function LocationDetail({ location, onClose, onRouteFrom, onRouteTo }) {
    const [isExpanded, setIsExpanded] = useState(false);

    const type = getLocationType(location.type);
    const group = getGroup(type.group);
    const facilities = location.facilities || [];
    const hasMoreInfo = location.description || location.openingHours || location.phone || location.website || facilities.length > 0;

    return (
        <aside className={`location-detail ${isExpanded ? "is-expanded" : ""}`} aria-label={`Thông tin ${location.name}`}>
            <div className="d-flex align-items-start gap-3">
                <span className="detail-icon" style={{ background: group.color }}>
                    <i className={`bi ${type.icon}`} />
                </span>
                <div className="flex-grow-1">
                    <h2 className="detail-title">{location.name}</h2>
                    <p className="text-muted mb-0">{type.label}</p>
                </div>
                <button type="button" className="btn btn-light btn-sm rounded-circle" onClick={onClose} aria-label="Đóng">
                    <i className="bi bi-x-lg" />
                </button>
            </div>

            <div className="d-flex flex-wrap gap-2 mt-3">
                <span className="badge text-bg-light border"><i className="bi bi-building me-1" />Ga {location.terminal || "T1"}</span>
                <span className="badge text-bg-light border"><i className="bi bi-layers me-1" />Tầng {location.floor}</span>
                {location.area && <span className="badge text-bg-light border"><i className="bi bi-geo-alt me-1" />{location.area}</span>}
            </div>

            {location.terminal !== 'T1' || location.x == null || location.y == null ? <p className="small text-muted mt-3">Địa điểm đã có tọa độ. Chỉ đường sẽ khả dụng khi bổ sung các đoạn nối lối đi.</p> : <div className="d-flex gap-2 mt-3">
                <button type="button" className="btn btn-primary btn-sm flex-grow-1" onClick={() => onRouteFrom(location)}>
                    <i className="bi bi-person-walking me-1" />Chỉ đường từ đây
                </button>
                <button type="button" className="btn btn-outline-primary btn-sm flex-grow-1" onClick={() => onRouteTo(location)}>
                    <i className="bi bi-flag me-1" />Đến đây
                </button>
            </div>}

            {hasMoreInfo && (
                <button type="button" className="btn btn-link btn-sm detail-toggle px-0 mt-2" onClick={() => setIsExpanded(!isExpanded)} aria-expanded={isExpanded}>
                    {isExpanded ? "Thu gọn" : "Xem chi tiết"} <i className={`bi ${isExpanded ? "bi-chevron-down" : "bi-chevron-up"}`} />
                </button>
            )}

            <div className="detail-body">
                {!hasMoreInfo && <p className="text-muted small mt-3 mb-0">Chưa có thêm thông tin cho địa điểm này.</p>}

                {location.description && <p className="mt-3 mb-0">{location.description}</p>}
                {location.phone && <p className="mt-2 mb-0">Điện thoại: {location.phone}</p>}
                {location.website && <p className="mt-2 mb-0">Website: {location.website}</p>}

                {location.openingHours && (
                    <div className="detail-row">
                        <i className="bi bi-clock" />
                        <div>
                            <small className="text-muted d-block">Giờ mở cửa</small>
                            {location.openingHours}
                        </div>
                    </div>
                )}

                {facilities.length > 0 && (
                    <div className="detail-row">
                        <i className="bi bi-check2-square" />
                        <div>
                            <small className="text-muted d-block">Tiện ích</small>
                            <ul className="list-unstyled mb-0">
                                {facilities.map(item => <li key={item}>{item}</li>)}
                            </ul>
                        </div>
                    </div>
                )}
            </div>
        </aside>
    );
}

export default LocationDetail;
