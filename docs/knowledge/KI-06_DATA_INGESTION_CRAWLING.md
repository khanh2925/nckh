# KI-06: Thu Thập Dữ Liệu & Xử Lý Dữ Liệu Mẫu (Data Ingestion & Crawling)

## 1. Pipeline Thu Thập Dữ Liệu (`crawl_airport_map.py`)

Hệ thống tích hợp sẵn công cụ cào và trích xuất dữ liệu bản đồ số hoàn chỉnh từ hệ thống InMapz/Vietjet Air:

```text
InMapz API ──► crawl_airport_map.py ──► crawled_data/tan_son_nhat_full/ ──► AirportSeed ──► airport-locations.json
```

### Các bước thực thi trong `crawl_airport_map.py`:
1. **Kết nối API**: Gửi request tới InMapz endpoint của Cảng Tân Sơn Nhất.
2. **Phân loại Venue ID**:
   - `420321697272` ➔ **Ga Nội Địa T1** (`T1`)
   - `420321697575` ➔ **Ga Quốc Tế T2** (`T2`)
   - `420321772424` ➔ **Ga Nội Địa T3** (`T3`)
   - `420321697474` ➔ **Khuôn viên Sân bay** (`SGN_CAMPUS`)
3. **Tải Vector SVG Mặt bằng**: Tải toàn bộ các bản vẽ mặt bằng vector SVG theo từng tầng và chuẩn hóa tên file (loại bỏ ký tự đặc biệt không tương thích Windows/Linux như `|`, `/`).
4. **Xuất định dạng đa dạng**:
   - `locations_full_all.json`: Toàn bộ 705 POIs.
   - `locations_full_all.geojson`: Dữ liệu chuẩn WGS84 cho Leaflet / QGIS.
   - `locations_full_all.csv`: Phục vụ kiểm tra qua Excel / Pandas.

---

## 2. Cơ Chế Nạp Dữ Liệu Ban Đầu (`AirportSeed.java`)

Khi backend khởi động lần đầu tiên và file `Back-End/data/airport-locations.json` chưa tồn tại:
1. `LocationJsonDao` sẽ gọi `AirportSeed.read(objectMapper)`.
2. `AirportSeed` đọc dữ liệu từ `crawled_data/tan_son_nhat_full/locations_full_all.json` và kết hợp dữ liệu chỉnh sửa bổ sung cho T1.
3. Ánh xạ các trường POIs từ định dạng cào sang Entity `Location` chuẩn:
   - `poi_name` ➔ `name`
   - `venue_code` ➔ `terminal`
   - `floor_level` ➔ `floor`
   - `latitude`, `longitude` ➔ `lat`, `lng`
   - Tự động gán `type` tương ứng ("gate", "checkin", "restroom", "food", v.v.).
4. Lưu 705 địa điểm này thành file `Back-End/data/airport-locations.json`.

---

## 3. Quy Trình Cập Nhật Lại Dữ Liệu Gốc

Nếu cần cào lại dữ liệu mới nhất từ nguồn:
```bash
# 1. Chạy lại script crawl
python3 crawl_airport_map.py

# 2. Xóa file data cũ để backend seed lại
rm Back-End/data/airport-locations.json

# 3. Khởi động lại backend để nạp dữ liệu mới
cd Back-End && ./mvnw spring-boot:run
```

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
