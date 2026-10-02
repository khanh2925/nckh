// Where the data comes from:
// - npm run dev: "/api" is forwarded to Spring Boot (localhost:8080) by vite.config.js
// - Built website WITH a backend: set VITE_API_URL (e.g. https://aeroproce-api.onrender.com) before building
// - Built website WITHOUT a backend (Cloudflare Workers now): read the static file /data/locations.json
//   (copied from Back-End/data/airport-locations.json by scripts/copy-data.mjs on every build)
const API_BASE = import.meta.env.VITE_API_URL || "";
export const isStaticMode = import.meta.env.PROD && !API_BASE;

const API_URL = `${API_BASE}/api/locations`;
const STATIC_DATA_URL = "/data/locations.json";

// Send a request and report an error when the backend answers 4xx/5xx.
async function request(url, options) {
    const response = await fetch(url, options);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    // DELETE answers "204 No Content" and has no JSON body.
    return response.status === 204 ? null : response.json();
}

export async function getLocations() {
    return request(isStaticMode ? STATIC_DATA_URL : API_URL);
}

// Add / edit / delete only work with a backend (the Admin role is hidden in static mode)
export function addLocation(location) {
    return request(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(location)
    });
}

export function updateLocation(id, location) {
    return request(`${API_URL}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(location)
    });
}

export function deleteLocation(id) {
    return request(`${API_URL}/${id}`, { method: "DELETE" });
}
