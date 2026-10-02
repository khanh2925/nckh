# KI-04: Backend REST API & Lưu Trữ Dữ Liệu (Data Persistence & Backend API)

## 1. Thiết Kế Tầng Backend (Spring Boot 3)

Backend được xây dựng theo mô hình 3 lớp chuẩn nghiệp vụ (Layered Architecture):

```text
HTTP Requests ──► LocationController ──► LocationService ──► LocationDao ──► Storage (JSON / DB)
```

1. **Controller Layer (`LocationController`)**: Tiếp nhận yêu cầu HTTP, kiểm tra hợp lệ (`validate`), xử lý CORS và trả về mã trạng thái HTTP chuẩn.
2. **Service Layer (`LocationService` / `LocationServiceImpl`)**: Xử lý nghiệp vụ logic, lọc theo tầng, kiểm tra ràng buộc trước khi lưu trữ.
3. **DAO Layer (`LocationDao` / `LocationJsonDao`)**: Quản lý lưu trữ trừu tượng. Hiện tại lưu trữ dạng file JSON, sẵn sàng thay thế bằng `LocationJpaDao` (PostgreSQL/MySQL) mà không ảnh hưởng Controller/Service.

---

## 2. Chi Tiết REST API Endpoints (`/api/locations`)

Tất cả các API hỗ trợ CORS cho frontend chạy tại `http://localhost:5173` và `http://127.0.0.1:5173`.

| Phương Thức | Đường Dẫn | Tham Số / Body | Mô Tả & Mã Trả Về |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/locations` | `floor` (optional, query param) | Lấy danh sách toàn bộ hoặc lọc theo tầng. Trả về `200 OK`. |
| `GET` | `/api/locations/{id}` | `id` (path variable) | Lấy chi tiết 1 địa điểm. Trả về `200 OK` hoặc `404 Not Found`. |
| `POST` | `/api/locations` | Body: JSON Location | Thêm mới 1 địa điểm. Trả về `200 OK` với ID tự sinh hoặc `400 Bad Request`. |
| `PUT` | `/api/locations/{id}` | Body: JSON Location | Cập nhật thông tin địa điểm. Trả về `200 OK` hoặc `404 Not Found`. |
| `DELETE` | `/api/locations/{id}` | `id` (path variable) | Xóa địa điểm. Trả về `204 No Content` hoặc `404 Not Found`. |

---

## 3. Cơ Chế Lưu Trữ File JSON Atomic (`LocationJsonDao`)

Hiện tại hệ thống chưa sử dụng hệ quản trị CSDL quan hệ để giữ tính nhỏ gọn, độc lập và dễ chạy demo.

### Cơ chế hoạt động:
1. **In-Memory Cache**: Toàn bộ danh sách 705 địa điểm được tải vào bộ nhớ RAM (`List<Location> locations`) khi Spring Boot khởi động (`@PostConstruct load()`).
2. **Thread-Safety**: Tất cả các phương thức đọc/ghi (`findAll`, `findById`, `save`, `deleteById`) đều được đồng bộ hóa với từ khóa `synchronized` để ngăn chặn tranh chấp (race conditions).
3. **Atomic File Write (Ghi file nguyên tử)**:
   - Khi có thay đổi (POST/PUT/DELETE), backend ghi toàn bộ danh sách ra một file tạm (`locations-*.json`).
   - Sử dụng `Files.move(..., REPLACE_EXISTING, ATOMIC_MOVE)` để hoán đổi file tạm vào file chính thức `Back-End/data/airport-locations.json`.
   - **Lợi ích**: Không bao giờ xảy ra tình trạng file JSON bị hỏng hoặc mất dữ liệu giữa chừng nếu tiến trình bị tắt đột ngột lúc đang ghi.

---

## 4. Entity Model `Location`

```java
@JsonInclude(JsonInclude.Include.NON_NULL) // Bỏ qua các trường null khi serialize JSON
public class Location {
    private Long id;
    private String name;            // Tên địa điểm (bắt buộc)
    private String type;            // Loại: "gate", "restroom", "food", "atm",...
    private String terminal;        // "T1", "T2", "T3" (mặc định "T1")
    private Integer floor;          // Số tầng: 0, 1, 2, 3...
    private Double x;               // Pixel X trên bản vẽ 1598x682
    private Double y;               // Pixel Y trên bản vẽ 1598x682
    private Double lat;             // Tọa độ vĩ độ WGS84
    private Double lng;             // Tọa độ kinh độ WGS84
    private Long sourceId;          // ID nguồn cào (nếu có)
    private String phone;           // Số điện thoại (tùy chọn)
    private String website;         // Website (tùy chọn)
    private String area;            // Khu vực ("Ga Quốc nội", "Ga đến",...)
    private String description;     // Mô tả chi tiết
    private String openingHours;    // Giờ mở cửa
    private List<String> facilities;// Tiện ích đi kèm
}
```

---

## 5. Lộ Trình Nâng Cấp Lên RDBMS (PostgreSQL / MySQL)

Khi cần mở rộng dự án lên cấp sản phẩm thực tế:
1. Thêm dependency `spring-boot-starter-data-jpa` và driver database vào `pom.xml`.
2. Tạo interface `SpringDataLocationRepository extends JpaRepository<LocationEntity, Long>`.
3. Tạo class `LocationJpaDao implements LocationDao` được đánh dấu `@Repository` (và thay thế `@Primary` cho `LocationJsonDao`).
4. Toàn bộ `LocationService` và `LocationController` sẽ hoạt động trơn tru 100% mà không cần sửa 1 dòng code nào.

---

## Cập nhật PostgreSQL — 2026-10-02 (thay thế mô tả lưu trữ mặc định ở trên)

## PostgreSQL (mặc định)

Backend dùng Spring JDBC qua `LocationDao`; Flyway quản lý schema. API và frontend giữ nguyên.
Cài PostgreSQL 16+ trực tiếp, không cần Docker. Tạo user và database trên máy mới:

```bash
createuser --login --pwprompt airport_map
createdb --owner=airport_map airport_map
cd Back-End
DB_PASSWORD='mat-khau-da-dat' ./mvnw spring-boot:run
```

Cấu hình bằng biến môi trường: `DB_URL` (mặc định `jdbc:postgresql://localhost:5432/airport_map`),
`DB_USERNAME` (mặc định `airport_map`), `DB_PASSWORD` (mặc định rỗng cho local đã cấu hình trust).
Không commit mật khẩu. Database local trên máy hiện tại đã được tạo với user `airport_map`.

Lần đầu backend nhập `data/airport-locations.json` trong một transaction, giữ nguyên ID,
hai hệ tọa độ và tất cả trường dữ liệu. Sequence tự tăng bắt đầu sau ID lớn nhất.
Bảng `data_imports` đánh dấu lần nhập; restart không ghi đè chỉnh sửa hoặc khôi phục điểm đã xóa,
kể cả khi đã xóa hết địa điểm. JSON gốc được giữ nguyên và không còn là nơi nhận CRUD.
Không sửa migration đã chạy; thêm `V2__...sql` khi thay đổi schema.
`DB_IMPORT_JSON=false` bỏ nhập JSON để dùng database có dữ liệu sẵn.
Nếu nhập thất bại, dữ liệu và marker rollback; sửa lỗi rồi khởi động lại.

Chạy chế độ JSON cũ khi cần:

```bash
cd Back-End
./mvnw spring-boot:run -Dspring-boot.run.profiles=json
```

Sao lưu database:

```bash
pg_dump -h localhost -U airport_map -Fc airport_map > airport_map.dump
```


## Schema quan hệ chuẩn hóa (V2)

PostgreSQL có sáu bảng nghiệp vụ: `terminals`, `floors`, `location_types`, `locations`, `facilities`, `location_facilities`. Khóa ngoại và unique constraints giữ toàn vẹn dữ liệu. DAO JOIN để giữ hợp đồng API hiện tại; dữ liệu JSON chỉ dùng seed. Xem [schema, ERD và quy tắc migration](DATABASE_SCHEMA.md). V2 nâng cấp dữ liệu cũ trong transaction; không sửa V1.
