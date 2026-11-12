import { defineConfig, type Plugin } from "vite";
import fs from "node:fs";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// Nhật ký cảm biến gửi từ điện thoại khi đi thử (lib/positioningLog.ts): lưu vào Front-End/.field-logs/<id>.json.
// Chỉ có khi chạy "npm run dev" (bản build không có), giới hạn 40 MB, tên tệp do máy chủ làm sạch.
function fieldLogs(): Plugin {
    const dir = path.resolve(import.meta.dirname, ".field-logs");
    return {
        name: "field-logs",
        configureServer(server) {
            server.middlewares.use("/__field-log", (req, res) => {
                if (req.method !== "POST") {
                    res.statusCode = 405;
                    return res.end();
                }
                const id = (new URL(req.url ?? "", "http://x").searchParams.get("id") ?? "log").replace(/[^a-zA-Z0-9-]/g, "").slice(0, 80) || "log";
                const chunks: Buffer[] = [];
                let size = 0;
                req.on("data", (c: Buffer) => {
                    size += c.length;
                    if (size > 40 * 1024 * 1024) req.destroy();
                    else chunks.push(c);
                });
                req.on("end", () => {
                    try {
                        const log = JSON.parse(Buffer.concat(chunks).toString("utf8"));
                        if (!Array.isArray(log?.events)) throw new Error("không phải nhật ký");
                        fs.mkdirSync(dir, { recursive: true });
                        fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(log));
                        res.setHeader("Content-Type", "application/json");
                        res.end(JSON.stringify({ ok: true, events: log.events.length }));
                    } catch {
                        res.statusCode = 400;
                        res.end();
                    }
                });
            });
        }
    };
}

// Backend Spring Boot khi chạy "npm run dev": /api được chuyển tới đây
const backendUrl = process.env.INDOOR_MAP_API_URL || process.env.AIRPORT_MAP_API_URL || "http://localhost:8080";

export default defineConfig({
    // HTTPS=1 (npm run dev:phone): chứng chỉ tự ký, để điện thoại cùng Wi-Fi dùng được camera, la bàn, đếm bước
    plugins: process.env.HTTPS === "1" ? [react(), tailwindcss(), basicSsl(), fieldLogs()] : [react(), tailwindcss(), fieldLogs()],
    resolve: { alias: { "@": path.resolve(import.meta.dirname, "./src") } },
    server: {
        port: 5173,
        // host: true để điện thoại cùng Wi-Fi mở được http://<IP-máy>:5173 (camera/la bàn cần HTTPS, xem README)
        host: true,
        // Cho phép link tạm của Cloudflare Tunnel (cloudflared tunnel --url http://localhost:5173) để test bằng 4G
        allowedHosts: [".trycloudflare.com"],
        // Trình duyệt gọi /api cùng địa chỉ với trang (không phải CORS). Bỏ header Origin để backend không chặn
        // khi trang mở qua link Cloudflare hoặc IP Wi-Fi (backend chỉ cho localhost trong danh sách CORS).
        proxy: {
            "/api": {
                target: backendUrl,
                configure: proxy => proxy.on("proxyReq", req => req.removeHeader("origin"))
            }
        },
        // @indoor-map/core nằm ngoài thư mục Front-End (../packages/core)
        fs: { allow: [".."] }
    }
});
