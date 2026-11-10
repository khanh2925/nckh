# Database schema v2 – nhiều địa điểm (multi-venue)

Mô hình: `users` → `venues` → `buildings` → `floors` → { `zones`, `locations`, `walkway_nodes` ↔ `walkway_edges` },
`venues` → { `location_types`, `facilities` }; `type_templates` là danh mục mẫu của hệ thống.

## Nhanh nhất: database có sẵn dữ liệu demo

```bash
cd Back-End
./database/setup-demo-db.sh          # tạo database indoor_map_v2 từ database/v2/demo_data.sql
```

Có sẵn Sân bay Tân Sơn Nhất (705 điểm, 11 tầng có mặt bằng, mạng lối đi, 2 quy trình mẫu) và khuôn viên IUH.
Không có tài khoản nào: đặt `ADMIN_EMAIL`, `ADMIN_PASSWORD` trong `Back-End/.env` (xem `.env.example`, `DB_URL=jdbc:postgresql://localhost:5432/indoor_map_v2`),
backend tạo tài khoản quản trị hệ thống ở lần chạy đầu. Đổi schema thì xuất lại `demo_data.sql` (`pg_dump --no-owner --no-privileges`, bỏ dòng `\restrict`/`\unrestrict`).

## Database mới (trống)

```bash
psql -U airport_map -d airport_map -f database/v2/01_schema_v2.sql
psql -U airport_map -d airport_map -f database/v2/03_type_templates_seed.sql
psql -U airport_map -d airport_map -f database/v2/05_journeys.sql
```

## Database đã có dữ liệu sân bay (schema v1)

Sao lưu trước (`pg_dump airport_map > backup.sql`), rồi:

```bash
psql -U airport_map -d airport_map -f database/v2/02_migrate_from_v1.sql
psql -U airport_map -d airport_map -f database/v2/03_type_templates_seed.sql
```

Sau khi chuyển: 1 venue `tan-son-nhat` (PUBLISHED, chưa có chủ), 4 buildings (T1, T2, T3, SGN_CAMPUS),
11 floors (T1 có tham số căn chỉnh mặt bằng), 18 location_types, 705 locations, 2.138 walkway_nodes giữ nguyên id.

## Thêm bảng quy trình (database v2 đã chạy từ trước)

```bash
psql -U airport_map -d airport_map -f database/v2/05_journeys.sql
```

Chạy được nhiều lần (`IF NOT EXISTS`). Backend cần bảng này, kể cả bản trên Neon.
Quy trình mẫu của sân bay (Đi chuyến bay nội địa, Đến nơi lấy hành lý): `06_journeys_seed_tan_son_nhat.sql`.

## Tài khoản đầu tiên

Khi bảng `users` còn trống, backend tạo tài khoản quản trị hệ thống từ `ADMIN_EMAIL` / `ADMIN_PASSWORD` (xem `.env.example`).
Đăng nhập rồi gán chủ cho venue sân bay: `PUT /api/admin/venues/{id}/owner { "ownerId": ... }`.
