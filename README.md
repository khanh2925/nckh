# Airport Indoor Map

React + Leaflet → Spring Boot REST API → PostgreSQL.

Database gồm sáu bảng quan hệ: `terminals`, `floors`, `location_types`, `locations`, `facilities`, `location_facilities`.

Xem [hướng dẫn tạo schema, nạp SQL và chạy project](Back-End/database/README.md) và [ERD](docs/knowledge/DATABASE_SCHEMA.md).

- `Back-End/database/01_schema.sql`: tạo trực tiếp schema hoàn chỉnh.
- `Back-End/database/02_seed.sql`: nạp 705 địa điểm và dữ liệu quan hệ bằng SQL.
- Backend: Controller → Service → DAO → PostgreSQL; không đọc/ghi JSON để lưu địa điểm.
- Frontend: bản đồ, tìm kiếm, chỉ đường đa tầng, admin CRUD; SVG và đồ thị lối đi vẫn trong frontend.

Khởi tạo database theo hướng dẫn trước, sau đó chạy:

```bash
cd Back-End
./mvnw spring-boot:run
```

Terminal khác:

```bash
cd Front-End
npm install
npm run dev -- --port 5174
```

## Deploy Cloudflare Workers + Render + Neon

Frontend dùng VITE_API_BASE_URL trỏ Render; local giữ proxy /api. Backend Docker dùng PORT và CORS_ALLOWED_ORIGINS là danh sách origin phân cách dấu phẩy, kết nối Neon qua DB_URL/DB_USERNAME/DB_PASSWORD. Blueprint render.yaml chọn main và Free; Cloudflare chọn main trong dashboard. Xem [hướng dẫn](docs/CLOUD_DEPLOYMENT.md). Chưa deploy cloud.
