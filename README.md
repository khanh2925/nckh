# Airport Indoor Map

React + Leaflet → Spring Boot REST API → PostgreSQL.

Database gồm sáu bảng quan hệ: `terminals`, `floors`, `location_types`, `locations`, `facilities`, `location_facilities`, cùng hai bảng mạng lối đi cho chỉ đường: `walkway_nodes`, `walkway_edges`.

Xem [hướng dẫn tạo schema, nạp SQL và chạy project](Back-End/database/README.md) và [ERD](docs/knowledge/DATABASE_SCHEMA.md).

- `Back-End/database/01_schema.sql`: tạo trực tiếp schema hoàn chỉnh.
- `Back-End/database/02_seed.sql`: nạp 705 địa điểm và dữ liệu quan hệ bằng SQL.
- `Back-End/database/03_walkways_schema.sql`, `04_walkways_seed.sql`: bảng và dữ liệu lối đi ban đầu (database cũ chỉ cần chạy thêm 2 file này).
- Backend: Controller → Service → DAO → PostgreSQL; không đọc/ghi JSON để lưu địa điểm.
- Frontend: bản đồ, tìm kiếm, chỉ đường đa tầng giữa 2 vị trí bất kỳ trên mặt bằng, admin CRUD địa điểm và vẽ lối đi (Admin → tab Lối đi). Xem [KI-03](docs/knowledge/KI-03_INDOOR_ROUTING_NAVIGATION.md).

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
