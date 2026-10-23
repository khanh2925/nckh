import { useState } from "react";
import { getGroup, getLocationType } from "../data/locationTypes";
import { floorLabel } from "../utils/text";

// The crawled data writes opening hours in English: "24 Hours", "5AM-9PM", "6AM - 11:45PM"
function translateHours(text) {
    if (/^24\s*hours?$/i.test(text.trim())) return "Mở cửa 24 giờ";
    return text
        .replace(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/gi, (match, hour, minute = "00", half) => {
            const value = (Number(hour) % 12) + (half.toUpperCase() === "PM" ? 12 : 0);
            return `${String(value).padStart(2, "0")}:${minute}`;
        })
        .replace(/\s*-\s*/g, " – ");
}
// Some websites in the data have no "https://", which would make the link relative to our own site
const toUrl = (website) => (/^https?:\/\//i.test(website) ? website : `https://${website}`);

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
                <span className="badge text-bg-light border"><i className="bi bi-layers me-1" />{floorLabel(location.floor)}</span>
                {location.area && <span className="badge text-bg-light border"><i className="bi bi-geo-alt me-1" />{location.area}</span>}
            </div>

            <div className="d-flex gap-2 mt-3">
                <button type="button" className="btn btn-primary btn-sm flex-grow-1" onClick={() => onRouteFrom(location)}>
                    <i className="bi bi-person-walking me-1" />Chỉ đường từ đây
                </button>
                <button type="button" className="btn btn-outline-primary btn-sm flex-grow-1" onClick={() => onRouteTo(location)}>
                    <i className="bi bi-flag me-1" />Đến đây
                </button>
            </div>

            {hasMoreInfo && (
                <button type="button" className="btn btn-link btn-sm detail-toggle px-0 mt-2" onClick={() => setIsExpanded(!isExpanded)} aria-expanded={isExpanded}>
                    {isExpanded ? "Thu gọn" : "Xem chi tiết"} <i className={`bi ${isExpanded ? "bi-chevron-down" : "bi-chevron-up"}`} />
                </button>
            )}

            <div className="detail-body">
                {!hasMoreInfo && <p className="text-muted small mt-3 mb-0">Chưa có thêm thông tin cho địa điểm này.</p>}

                {location.description && <p className="mt-3 mb-0">{location.description}</p>}
                {location.phone && (
                    <div className="detail-row">
                        <i className="bi bi-telephone" />
                        <div>
                            <small className="text-muted d-block">Điện thoại</small>
                            <a href={`tel:${location.phone.replace(/[^\d+]/g, "")}`}>{location.phone}</a>
                        </div>
                    </div>
                )}
                {location.website && (
                    <div className="detail-row">
                        <i className="bi bi-globe" />
                        <div className="min-w-0">
                            <small className="text-muted d-block">Website</small>
                            <a href={toUrl(location.website)} target="_blank" rel="noopener noreferrer" className="text-break">{location.website.replace(/^https?:\/\//i, "").replace(/\/$/, "")}</a>
                        </div>
                    </div>
                )}

                {location.openingHours && (
                    <div className="detail-row">
                        <i className="bi bi-clock" />
                        <div>
                            <small className="text-muted d-block">Giờ mở cửa</small>
                            {translateHours(location.openingHours)}
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
