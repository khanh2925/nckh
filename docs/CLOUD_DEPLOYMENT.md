# Deploy: Cloudflare Workers + Render + Neon

```text
Người dùng → Cloudflare Workers (React) → Render (Spring Boot, CHỈ ĐỌC) → Neon (PostgreSQL)
Máy Long / Khánh (npm run dev + backend chạy ở máy, Back-End/.env) → Neon   (Admin sửa, vẽ lối đi)
```

Web online luôn đọc dữ liệu mới nhất trên Neon: sửa trên Neon xong, tải lại trang là thấy.

## 1. Neon (database chung)

Đã có đủ dữ liệu: `01`, `02` (705 địa điểm) và `03`, `04` (lối đi). Không chạy lại script.

Cách sửa dữ liệu:

- **Sửa nhanh** (tên, mô tả, giờ mở cửa, điện thoại, tọa độ…): Neon Console → **Tables** → bảng `locations` → sửa ô → **Save**.
- **Thêm/xóa địa điểm, đổi tầng, tiện ích, vẽ lối đi**: dùng trang Admin chạy trên máy (`npm run dev` + backend với `Back-End/.env` trỏ Neon). Dữ liệu này nằm ở nhiều bảng (`floors`, `location_facilities`, `walkway_nodes`, `walkway_edges`) nên sửa tay trên Console dễ sai.

## 2. Render (backend)

Người tạo: chủ repo GitHub (Khánh), vì Render cần quyền đọc repo.

1. Render → **New → Blueprint** → chọn repo `nckh` → Render đọc `render.yaml` (Docker, Free, nhánh `main`, thư mục `Back-End`).
2. Điền biến môi trường (không commit):
   - `DB_URL` = `jdbc:postgresql://HOST_NEON/neondb?sslmode=require`
   - `DB_USERNAME`, `DB_PASSWORD` = tài khoản Neon.
   - `CORS_ALLOWED_ORIGINS` (địa chỉ web Cloudflare, không có `/` cuối) và `READ_ONLY=true` đã có sẵn trong `render.yaml`.
3. Kiểm tra `https://<tên-service>.onrender.com/api/locations` và `/api/walkways` trả JSON.

`READ_ONLY=true`: API không có đăng nhập, nên server online chỉ trả lời GET; thêm/sửa/xóa trả 403.
Gói Free: ngủ sau 15 phút không ai truy cập, lần mở lại mất khoảng 1 phút (web hiện "Đang tải dữ liệu…"); 750 giờ/tháng.

## 3. Cloudflare Workers (frontend)

GitHub Actions (`.github/workflows/deploy.yml`) build và deploy mỗi khi có commit vào `main`.
(Cloudflare Workers Builds không thấy được repo của tài khoản GitHub khác nên không dùng.)

GitHub repo → **Settings → Secrets and variables → Actions**:

- Secret `CLOUDFLARE_API_TOKEN`: token deploy Cloudflare.
- Variable `VITE_API_BASE_URL` = `https://<tên-service>.onrender.com` (không có `/` cuối).

Chưa đặt `VITE_API_BASE_URL` thì web dùng bản sao JSON trong `Front-End/public/data` (xuất bằng `npm run export-data`).
Đổi biến này phải deploy lại: **Actions → Deploy to Cloudflare Workers → Run workflow**.

Không đưa thông tin database vào biến `VITE_` (biến này nằm công khai trong code web) và không commit `.env`.

Tài liệu: https://render.com/docs/free, https://render.com/docs/blueprint-spec
