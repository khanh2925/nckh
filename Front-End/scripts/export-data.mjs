// Saves a snapshot of the data for the static website (Cloudflare Workers has no backend):
// public/data/locations.json and public/data/walkways.json.
// PostgreSQL stays the source of truth: never edit these JSON files by hand.
// Usage: start the backend (PostgreSQL) first, then run "npm run export-data".
import { mkdirSync, writeFileSync } from "node:fs";

const apiBase = globalThis.process?.env.API_BASE || "http://localhost:8080";
const exports = [
    { url: `${apiBase}/api/locations`, target: "public/data/locations.json", count: data => `${data.length} locations` },
    { url: `${apiBase}/api/walkways`, target: "public/data/walkways.json", count: data => `${data.nodes.length} walkway nodes, ${data.edges.length} edges` }
];

mkdirSync("public/data", { recursive: true });
for (const item of exports) {
    const response = await fetch(item.url);
    if (!response.ok) {
        throw new Error(`Backend answered HTTP ${response.status} for ${item.url}`);
    }
    const data = await response.json();
    // locations: one location per block (easy to read in a diff); walkways: one line per node/edge (smaller file)
    const text = item.target.endsWith("walkways.json")
        ? `{"nodes":[\n${data.nodes.map(node => JSON.stringify(node)).join(",\n")}\n],"edges":[\n${data.edges.map(edge => JSON.stringify(edge)).join(",\n")}\n]}`
        : JSON.stringify(data, null, 2);
    writeFileSync(item.target, text + "\n");
    console.log(`Saved ${item.count(data)} from ${item.url} -> ${item.target}`);
}
