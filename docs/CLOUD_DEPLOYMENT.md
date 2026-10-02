# Cloudflare Workers + Render + Neon

React/Vite chạy trên Cloudflare Workers; Spring Boot Java 17 chạy Docker trên Render Free; PostgreSQL trên Neon. Không cần Vercel hoặc cài Docker trên máy để Render build.

## Render backend

Tạo Web Service từ GitHub repo, hoặc Blueprint bằng `render.yaml` tại root:

- Branch: `main` (để thử code hiện ở khanh, dùng nhánh khanh trước khi merge).
- Root Directory: `Back-End`.
- Runtime: Docker; Dockerfile: `Dockerfile`; Instance Type: Free.
- Health Check Path: `/api/locations`.
- Auto deploy: On Commit.

Environment variables:

- DB_URL: `jdbc:postgresql://HOST_NEON/neondb?sslmode=require&channelBinding=require`.
- DB_USERNAME: username từ Neon.
- DB_PASSWORD: mật khẩu mới từ Neon, không commit.
- CORS_ALLOWED_ORIGINS: URL frontend chính xác, ví dụ `https://aeroproce.aeroproce.workers.dev` (không dấu / cuối). Nhiều origin phân cách bằng dấu phẩy. Không dùng wildcard cho toàn bộ workers.dev.

Neon đã có seed: không chạy lại script. Với database mới, chạy 01_schema.sql và 02_seed.sql một lần. Render dùng PORT do platform cấp. Free service ngủ sau 15 phút không có traffic, lần truy cập tiếp theo có thể chậm khoảng một phút.

Kiểm tra `https://YOUR-SERVICE.onrender.com/api/locations` trả JSON.

## Cloudflare Workers frontend

Dùng Worker hiện có `aeroproce`, URL https://aeroproce.aeroproce.workers.dev. Cấu hình Workers Builds Git integration:

- Repository: `khanh2925/nckh`.
- Production branch: `main`.
- Root Directory: `Front-End`.
- Build command: `npm run build`.
- Deploy command: `npx wrangler deploy`.
- Wrangler config: `Front-End/wrangler.jsonc`, assets directory `./dist`, Worker name `aeroproce`.
- NODE_VERSION: `22.12.0` hoặc bản mới hơn tương thích Vite.
- VITE_API_BASE_URL: `https://YOUR-SERVICE.onrender.com`.

VITE_API_BASE_URL là biến build công khai, chỉ chứa địa chỉ backend. Tuyệt đối không đưa thông tin database vào biến VITE_. Đặt biến trước khi build; thay giá trị phải redeploy. Local không đặt biến này vẫn dùng Vite proxy đến localhost:8080.

Blueprint đã đặt CORS_ALLOWED_ORIGINS=https://aeroproce.aeroproce.workers.dev. Nếu tạo Render thủ công, đặt cùng giá trị và redeploy backend. Kiểm tra xem bản đồ và CRUD. Preview domain cần khai báo riêng và nên dùng database demo riêng; không mở preview CRUD vào database quan trọng.

Push/merge main tự kích hoạt hai deployment độc lập. Không tự chạy seed hoặc reset database khi deploy. Cấu hình đang chuẩn bị trong repo, chưa chứng minh deployment cloud thành công cho đến khi có URL và kiểm tra API/CORS.

API ghi hiện chưa có xác thực admin; dùng dữ liệu demo cho bản public.

Tài liệu: https://render.com/docs/free, https://render.com/docs/blueprint-spec, https://developers.cloudflare.com/workers/ci-cd/builds/configuration/.
