// Where the data comes from:
// - npm run dev: "/api" is forwarded to Spring Boot (localhost:8080) by vite.config.js
// - Online website: VITE_API_BASE_URL = the backend on Render (e.g. https://airport-map-api.onrender.com),
//   which reads the real data from Neon. It is set before building (GitHub Actions variable, see DEPLOY.md).
// - Online website without VITE_API_BASE_URL: read the static snapshot /data/locations.json
//   (saved by "npm run export-data", see scripts/export-data.mjs)
// walkwayApi.js reuses API_BASE, isStaticMode and request() from this file.
export const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");
export const isStaticMode = import.meta.env.PROD && !API_BASE;

// Admin changes data, so it only exists when running on your own computer (npm run dev).
// The online website is read-only: edit the data in the Neon console or with the local Admin.
export const canEdit = !import.meta.env.PROD;

const API_URL = `${API_BASE}/api/locations`;
const STATIC_DATA_URL = "/data/locations.json";

// Send a request and report an error when the backend answers 4xx/5xx.
export async function request(url, options) {
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

// Add / edit / delete: only used by the Admin page on your own computer
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
