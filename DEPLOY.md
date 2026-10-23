# Deploy

Hướng dẫn đầy đủ (Cloudflare Workers + Render + Neon): [docs/CLOUD_DEPLOYMENT.md](docs/CLOUD_DEPLOYMENT.md).

Tóm tắt:

- Frontend tự deploy lên Cloudflare Workers mỗi khi có commit vào `main` (GitHub Actions, tab **Actions** để xem kết quả).
- Web online đọc dữ liệu thật trên Neon qua backend Render (biến `VITE_API_BASE_URL`). Server online chỉ cho đọc, **không có Admin**.
- Sửa dữ liệu: trên Neon Console, hoặc trang Admin chạy ở máy (`npm run dev`, backend dùng `Back-End/.env` trỏ Neon).

## Thủ công (dự phòng)

```bash
cd Front-End
npx wrangler login
npm run deploy        # = npm run build + npx wrangler deploy
```

## Bản sao dữ liệu (khi chưa có backend online)

Không đặt `VITE_API_BASE_URL` thì web đọc `Front-End/public/data/locations.json` và `walkways.json`.
Cập nhật bản sao: chạy backend trên máy rồi `npm run export-data` trong `Front-End`, commit 2 file JSON, merge vào `main`.
