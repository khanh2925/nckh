# KI-04: Backend REST API và PostgreSQL

## Kiến trúc

HTTP → LocationController → LocationServiceImpl → LocationRepository (Spring Data JPA) → Hibernate → PostgreSQL.

HTTP → WalkwayController → WalkwayServiceImpl → WalkwayNodeRepository / WalkwayEdgeRepository → Hibernate → PostgreSQL.

Controller validate request và trả 400/404/204. Service thực hiện nghiệp vụ trong transaction Spring, gọi các repository và dùng `LocationMapper` / `WalkwayMapper` để chuyển entity ↔ DTO. Không còn tầng DAO/JdbcTemplate, LocationJsonDao, AirportSeed, DatabaseLocationImporter, profile JSON hay cấu hình data-file.

| Gói | Nội dung |
| :--- | :--- |
| `entity/` | `Terminal`, `Floor`, `LocationType`, `Facility`, `Location` (`01_schema.sql`); `WalkwayNode`, `WalkwayEdge` + khóa `WalkwayEdgeId` (`03_walkways_schema.sql`) |
| `repository/` | Interface `extends JpaRepository`; truy vấn theo tên method như `findByFloor_LevelOrderByIdAsc`, `findByTerminal_CodeAndLevel`, `findByName` |
| `dto/` | `LocationDto`, `WalkwayNetworkDto`, `WalkwayNodeDto`, `WalkwayEdgeDto`: hình dạng JSON trả cho front-end, giữ nguyên như trước khi chuyển JPA |
| `mapper/` | `LocationMapper`, `WalkwayMapper` viết tay (không dùng MapStruct) |

## Ánh xạ quan hệ

- `Location` → `Floor`: `@ManyToOne` qua `floor_id`; `Floor` → `Terminal`: `@ManyToOne` qua `terminal_code`; `Location` → `LocationType`: `@ManyToOne` qua `type_code`.
- Tiện ích: `@ManyToMany` qua bảng nối `location_facilities`, thứ tự lưu ở cột `position` bằng `@OrderColumn`. Service luôn gán một `List` mới khi lưu, để Hibernate xóa toàn bộ dòng nối cũ rồi chèn lại, tránh vi phạm khóa `(location_id, facility_id)` và `(location_id, position)` khi đổi thứ tự.
- `facilities_known = false` → API trả `facilities: null`; `true` → trả danh sách (có thể rỗng).
- ID mới lấy từ `location_id_seq` (`@SequenceGenerator`, `allocationSize = 1`); ID seed giữ nguyên.
- Truy vấn danh sách dùng `@EntityGraph` để nạp floor, terminal, type, facilities trong một câu SQL (tránh N+1).
- Lối đi: `WalkwayNode` → `Floor` là `@ManyToOne` qua `floor_id`; `WalkwayEdge` dùng `@EmbeddedId` `(from_id, to_id)`, khóa ngoại tới node do database kiểm tra.
- `PUT /api/walkways` thay toàn bộ mạng trong một transaction: `deleteAllInBatch()` cạnh rồi node, sau đó `saveAll`. Node và cạnh có ID do client đặt nên implement `Persistable` (`isNew`) để Hibernate INSERT thẳng, không SELECT trước từng dòng; insert gửi theo lô (`hibernate.jdbc.batch_size=500`). Tầng không tồn tại → service ném `IllegalArgumentException` → controller trả 400. Kiểm tra này phải nằm ở service: nếu đặt trong bean `@Repository`, Spring đổi exception thành `InvalidDataAccessApiUsageException` và API trả 500.
- Terminal, tầng, loại và tiện ích chưa có sẽ được tạo khi thêm/sửa địa điểm (find-or-create trong service), giống hành vi API cũ.

## Đăng nhập quản trị (Spring Security + JWT)

- Ai cũng **đọc** được: `GET /api/**` mở. **Ghi** (POST/PUT/DELETE `/api/**`) cần role `ADMIN` (`security/SecurityConfig.java`). Không có/hết hạn/sai chữ ký token → 401; token không có role ADMIN → 403.
- `POST /api/auth/login` `{ username, password }` → `{ token, username, expiresAt }` (`controller/AuthController.java`). Tài khoản duy nhất lấy từ biến môi trường `ADMIN_USERNAME` (mặc định `admin`) và `ADMIN_PASSWORD` (băm BCrypt khi khởi động). Không đặt `ADMIN_PASSWORD` → không ai đăng nhập được, API chỉ đọc.
- Token: JWT HS256 (`security/TokenService.java`), claim `roles: ["ADMIN"]`, sống `app.jwt.lifetime` (8h). Khóa = SHA-256 của `JWT_SECRET`; trống thì sinh ngẫu nhiên mỗi lần khởi động (token cũ mất hiệu lực sau restart). Stateless, không session/cookie nên tắt CSRF.
- Chống dò mật khẩu: sai 5 lần trong 15 phút từ một địa chỉ → 429 (`security/LoginAttemptService.java`, lưu trong bộ nhớ). Địa chỉ thật sau proxy Render nhờ `server.forward-headers-strategy=native`.
- CORS vẫn cấu hình ở `config/WebConfig.java` (Security dùng lại qua `.cors()`); header `Authorization` được phép.
- Test: `SecurityTest` (WebMvcTest, không cần database) kiểm tra đọc mở, ghi cần token, token giả/hết hạn/thiếu role, khóa sau 5 lần sai, CORS.
- Không còn `READ_ONLY`/interceptor chỉ-đọc cũ.

## Schema và dữ liệu

Tạo schema trực tiếp bằng `Back-End/database/01_schema.sql`, nạp SQL bằng `02_seed.sql`. `spring.jpa.hibernate.ddl-auto=none`: Hibernate không tạo hay sửa bảng. Không dùng Flyway V1/V2 hoặc tự seed khi backend khởi động. Cấu hình bằng DB_URL, DB_USERNAME, DB_PASSWORD. `spring.jpa.open-in-view=false`, mọi truy cập lazy nằm trong transaction của service.

[ERD và ràng buộc](DATABASE_SCHEMA.md), [hướng dẫn khởi tạo](../../Back-End/database/README.md).

## API giữ nguyên

GET/PUT `/api/walkways` trả và nhận `{ nodes, edges }`; cạnh A-B và B-A gộp làm một. GET `/api/locations` hỗ trợ `floor` (lọc theo số tầng trên mọi nhà ga); GET `/{id}`; POST thêm; PUT `/{id}` sửa; DELETE `/{id}` xóa. DTO vẫn có terminal, floor, type, facilities. Tiện ích trống hoặc trùng bị trả 400. Xóa địa điểm xóa luôn liên kết tiện ích; các khóa ngoại còn lại chặn xóa danh mục đang dùng.

x/y pixel và lat/lng địa lý lưu riêng, không đổi tọa độ khi seed.

## Kiểm thử

`PostgresPersistenceTest` và `WalkwayPersistenceTest` (bật bằng `DB_INTEGRATION_TEST=true`, database cần chạy đủ 01–04) chạy qua service, flush entity rồi kiểm tra bảng bằng `JdbcTemplate`, rollback sau mỗi test.
