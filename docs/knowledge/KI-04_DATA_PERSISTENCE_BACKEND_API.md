# KI-04: Backend REST API và PostgreSQL

## Kiến trúc

HTTP → LocationController → LocationServiceImpl → LocationDao → LocationPostgresDao → JdbcTemplate → PostgreSQL.

Controller validate request và trả 400/404/204. Service thực hiện nghiệp vụ và gọi interface DAO. DAO thực hiện JOIN, INSERT, UPDATE, DELETE trong transaction Spring. Không còn LocationJsonDao, AirportSeed, DatabaseLocationImporter, profile JSON hay cấu hình data-file. DAO đọc tiện ích bằng mảng SQL array_agg/JDBC Array, không dùng JSON để ánh xạ persistence. Service giữ transaction cho thao tác nghiệp vụ.

## Schema và dữ liệu

Tạo schema trực tiếp bằng `Back-End/database/01_schema.sql`, nạp SQL bằng `02_seed.sql`. Không dùng Flyway V1/V2 hoặc tự seed khi backend khởi động. SQL seed là nguồn dữ liệu ban đầu; CRUD chỉ ghi PostgreSQL. Cấu hình bằng DB_URL, DB_USERNAME, DB_PASSWORD.

[ERD và ràng buộc](DATABASE_SCHEMA.md), [hướng dẫn khởi tạo](../../Back-End/database/README.md).

## API giữ nguyên

GET `/api/locations` hỗ trợ `floor`; GET `/{id}`; POST thêm; PUT `/{id}` sửa; DELETE `/{id}` xóa. DTO vẫn có terminal, floor, type, facilities. DAO ánh xạ floor_id/type_code và bảng liên kết về DTO. Tiện ích trống hoặc trùng bị trả 400. Xóa địa điểm cascade liên kết tiện ích; các khóa ngoại còn lại chặn xóa danh mục đang dùng.

ID BIGINT giữ nguyên ID nguồn. Sequence sinh ID mới lớn hơn ID đã seed. x/y pixel và lat/lng địa lý lưu riêng, không đổi tọa độ khi seed.
