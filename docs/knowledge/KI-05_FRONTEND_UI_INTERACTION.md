# KI-05: Giao Diện Người Dùng & Tương Tác React (Frontend UI & Interaction)

## 1. Kiến Trúc Quản Lý Trạng Thái (Central State Management)

Ứng dụng Frontend được thiết kế theo mô hình State tập trung tại `App.jsx`, đóng vai trò là "Single Source of State" điều phối luồng dữ liệu xuống các components con:

```text
                             ┌──────────────┐
                             │   App.jsx    │
                             └──────┬───────┘
         ┌──────────────────┬───────┴──────────┬─────────────────┐
         ▼                  ▼                  ▼                 ▼
   ┌───────────┐      ┌───────────┐      ┌───────────┐     ┌───────────┐
   │  Header   │      │  MapView  │      │ SearchBox │     │ Admin/    │
   │ (Ga/Tầng) │      │ (Leaflet) │      │ (Tiếng V) │     │ Routing   │
   └───────────┘      └───────────┘      └───────────┘     └───────────┘
```

### Các State Trọng Tâm:
1. **Dữ liệu & Định danh**:
   - `locations`: Danh sách toàn bộ địa điểm tải từ backend (`GET /api/locations`).
   - `terminal` & `floor`: Nhà ga đang chọn (`T1`, `T2`, `T3`) và Tầng đang hiển thị (`0`, `1`, `2`, `3`).
   - `selectedId`: ID của địa điểm đang được mở popup chi tiết (`LocationDetail.jsx`).
2. **Chế độ Chỉ đường (Routing Mode)**:
   - `isRouting`: Cờ bật/tắt giao diện chỉ đường.
   - `routeFromId`, `routeToId`: Điểm xuất phát và điểm đích.
   - `route`: Kết quả tính toán từ `useMemo` gọi `findRoute(from, to)`.
3. **Chế độ Quản trị (Admin Mode)**:
   - `role`: `"user"` hoặc `"admin"`.
   - `editingId`: ID địa điểm đang chỉnh sửa hoặc `"new"` khi thêm mới.
   - `isPicking` & `pickedPoint`: Chế độ nhấp trực tiếp lên bản đồ để lấy tọa độ pixel (`x, y`).

---

## 2. Các Thành Phần Giao Diện Chính

### 2.1. Bản Đồ Tương Tác (`MapView.jsx`)
- Sử dụng **Leaflet** kết hợp plugin xoay bản đồ `leaflet-rotate`.
- **Lớp phủ mặt bằng (SVG Floor Overlay)**: Tự động đổi file SVG mặt bằng theo `terminal` và `floor` tương ứng (được định nghĩa trong `data/floors.js`).
- **Render Marker**:
  - Tự động gán Icon và Màu sắc dựa trên phân loại loại địa điểm (`data/locationTypes.js`).
  - Hỗ trợ tooltip xem nhanh khi hover chuột (`Hover Preview`).
- **Tương tác click trên bản đồ**:
  - Ở chế độ Admin Pick: Bắt sự kiện click để lấy tọa độ pixel `projection.toImagePoint(latlng)`.
  - Ở chế độ xem: Mở chi tiết địa điểm hoặc chọn điểm đi/đến.

### 2.2. Tìm Kiếm Thông Minh Bỏ Dấu Tiếng Việt (`SearchBox.jsx` & `text.js`)
- Người dùng có thể tìm kiếm không dấu hoặc có dấu (Ví dụ: `cua 14` tìm ra `Cửa 14`, `ve sinh` tìm ra `Nhà vệ sinh`).
- Hàm `normalizeText` trong `text.js` chuẩn hóa ký tự Unicode và loại bỏ toàn bộ dấu thanh/dấu mũ tiếng Việt.

### 2.3. Lọc Theo Nhóm Danh Mục (`CategoryFilter.jsx`)
- Phân loại trực quan:
  - 🚪 **Cửa ra máy bay (Gates)**
  - 🛂 **Thủ tục & An ninh (Check-in, Security)**
  - 🍜 **Ăn uống & Mua sắm (F&B, Duty Free)**
  - 🚻 **Tiện ích công cộng (Restrooms, ATM, Information)**
  - 🚗 **Giao thông & Đỗ xe (Taxi, Parking, Shuttle Bus)**

### 2.4. Quản Trị Trực Tiếp Cho Admin (`AdminPanel.jsx` & `AdminLocationForm.jsx`)
- Cho phép Admin xem danh sách theo tầng, tìm kiếm, sửa thông tin, xóa và thêm địa điểm mới.
- Tính năng **Chọn tọa độ trực quan trên bản đồ (Point Picker)**: Admin chỉ cần nhấn "Chọn trên bản đồ" và click vào vị trí mong muốn, tọa độ pixel `x, y` và `lat, lng` sẽ tự động điền vào form.

## API khi deploy cloud

locationApi.js dùng VITE_API_BASE_URL là origin Render ở production; không đặt biến thì dùng /api qua Vite proxy. Không đặt credentials database trong frontend. Chi tiết tại [hướng dẫn](../CLOUD_DEPLOYMENT.md).
