// Saves a snapshot of all locations for the static website (Cloudflare Workers has no backend).
// PostgreSQL stays the source of truth: never edit public/data/locations.json by hand.
// Usage: start the backend (PostgreSQL) first, then run "npm run export-data".
import { mkdirSync, writeFileSync } from "node:fs";

const apiUrl = globalThis.process?.env.API_URL || "http://localhost:8080/api/locations";
const target = "public/data/locations.json";

const response = await fetch(apiUrl);
if (!response.ok) {
    throw new Error(`Backend answered HTTP ${response.status} for ${apiUrl}`);
}
const locations = await response.json();

mkdirSync("public/data", { recursive: true });
writeFileSync(target, JSON.stringify(locations, null, 2) + "\n");
console.log(`Saved ${locations.length} locations from ${apiUrl} -> ${target}`);
