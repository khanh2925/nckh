# Database schema v2 – nhiều địa điểm (multi-venue)

Mô hình: `users` → `venues` → `buildings` → `floors` → { `zones`, `locations`, `walkway_nodes` ↔ `walkway_edges` },
`venues` → { `location_types`, `facilities` }; `type_templates` là danh mục mẫu của hệ thống.

## Database mới (trống)

```bash
psql -U airport_map -d airport_map -f database/v2/01_schema_v2.sql
psql -U airport_map -d airport_map -f database/v2/03_type_templates_seed.sql
```

## Database đã có dữ liệu sân bay (schema v1)

Sao lưu trước (`pg_dump airport_map > backup.sql`), rồi:

```bash
psql -U airport_map -d airport_map -f database/v2/02_migrate_from_v1.sql
psql -U airport_map -d airport_map -f database/v2/03_type_templates_seed.sql
```

Sau khi chuyển: 1 venue `tan-son-nhat` (PUBLISHED, chưa có chủ), 4 buildings (T1, T2, T3, SGN_CAMPUS),
11 floors (T1 có tham số căn chỉnh mặt bằng), 18 location_types, 705 locations, 2.138 walkway_nodes giữ nguyên id.

## Tài khoản đầu tiên

Khi bảng `users` còn trống, backend tạo tài khoản quản trị hệ thống từ `ADMIN_EMAIL` / `ADMIN_PASSWORD` (xem `.env.example`).
Đăng nhập rồi gán chủ cho venue sân bay: `PUT /api/admin/venues/{id}/owner { "ownerId": ... }`.
