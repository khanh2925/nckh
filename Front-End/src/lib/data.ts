import { createApiClient } from "@indoor-map/core";

// - Có backend: VITE_API_BASE_URL = địa chỉ backend (ví dụ https://indoor-map-api.onrender.com),
//   hoặc khi "npm run dev" thì /api được Vite chuyển tới backend local (vite.config.ts).
// - Không có backend (website tĩnh trên Cloudflare, hoặc backend đang tắt): đọc /data/venues.json và
//   /data/venues/{slug}.json (tạo bằng "npm run export-data").
const apiBase = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");
const staticOnly = import.meta.env.VITE_DATA_MODE === "static";

export const api = createApiClient({
    apiBase,
    tryApi: !staticOnly && (apiBase !== "" || import.meta.env.DEV)
});
