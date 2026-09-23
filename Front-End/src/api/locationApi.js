// "/api" is forwarded to Spring Boot (localhost:8080) by vite.config.js
const API_URL = "/api/locations";

export async function getLocations() {
    const response = await fetch(API_URL);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    return response.json();
}

export async function addLocation(location) {
    const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(location)
    });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    return response.json();
}
