# KI-04: Backend REST API và PostgreSQL

## Kiến trúc

HTTP → LocationController → LocationServiceImpl → LocationRepository (Spring Data JPA) → Hibernate → PostgreSQL.

Controller validate request và trả 400/404/204. Service thực hiện nghiệp vụ trong transaction Spring, gọi các repository và dùng `LocationMapper` để chuyển entity ↔ `LocationDto`. Không còn tầng DAO/JdbcTemplate, LocationJsonDao, AirportSeed, DatabaseLocationImporter, profile JSON hay cấu hình data-file.

| Gói | Nội dung |
| :--- | :--- |
| `entity/` | `Terminal`, `Floor`, `LocationType`, `Facility`, `Location` (`@Entity`) ánh xạ đúng các bảng trong `01_schema.sql` |
| `repository/` | Interface `extends JpaRepository`; truy vấn theo tên method như `findByFloor_LevelOrderByIdAsc`, `findByTerminal_CodeAndLevel`, `findByName` |
| `dto/` | `LocationDto`: hình dạng JSON trả cho front-end, giữ nguyên như trước khi chuyển JPA |
| `mapper/` | `LocationMapper` viết tay (không dùng MapStruct) |

## Ánh xạ quan hệ

- `Location` → `Floor`: `@ManyToOne` qua `floor_id`; `Floor` → `Terminal`: `@ManyToOne` qua `terminal_code`; `Location` → `LocationType`: `@ManyToOne` qua `type_code`.
- Tiện ích: `@ManyToMany` qua bảng nối `location_facilities`, thứ tự lưu ở cột `position` bằng `@OrderColumn`. Service luôn gán một `List` mới khi lưu, để Hibernate xóa toàn bộ dòng nối cũ rồi chèn lại, tránh vi phạm khóa `(location_id, facility_id)` và `(location_id, position)` khi đổi thứ tự.
- `facilities_known = false` → API trả `facilities: null`; `true` → trả danh sách (có thể rỗng).
- ID mới lấy từ `location_id_seq` (`@SequenceGenerator`, `allocationSize = 1`); ID seed giữ nguyên.
- Truy vấn danh sách dùng `@EntityGraph` để nạp floor, terminal, type, facilities trong một câu SQL (tránh N+1).
- Terminal, tầng, loại và tiện ích chưa có sẽ được tạo khi thêm/sửa địa điểm (find-or-create trong service), giống hành vi API cũ.

## Schema và dữ liệu

Tạo schema trực tiếp bằng `Back-End/database/01_schema.sql`, nạp SQL bằng `02_seed.sql`. `spring.jpa.hibernate.ddl-auto=none`: Hibernate không tạo hay sửa bảng. Không dùng Flyway V1/V2 hoặc tự seed khi backend khởi động. Cấu hình bằng DB_URL, DB_USERNAME, DB_PASSWORD. `spring.jpa.open-in-view=false`, mọi truy cập lazy nằm trong transaction của service.

[ERD và ràng buộc](DATABASE_SCHEMA.md), [hướng dẫn khởi tạo](../../Back-End/database/README.md).

## API giữ nguyên

GET `/api/locations` hỗ trợ `floor` (lọc theo số tầng trên mọi nhà ga); GET `/{id}`; POST thêm; PUT `/{id}` sửa; DELETE `/{id}` xóa. DTO vẫn có terminal, floor, type, facilities. Tiện ích trống hoặc trùng bị trả 400. Xóa địa điểm xóa luôn liên kết tiện ích; các khóa ngoại còn lại chặn xóa danh mục đang dùng.

x/y pixel và lat/lng địa lý lưu riêng, không đổi tọa độ khi seed.

## Kiểm thử

`PostgresPersistenceTest` (bật bằng `DB_INTEGRATION_TEST=true`) chạy CRUD qua `LocationService`, flush entity rồi kiểm tra bảng bằng `JdbcTemplate`, rollback sau mỗi test.
