import { API_BASE, isStaticMode, request } from "./locationApi";

// Walkway network for directions: { nodes: [...], edges: [{ from, to }] }
const API_URL = `${API_BASE}/api/walkways`;
const STATIC_DATA_URL = "/data/walkways.json";

export function getWalkways() {
    return request(isStaticMode ? STATIC_DATA_URL : API_URL);
}

// The admin always sends the WHOLE network; the backend replaces the old one
export function saveWalkways(walkways) {
    return request(API_URL, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(walkways)
    });
}
