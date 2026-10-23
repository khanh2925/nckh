import { AuthError, getSession, logout } from "./auth";

// Where the data comes from:
// - npm run dev: "/api" is forwarded to Spring Boot (localhost:8080) by vite.config.js
// - Online website: VITE_API_BASE_URL = the backend on Render (e.g. https://airport-map-api.onrender.com),
//   which reads the real data from Neon. It is set before building (GitHub Actions variable, see DEPLOY.md).
// - Online website without VITE_API_BASE_URL: read the static snapshot /data/locations.json
//   (saved by "npm run export-data", see scripts/export-data.mjs)
// walkwayApi.js reuses API_BASE, isStaticMode and request() from this file.
export const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");
export const isStaticMode = import.meta.env.PROD && !API_BASE;

const API_URL = `${API_BASE}/api/locations`;
const STATIC_DATA_URL = "/data/locations.json";

// Send a request and report an error when the backend answers 4xx/5xx.
// Changes (POST / PUT / DELETE) carry the admin token. If the backend refuses it (expired or missing),
// the session is dropped and "admin-session-expired" lets App ask for the password again.
export async function request(url, options = {}) {
    const method = (options.method || "GET").toUpperCase();
    const session = method === "GET" ? null : getSession();
    const headers = session ? { ...options.headers, Authorization: `Bearer ${session.token}` } : options.headers;
    const response = await fetch(url, { ...options, headers });
    if (method !== "GET" && (response.status === 401 || response.status === 403)) {
        logout();
        window.dispatchEvent(new Event("admin-session-expired"));
        throw new AuthError("Phiên đăng nhập Admin đã hết hạn. Hãy đăng nhập lại rồi lưu lần nữa.");
    }
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    // DELETE answers "204 No Content" and has no JSON body.
    return response.status === 204 ? null : response.json();
}

export async function getLocations() {
    return request(isStaticMode ? STATIC_DATA_URL : API_URL);
}

// Add / edit / delete: Admin only (request() adds the login token)
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
