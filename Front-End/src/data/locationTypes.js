// Filter groups shown as chips above the map. "color" is the marker color of the group.
export const typeGroups = [
    { id: "all", label: "Tất cả", icon: "bi-grid", color: "#5f6368" },
    { id: "food", label: "Ăn uống", icon: "bi-cup-hot", color: "#d9822b" },
    { id: "service", label: "Dịch vụ", icon: "bi-shop", color: "#7b5ea7" },
    { id: "restroom", label: "Nhà vệ sinh", icon: "bi-badge-wc", color: "#1f8a8a" },
    { id: "transport", label: "Di chuyển", icon: "bi-arrow-down-up", color: "#3f6fb5" },
    { id: "gate", label: "Cửa ra máy bay", icon: "bi-door-open", color: "#4a4f55" },
    { id: "procedure", label: "Thủ tục", icon: "bi-list-check", color: "#a83039" }
];

// Every location type used in the data. To support a new type, add one line here.
// icon = Bootstrap Icons class name, group = id in typeGroups
export const locationTypes = {
    restaurant: { label: "Nhà hàng", icon: "bi-fork-knife", group: "food" },
    coffee: { label: "Cà phê", icon: "bi-cup-hot", group: "food" },
    shop: { label: "Cửa hàng", icon: "bi-bag", group: "service" },
    information: { label: "Thông tin", icon: "bi-info-lg", group: "service" },
    atm: { label: "ATM", icon: "bi-credit-card", group: "service" },
    lounge: { label: "Phòng chờ", icon: "bi-lamp", group: "service" },
    restroom: { label: "Nhà vệ sinh", icon: "bi-badge-wc", group: "restroom" },
    elevator: { label: "Thang máy", icon: "bi-arrow-down-up", group: "transport" },
    escalator: { label: "Thang cuốn", icon: "bi-chevron-double-up", group: "transport" },
    staircase: { label: "Cầu thang bộ", icon: "bi-stairs", group: "transport" },
    gate: { label: "Cửa ra máy bay", icon: "bi-door-open", group: "gate" },
    checkin: { label: "Quầy làm thủ tục", icon: "bi-suitcase", group: "procedure" },
    baggage: { label: "Băng chuyền hành lý", icon: "bi-luggage", group: "procedure" },
    ticket: { label: "Quầy vé", icon: "bi-ticket-perforated", group: "procedure" },
    security: { label: "Kiểm tra an ninh", icon: "bi-shield-check", group: "procedure" },
    medical: { label: "Phòng y tế", icon: "bi-hospital", group: "service" },
    smoking: { label: "Phòng hút thuốc", icon: "bi-slash-circle", group: "service" },
    other: { label: "Địa điểm khác", icon: "bi-geo-alt", group: "service" }
};

// Unknown types fall back to "other", so bad data never breaks the map
export function getLocationType(type) {
    return locationTypes[type] || locationTypes.other;
}

export function getGroup(groupId) {
    return typeGroups.find(group => group.id === groupId) || typeGroups[0];
}
