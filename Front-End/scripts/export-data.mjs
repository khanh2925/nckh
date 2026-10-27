// Lưu bản chụp dữ liệu cho website tĩnh (Cloudflare Workers không có backend):
//   public/data/venues.json              = GET /api/venues
//   public/data/venues/<slug>.json       = GET /api/venues/<slug>/map   (mỗi địa điểm đã xuất bản)
// PostgreSQL vẫn là nguồn chính: không sửa tay các tệp JSON này.
// Cách dùng: chạy backend trước, rồi "npm run export-data" (API_BASE=https://... để lấy từ backend khác).
import { mkdirSync, writeFileSync } from "node:fs";

const apiBase = (globalThis.process?.env.API_BASE || "http://localhost:8080").replace(/\/+$/, "");

async function getJson(url) {
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Backend trả HTTP ${response.status} cho ${url}`);
    return response.json();
}

mkdirSync("public/data/venues", { recursive: true });
const venues = await getJson(`${apiBase}/api/venues`);
writeFileSync("public/data/venues.json", JSON.stringify(venues, null, 1) + "\n");
console.log(`Đã lưu ${venues.length} địa điểm -> public/data/venues.json`);

for (const venue of venues) {
    const bundle = await getJson(`${apiBase}/api/venues/${encodeURIComponent(venue.slug)}/map`);
    writeFileSync(`public/data/venues/${venue.slug}.json`, JSON.stringify(bundle) + "\n");
    console.log(`  ${venue.slug}: ${bundle.floors.length} tầng, ${bundle.locations.length} địa điểm, ${bundle.walkways.nodes.length} nút lối đi`);
}
