# Airport Indoor Map

Prototype bản đồ sân bay gồm hai phần tách biệt:

```text
React + Leaflet + Bootstrap  →  Spring Boot REST API
```

Chưa sử dụng database, đăng nhập hoặc Spring Security. Dữ liệu địa điểm mẫu nằm trong
`Back-End/src/main/resources/data/locations.json` và được nạp vào bộ nhớ khi backend khởi động
(địa điểm thêm bằng Admin sẽ mất khi tắt backend).

## 1. Chạy backend Spring Boot

Yêu cầu Java 17 trở lên. Không cần cài Maven vì project có Maven Wrapper.

```bash
cd Back-End
./mvnw spring-boot:run        # Windows PowerShell: .\mvnw.cmd spring-boot:run
```

Backend chạy tại `http://localhost:8080`. API kiểm tra:

```text
GET  http://localhost:8080/api/locations
GET  http://localhost:8080/api/locations?floor=1
GET  http://localhost:8080/api/locations/5
POST http://localhost:8080/api/locations
```

## 2. Chạy frontend React

Yêu cầu Node 20.19+ hoặc 22.12+. Mở Terminal thứ hai:

```bash
cd Front-End
npm install
npm run dev
```

Mở `http://localhost:5173`.

Xem trên điện thoại: điện thoại và máy tính dùng chung Wi-Fi, mở địa chỉ `Network` mà Vite in ra
(ví dụ `http://192.168.1.5:5173`). Nếu Windows hỏi quyền tường lửa cho Node.js, chọn cho phép.

## 3. Cấu trúc

```text
Back-End/src/main/
├─ java/vn/edu/airportmap/
│  ├─ AirportMapApplication.java      điểm khởi động Spring Boot
│  ├─ controller/LocationController   REST API /api/locations
│  ├─ service/LocationService         interface
│  ├─ service/impl/LocationServiceImpl  đọc locations.json, giữ danh sách trong bộ nhớ
│  └─ model/Location.java             một địa điểm (Lombok)
└─ resources/data/locations.json      dữ liệu mẫu

Front-End/src/
├─ App.jsx               state chung: địa điểm, tầng, bộ lọc, địa điểm đang chọn
├─ api/locationApi.js    gọi backend
├─ components/
│  ├─ Header.jsx         tên ga, chọn tầng, vai trò
│  ├─ MapView.jsx        bản đồ Leaflet: mặt bằng SVG, marker, xem nhanh khi hover
│  ├─ SearchBox.jsx      tìm kiếm (không phân biệt dấu)
│  ├─ CategoryFilter.jsx lọc theo nhóm
│  ├─ LocationDetail.jsx panel chi tiết (desktop) / bottom sheet (điện thoại)
│  └─ AdminForm.jsx      thêm địa điểm
├─ data/
│  ├─ terminals.js       viền nhà ga + thông số đặt mặt bằng lên bản đồ
│  ├─ floors.js          bản vẽ SVG từng tầng
│  └─ locationTypes.js   loại địa điểm, nhóm lọc, icon, màu
└─ utils/
   ├─ projection.js      đổi pixel trên bản vẽ ↔ lat/lng
   ├─ leaflet.js         tạo biến L toàn cục cho plugin leaflet-rotate
   └─ text.js            bỏ dấu tiếng Việt khi tìm kiếm
```

Thêm một loại địa điểm mới: thêm 1 dòng trong `data/locationTypes.js`.
Thêm một tầng mới: thêm 1 phần tử trong `data/floors.js`.
