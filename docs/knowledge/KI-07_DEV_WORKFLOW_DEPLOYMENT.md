# KI-07: Hướng Dẫn Phát Triển & Triển Khai (Development & Deployment)

## 1. Yêu Cầu Môi Trường (Prerequisites)

- **Java**: Phiên bản 17 trở lên (`java -version`).
- **Node.js**: Phiên bản 20.19+ hoặc 22.12+ (`node -v`).
- **Python** (tùy chọn, chỉ khi cào lại dữ liệu): Python 3.8+.
- **Trình duyệt**: Hỗ trợ HTML5 Canvas và SVG (Chrome, Firefox, Safari, Edge).

---

## 2. Hướng Dẫn Chạy Môi Trường Phát Triển (Local Dev)

### 2.1. Khởi động Backend (Spring Boot)
Không cần cài đặt Maven rời vì project có sẵn Maven Wrapper:

```bash
cd Back-End
./mvnw spring-boot:run          # Trên macOS / Linux
# .\mvnw.cmd spring-boot:run     # Trên Windows Command Prompt
```
> **Lưu ý quan trọng**: Phải chạy lệnh từ bên trong thư mục `Back-End/` để đường dẫn cấu hình `app.data-file=data/airport-locations.json` trong `application.properties` được nhận diện chính xác.

### 2.2. Khởi động Frontend (React + Vite)
Mở một cửa sổ Terminal thứ hai:

```bash
cd Front-End
npm install
npm run dev
```
Mở trình duyệt tại: `http://localhost:5173`.

---

## 3. Xử Lý Trùng Lặp Cổng (Port Conflict Handling)

Nếu cổng `8080` (Backend) hoặc `5173` (Frontend) đang bị ứng dụng khác chiếm dụng:

### Đổi cổng Backend sang `8081`:
```bash
cd Back-End
./mvnw spring-boot:run -Dspring-boot.run.arguments=--server.port=8081
```

### Chạy Frontend trên cổng `5174` và trỏ API về `8081`:
```bash
cd Front-End
AIRPORT_MAP_API_URL=http://localhost:8081 npm run dev -- --port 5174
```

---

## 4. Kiểm Thử Trực Tiếp Trên Điện Thoại Di Động (Mobile Testing via Wi-Fi)

1. Đảm bảo máy tính và điện thoại cùng kết nối vào một mạng Wi-Fi.
2. Vite sẽ hiển thị đường dẫn `Network` (ví dụ `http://192.168.1.15:5173`).
3. Mở địa chỉ trên trong trình duyệt của điện thoại di động để kiểm thử giao diện chạm, vuốt và xoay màn hình.

---

## 5. Quy Chuẩn Mở Rộng Hệ Thống (Extending the System)

### 1. Thêm loại địa điểm mới:
- Mở `Front-End/src/data/locationTypes.js`.
- Thêm key loại mới cùng `label`, `group`, `icon` (Lucide React) và `color`.

### 2. Thêm tầng hoặc nhà ga mới:
- Thêm file vector SVG vào `Front-End/public/maps/`.
- Khai báo thông tin tầng trong `Front-End/src/data/floors.js`.
- Bổ sung thông số bounding box và phép chiếu trong `Front-End/src/data/terminals.js`.

### 3. Mở rộng mạng lưới chỉ đường:
- Mở `Front-End/src/data/walkways.js`.
- Thêm các điểm nút (`nodes`) với tọa độ pixel trên bản vẽ.
- Nối các nút vào mảng `edges`. Nối 2 nút khác tầng với `connector: "Thang máy"` hoặc `connector: "Thang cuốn"`.

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
