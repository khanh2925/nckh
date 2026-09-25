# Airport Indoor Map

Prototype bản đồ sân bay gồm hai phần tách biệt:

```text
React + Leaflet + Bootstrap  →  Spring Boot REST API  →  Back-End/data/locations.json
```

Chưa sử dụng database, đăng nhập hoặc Spring Security. Toàn bộ địa điểm nằm trong file
`Back-End/data/locations.json`: backend đọc file khi khởi động và ghi lại file sau mỗi lần
Admin thêm / sửa / xóa. Có thể sửa file này bằng tay khi backend đang tắt.

## 1. Chạy backend Spring Boot

Yêu cầu Java 17 trở lên. Không cần cài Maven vì project có Maven Wrapper.
**Chạy từ trong thư mục `Back-End`**, vì đường dẫn `data/locations.json` tính từ thư mục đang đứng
(đổi trong `application.properties` → `app.data-file`).

```bash
cd Back-End
./mvnw spring-boot:run        # Windows: .\mvnw.cmd spring-boot:run
```

Khi chạy đúng, log có dòng `Loaded 35 locations from ...\Back-End\data\locations.json`.

Backend chạy tại `http://localhost:8080`:

```text
GET    /api/locations            danh sách (thêm ?floor=1 để lọc theo tầng)
GET    /api/locations/5          một địa điểm
POST   /api/locations            thêm
PUT    /api/locations/5          sửa
DELETE /api/locations/5          xóa
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

## 3. Chức năng

- Bản đồ, xem nhanh khi hover, panel chi tiết, tìm kiếm không dấu, lọc theo nhóm, đổi tầng.
- **Chỉ đường**: mở một địa điểm → "Chỉ đường từ đây" (hoặc "Đến đây") → chạm địa điểm thứ hai.
  Đường đi hiện bằng các chấm, có biểu tượng người đi bộ chỉ hướng. Đi khác tầng sẽ qua thang máy / thang cuốn.
- **Admin** (chọn vai trò Admin): danh sách địa điểm theo tầng, thêm / sửa / xóa, chọn vị trí bằng cách bấm lên bản đồ.

## 4. Cấu trúc

```text
Back-End/
├─ data/locations.json                 dữ liệu địa điểm (backend đọc + ghi file này)
└─ src/main/java/vn/edu/airportmap/
   ├─ AirportMapApplication.java       điểm khởi động Spring Boot
   ├─ controller/LocationController    REST API /api/locations
   ├─ service/LocationService(+impl)   xử lý nghiệp vụ
   ├─ dao/LocationDao                  interface lưu trữ
   ├─ dao/impl/LocationJsonDao         lưu vào file JSON (sau này thay bằng JPA/PostgreSQL)
   └─ model/Location.java              một địa điểm (Lombok)

Front-End/src/
├─ App.jsx                 state chung: địa điểm, tầng, bộ lọc, địa điểm chọn, chỉ đường, admin
├─ api/locationApi.js      gọi backend (GET/POST/PUT/DELETE)
├─ components/
│  ├─ Header.jsx           tên ga, chọn tầng, vai trò
│  ├─ MapView.jsx          bản đồ Leaflet: mặt bằng SVG, marker, hover, vẽ đường đi
│  ├─ SearchBox.jsx        tìm kiếm (không phân biệt dấu)
│  ├─ CategoryFilter.jsx   lọc theo nhóm
│  ├─ LocationDetail.jsx   panel chi tiết + nút chỉ đường
│  ├─ RoutePanel.jsx       điểm đi / điểm đến, thời gian, các bước khi đổi tầng
│  ├─ AdminPanel.jsx       danh sách địa điểm cho Admin
│  └─ AdminLocationForm.jsx form thêm / sửa / xóa
├─ data/
│  ├─ terminals.js         viền nhà ga + thông số đặt mặt bằng lên bản đồ
│  ├─ floors.js            bản vẽ SVG từng tầng
│  ├─ walkways.js          mạng lối đi (điểm + đoạn nối) dùng để tìm đường
│  └─ locationTypes.js     loại địa điểm, nhóm lọc, icon, màu
└─ utils/
   ├─ projection.js        đổi pixel trên bản vẽ ↔ lat/lng
   ├─ mapProjection.js     phép chiếu của Ga T1 (dùng chung)
   ├─ routing.js           tìm đường ngắn nhất (Dijkstra)
   ├─ leaflet.js           tạo biến L toàn cục cho plugin leaflet-rotate
   └─ text.js              bỏ dấu tiếng Việt khi tìm kiếm
```

- Thêm loại địa điểm: thêm 1 dòng trong `data/locationTypes.js`.
- Thêm tầng: thêm 1 phần tử trong `data/floors.js` và các lối đi của tầng đó trong `data/walkways.js`.
- Thêm lối đi: thêm điểm (`nodes`, tọa độ pixel giống `location.x/y`) rồi nối chúng trong `edges`.
  Nối 2 điểm ở 2 tầng khác nhau = thang máy / thang cuốn.
