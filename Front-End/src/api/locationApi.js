// "/api" is forwarded to Spring Boot (localhost:8080) by vite.config.js
const API_URL = "/api/locations";

// Small helper: send a request, throw an error when the server answers 4xx/5xx
async function request(url, options) {
    const response = await fetch(url, options);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    // DELETE answers "204 No Content" = no JSON body to read
    return response.status === 204 ? null : response.json();
}

export function getLocations() {
    return request(API_URL);
}

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
