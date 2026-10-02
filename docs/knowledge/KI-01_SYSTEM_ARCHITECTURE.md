# KI-01: Tổng Quan Kiến Trúc Hệ Thống (System Architecture)

## 1. Mục Tiêu Dự Án & Bối Cảnh
Dự án **Airport Indoor Map (NCKH)** xây dựng nền tảng bản đồ số tương tác và hệ thống dẫn đường trong nhà (Indoor Navigation) cho Cảng hàng không quốc tế Tân Sơn Nhất (bao gồm Nhà ga T1 - Quốc nội, T2 - Quốc tế, T3 - Nhà ga mới và khuôn viên sân bay).

Dự án hướng đến trải nghiệm tương tự các hệ thống bản đồ số hiện đại (như bản đồ sàn AEON Mall, trung tâm thương mại / sân bay lớn trên thế giới) với khả năng hiển thị đa tầng trực quan, tìm kiếm nhanh, định tuyến thông minh và quản trị địa điểm trực tiếp trên bản đồ.

---

## 2. Mô Hình Kiến Trúc Tách Rời (Decoupled Architecture)

Hệ thống được thiết kế theo kiến trúc phân tách Client - Server hoàn toàn độc lập:

```text
┌─────────────────────────────────────────────────────────────┐
│                       FRONTEND LAYER                        │
│    React 18 + Leaflet + Leaflet-Rotate + Bootstrap 5        │
│    - Render SVG mặt bằng từng tầng                          │
│    - Render Markers, Polyline chỉ đường, Animation người đi │
│    - State & Routing Engine (Dijkstra chạy trực tiếp Client)│
└──────────────┬──────────────────────────────▲───────────────┘
               │ HTTP GET/POST/PUT/DELETE     │ JSON Data
               │ (Axios/Fetch qua LocationApi)│ (705+ Locations)
┌──────────────▼──────────────────────────────┴───────────────┐
│                       BACKEND LAYER                         │
│             Spring Boot 3 REST API (Port 8080)              │
│    - LocationController (/api/locations)                    │
│    - LocationService (Business Logic)                       │
│    - LocationJsonDao (Thread-safe In-Memory + Atomic Write) │
└──────────────┬──────────────────────────────────────────────┘
               │ Read/Write Sync
┌──────────────▼──────────────────────────────────────────────┐
│                    DATA STORAGE LAYER                       │
│    - File JSON: Back-End/data/airport-locations.json        │
│    - Raw Seed: crawled_data/tan_son_nhat_full               │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Cấu Trúc Mã Nguồn (Codebase Organization)

```text
nckh/
├── Back-End/                              # Backend Spring Boot
│   ├── data/
│   │   └── airport-locations.json         # File dữ liệu JSON chính (705 địa điểm)
│   ├── src/main/java/vn/edu/airportmap/
│   │   ├── AirportMapApplication.java     # Entry point Spring Boot
│   │   ├── controller/
│   │   │   └── LocationController.java    # REST API Endpoints
│   │   ├── service/
│   │   │   ├── LocationService.java       # Interface nghiệp vụ
│   │   │   └── impl/LocationServiceImpl.java
│   │   ├── dao/
│   │   │   ├── LocationDao.java           # Interface truy xuất dữ liệu
│   │   │   └── impl/
│   │   │       ├── LocationJsonDao.java   # Lưu file JSON Atomic
│   │   │       └── AirportSeed.java       # Nạp dữ liệu mặc định từ crawled_data
│   │   └── model/
│   │       └── Location.java              # Entity địa điểm
│   └── pom.xml / mvnw                     # Maven Build Config
│
├── Front-End/                             # Frontend React (Vite)
│   ├── public/maps/                       # Bản vẽ SVG mặt bằng các tầng (T1, T2, T3)
│   ├── src/
│   │   ├── App.jsx                        # State trung tâm (tầng, chọn điểm, route, admin)
│   │   ├── api/locationApi.js             # Client gọi REST API
│   │   ├── components/
│   │   │   ├── Header.jsx                 # Thanh tiêu đề, chọn nhà ga, tầng & vai trò
│   │   │   ├── MapView.jsx                # Bản đồ Leaflet, SVG overlay, marker & vẽ đường
│   │   │   ├── SearchBox.jsx              # Tìm kiếm tiếng Việt bỏ dấu
│   │   │   ├── CategoryFilter.jsx         # Lọc theo danh mục (Cửa ra máy bay, Ăn uống...)
│   │   │   ├── LocationDetail.jsx         # Panel thông tin chi tiết & nút "Chỉ đường"
│   │   │   ├── RoutePanel.jsx             # Panel hiển thị chặng đường, thời gian & đổi tầng
│   │   │   ├── AdminPanel.jsx             # Danh sách địa điểm cho Admin quản trị
│   │   │   └── AdminLocationForm.jsx      # Form thêm/sửa/xóa địa điểm
│   │   ├── data/
│   │   │   ├── terminals.js               # Cấu hình nhà ga & thông số đặt SVG lên bản đồ
│   │   │   ├── floors.js                  # Danh mục tầng & file SVG tương ứng
│   │   │   ├── walkways.js                # Đồ thị mạng lối đi (nodes & edges)
│   │   │   └── locationTypes.js           # Định nghĩa nhóm loại địa điểm, icon, màu sắc
│   │   └── utils/
│   │       ├── projection.js              # Chuyển đổi Pixel SVG ↔ Lat/Lng WGS84
│   │       ├── mapProjection.js           # Phép chiếu chuẩn của sân bay
│   │       ├── routing.js                 # Thuật toán Dijkstra tìm đường ngắn nhất
│   │       ├── leaflet.js                 # Polyfill plugin leaflet-rotate
│   │       └── text.js                    # Hàm loại bỏ dấu tiếng Việt chuẩn hóa
│   └── package.json / vite.config.js
│
├── crawled_data/                          # Dữ liệu cào nguyên bản của sân bay
├── crawl_airport_map.py                   # Script Python cào dữ liệu bản đồ
├── AGENTS.md                              # Chỉ dẫn cho AI Agents
└── docs/knowledge/                        # Hệ thống KIs (Bộ nhớ dài hạn)
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


## Schema quan hệ chuẩn hóa (V2)

PostgreSQL có sáu bảng nghiệp vụ: `terminals`, `floors`, `location_types`, `locations`, `facilities`, `location_facilities`. Khóa ngoại và unique constraints giữ toàn vẹn dữ liệu. DAO JOIN để giữ hợp đồng API hiện tại; dữ liệu JSON chỉ dùng seed. Xem [schema, ERD và quy tắc migration](DATABASE_SCHEMA.md). V2 nâng cấp dữ liệu cũ trong transaction; không sửa V1.
