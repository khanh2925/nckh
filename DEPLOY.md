# Deploy lên Cloudflare Workers (bản tĩnh)

Bản deploy chỉ gồm frontend, **không có Admin**. Dữ liệu đọc từ file tĩnh
`Front-End/public/data/locations.json`: đây là **bản xuất (snapshot) từ PostgreSQL**, không sửa tay.

## Tự động

Mỗi lần có code mới trên `main`, GitHub Actions (`.github/workflows/deploy.yml`) chạy
`npm ci` → `npm run build` → `wrangler deploy`. Cần secret `CLOUDFLARE_API_TOKEN` trong repo.
Xem kết quả ở tab **Actions** trên GitHub.

## Thủ công (dự phòng)

```bash
cd Front-End
npx wrangler login
npm run deploy        # = npm run build + npx wrangler deploy
```

## Cập nhật dữ liệu trên web

1. Chạy PostgreSQL + backend trên máy (xem `Back-End/database/README.md`), sửa bằng Admin.
2. Xuất snapshot:

   ```bash
   cd Front-End
   npm run export-data   # lấy từ http://localhost:8080/api/locations
   ```

3. Commit `Front-End/public/data/locations.json`, merge vào `main` → web tự cập nhật.

## Khi có backend online

Đặt biến `VITE_API_URL=https://<địa-chỉ-backend>` trước khi build: web gọi API thay vì file tĩnh và Admin hiện lại.
Cấu hình Cloudflare: `Front-End/wrangler.jsonc`.
