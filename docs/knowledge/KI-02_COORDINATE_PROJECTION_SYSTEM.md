# KI-02: Hệ Tọa Độ & Phép Chiếu Bản Đồ (Coordinate Projection System)

## 1. Bản Chất Dual-Coordinate Trong Hệ Thống

Hệ thống quản lý địa điểm sân bay sử dụng mô hình **Tọa độ Kép (Dual Coordinates)** kết hợp giữa không gian mặt bằng kiến trúc và không gian địa lý thực địa:

```text
┌────────────────────────────────────────┐         ┌────────────────────────────────────────┐
│      Không Gian Pixel Bản Vẽ (2D)      │         │      Không Gian Địa Lý WGS84 (3D)      │
│  Tọa độ: (x, y)                        │ ◄─────► │  Tọa độ: (lat, lng)                    │
│  Hệ quy chiếu: SVG 1598 x 682 px       │  Affine │  Hệ quy chiếu: EPSG:3857 (Web Mercator)│
│  Dùng cho: Vẽ sơ đồ, đồ thị di chuyển  │ Transf. │  Dùng cho: Leaflet Map, Vệ tinh thực tế│
└────────────────────────────────────────┘         └────────────────────────────────────────┘
```

1. **Không gian Pixel (`x, y`)**:
   - Tọa độ 2D trên bản vẽ mặt bằng nhà ga SVG chuẩn kích thước `1598 x 682` px.
   - Gốc tọa độ `(0, 0)` nằm ở góc trên bên trái của ảnh SVG (y hướng xuống dưới).
   - Dùng để gắn các điểm nút di chuyển (`walkways.nodes`) và vị trí chính xác của từng gian hàng/quầy thủ tục trên sơ đồ mặt bằng.

2. **Không gian Địa lý Thực (`lat, lng`)**:
   - Hệ tọa độ WGS84 / EPSG:3857 (Web Mercator) tiêu chuẩn thế giới.
   - Dùng để đặt toàn bộ sơ đồ sân bay lên bản đồ nền OSM/Carto của Leaflet.

---

## 2. Ma Trận Phép Chiếu Affine Transform (`projection.js`)

Để ánh xạ một điểm từ Pixel SVG sang Lat/Lng (và ngược lại), hệ thống sử dụng thuật toán **Affine Transformation** (Di chuyển + Xoay + Co giãn tỉ lệ) thông qua 2 điểm mốc cố định:

### Điểm mốc chuẩn (Anchors)
- **`anchor`**: Điểm mốc đầu (gốc) có tọa độ `image: [x0, y0]` tương ứng với `latlng: [lat0, lng0]`.
- **`end`**: Điểm mốc đuôi có tọa độ `image: [x1, y1]` tương ứng với `latlng: [lat1, lng1]`.
- **`depthScale`**: Hệ số co giãn theo trục sâu do bản vẽ có thể bị kéo dài/bóp méo theo chiều dọc so với thực địa.

### Các hàm cốt lõi trong `projection.js`:
```javascript
// 1. Chuyển Pixel sang LatLng Leaflet
const latlng = projection.toLatLng(x, y);

// 2. Chuyển LatLng Leaflet ngược về Pixel bản vẽ
const { x, y } = projection.toImagePoint(latlng);

// 3. Tính toán ma trận SVG Transform để đè lớp SVG lên Leaflet
// transform = matrix(ux, -uy, uy*depthScale, ux*depthScale, tx, ty)
```

---

## 3. Khắc Phục Hạn Chế Của Leaflet SVG Overlay

- Mặc định, `L.imageOverlay` hoặc `L.svgOverlay` của Leaflet chỉ hỗ trợ hình chữ nhật không xoay song song với trục kinh/vĩ tuyến.
- **Giải pháp triển khai**:
  1. Chiếu 4 góc của bản vẽ SVG `[0,0], [width, 0], [width, height], [0, height]` sang tọa độ Web Mercator.
  2. Lấy hộp bao (`bounding box: minX, maxX, minY, maxY`) tạo thành `bounds` và `viewBox` cho SVG container lớn.
  3. Sử dụng thẻ `<g transform="matrix(...)">` bên trong SVG container để xoay và đặt bản vẽ SVG gốc chính xác 100% vào vị trí địa lý của nhà ga Tân Sơn Nhất.

---

## 4. Quy Tắc Bất Biến Khi Xử Lý Tọa Độ Cho Developer & Agent

1. **Khi thêm/sửa địa điểm**:
   - Trường `x`, `y` trong model `Location` bắt buộc phải là pixel trên mặt bằng `1598 x 682`.
   - Trường `lat`, `lng` được tính toán tự động qua `projection.toLatLng(x, y)` hoặc lưu trữ tọa độ WGS84 gốc khi cào dữ liệu.
2. **Khi tính khoảng cách thực tế (Meters)**:
   - Tuyệt đối không dùng khoảng cách Euclid trực tiếp trên pixel `sqrt(dx^2 + dy^2)` vì bản vẽ bị kéo giãn không đều theo trục `y` (`depthScale`).
   - Bắt buộc phải chuyển sang LatLng và dùng hàm `latLngA.distanceTo(latLngB)` của Leaflet (được đóng gói sẵn trong `meters(a, b)` tại `routing.js`).
