import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";

// Backend Spring Boot khi chạy "npm run dev": /api được chuyển tới đây
const backendUrl = process.env.INDOOR_MAP_API_URL || process.env.AIRPORT_MAP_API_URL || "http://localhost:8080";

export default defineConfig({
    // HTTPS=1 (npm run dev:phone): chứng chỉ tự ký, để điện thoại cùng Wi-Fi dùng được camera, la bàn, đếm bước
    plugins: process.env.HTTPS === "1" ? [react(), basicSsl()] : [react()],
    server: {
        port: 5173,
        // host: true để điện thoại cùng Wi-Fi mở được http://<IP-máy>:5173 (camera/la bàn cần HTTPS, xem README)
        host: true,
        // Cho phép link tạm của Cloudflare Tunnel (cloudflared tunnel --url http://localhost:5173) để test bằng 4G
        allowedHosts: [".trycloudflare.com"],
        proxy: { "/api": backendUrl },
        // @indoor-map/core nằm ngoài thư mục Front-End (../packages/core)
        fs: { allow: [".."] }
    }
});
