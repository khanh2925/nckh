# PostgreSQL: khởi tạo và chạy

Ứng dụng chỉ lưu trữ PostgreSQL qua Controller → Service → LocationDao → LocationPostgresDao → JdbcTemplate → PostgreSQL. Không có DAO JSON, importer JSON, chế độ fallback hay tự seed khi khởi động.

## Khởi tạo database mới

Cài PostgreSQL 16+, Java 17+. Tạo user và database:

```bash
createuser --login --pwprompt airport_map
createdb --owner=airport_map airport_map
psql -h localhost -U airport_map -d airport_map -v ON_ERROR_STOP=1 -f Back-End/database/01_schema.sql
psql -h localhost -U airport_map -d airport_map -v ON_ERROR_STOP=1 -f Back-End/database/02_seed.sql
```

`01_schema.sql` tạo thẳng sáu bảng chuẩn, không tạo bảng tạm rồi chuyển đổi. `02_seed.sql` chứa INSERT SQL cho 705 địa điểm, danh mục, liên kết và giá trị sequence. Hai file tách cấu trúc và dữ liệu, không phải hai phiên bản schema. Chạy mỗi file một lần trên database mới; không chạy seed lên database đang sử dụng vì sẽ trùng khóa. Không cần JSON hoặc chạy backend để import.

Có thể mở và chạy hai file theo thứ tự trong Query Tool của pgAdmin/DBeaver. Trên Windows có thể tạo role/database qua pgAdmin rồi chạy SQL; các biến môi trường bên dưới dùng cú pháp macOS/Linux.

## Chạy ứng dụng

```bash
cd Back-End
DB_PASSWORD='mat-khau-da-dat' ./mvnw spring-boot:run
```

`DB_URL` mặc định `jdbc:postgresql://localhost:5432/airport_map`, `DB_USERNAME` mặc định `airport_map`, `DB_PASSWORD` mặc định rỗng cho local trust. Không commit mật khẩu. Backend không tạo/sửa schema hoặc seed tự động. Database chưa có bảng sẽ cần chạy script trước khi dùng API.

```bash
cd Front-End
npm install
npm run dev -- --port 5174
```

Frontend proxy `/api` về backend 8080. API GET/POST/PUT/DELETE `/api/locations` giữ nguyên. Tọa độ x/y là pixel SVG; lat/lng là WGS84.

Database local hiện có đã ở schema chuẩn nên giữ nguyên dữ liệu, không chạy lại script. Các bảng theo dõi Flyway/import của bản triển khai cũ không còn được ứng dụng sử dụng. Máy mới chỉ có sáu bảng nghiệp vụ.

## Kiểm thử và sao lưu

```bash
cd Back-End
DB_INTEGRATION_TEST=true ./mvnw test
pg_dump -h localhost -U airport_map -Fc airport_map > airport_map.dump
```

Chạy test trên database phát triển có seed; test CRUD rollback. Script seed là snapshot chuẩn, không tự cập nhật theo CRUD. Muốn chia sẻ chỉnh sửa mới cần xuất bản sao lưu PostgreSQL.
