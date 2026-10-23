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
   - `routeFrom`, `routeTo`: Điểm xuất phát và điểm đích, là một địa điểm hoặc một vị trí bất kỳ bấm trên mặt bằng (`isPoint: true`).
   - `pickTarget`: đầu nào sẽ nhận cú bấm tiếp theo trên bản đồ (nút tâm ngắm trong `RoutePanel`); mặc định là đầu còn thiếu.
   - `route`: Kết quả tính toán từ `useMemo` gọi `findRoute(walkways, from, to)` (xem KI-03).
3. **Chế độ Quản trị (Admin Mode)**:
   - `role`: `"user"` hoặc `"admin"`.
   - `editingId`: ID địa điểm đang chỉnh sửa hoặc `"new"` khi thêm mới.
   - `isPicking` & `pickedPoint`: Chế độ nhấp trực tiếp lên bản đồ để lấy tọa độ `lat, lng`.
   - `adminTab`: `"locations"` (CRUD địa điểm) hoặc `"walkways"` (vẽ lối đi bằng `useWalkwayEditor`).

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

- Kết quả ưu tiên nhà ga rồi tầng đang xem, ghi rõ `Loại · Ga · Tầng · Khu`. Bàn phím: ↑ ↓ chọn, Enter mở, Esc đóng (combobox/listbox ARIA). Danh sách đóng khi ô tìm kiếm mất focus.

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

## 2.5. Quy ước giao diện điện thoại (< 768px)

- Header 2 dòng: logo + ô chọn nhà ga (đóng vai trò tiêu đề); dòng dưới là tab tầng tên ngắn (`floorLabel`: "Tầng trệt", "Tầng 1"), tên đầy đủ ở `title`.
- Chi tiết địa điểm, chỉ đường, Admin là bottom sheet trượt lên. Khi chọn địa điểm, bản đồ đặt nó ở ~30% chiều cao màn hình để không bị sheet che. Bản đồ xoay (bearing 85°) nên dời bản đồ bằng `containerPointToLatLng`, không dùng `panBy` (panBy đi theo trục chưa xoay).
- Panel xuất hiện có hiệu ứng ngắn; tắt khi `prefers-reduced-motion`.
- Marker cửa ra máy bay chỉ hiện số khi tên dạng `Cửa 09` / `Cửa 01-05` (độ rộng theo độ dài số); tên khác (dữ liệu gán nhầm loại, ví dụ "Cửa Hàng Sasco") dùng icon thường.
- Chi tiết: điện thoại là link `tel:`, website mở tab mới; giờ mở cửa tiếng Anh từ dữ liệu crawl được đổi sang tiếng Việt / 24 giờ ("24 Hours" → "Mở cửa 24 giờ", "5AM-9PM" → "05:00 – 21:00").

## 2.6. Hiệu năng bản đồ (zoom)

- Mặt bằng và ảnh khuôn viên vẽ bằng **SVG nhúng** (`utils/inlineSvg.js` + `L.svgOverlay`), không dùng `L.imageOverlay(url)`. Ảnh `<img>` SVG bị vẽ lại toàn bộ sau mỗi lần zoom (khuôn viên ~24000×15000 px ở zoom 19.5) làm bản đồ đơ; SVG nhúng chỉ vẽ phần trong màn hình. `inlineSvg` thêm tiền tố cho class/id vì các file CorelDRAW trùng tên class (`.fil0`…).
- Marker địa điểm được tạo một lần và cache theo id; zoom/xoay chỉ tính lại marker nào đủ chỗ hiện (ẩn/hiện), kéo bản đồ không đụng marker. Không dùng CSS `filter` trên pane bản đồ.
- `zoomDelta: 1` (nút +/−). Con lăn chuột và **chụm touchpad** dùng `utils/smoothWheelZoom.js` (tắt `scrollWheelZoom` của Leaflet): mỗi sự kiện wheel đổi zoom đích và vẽ lại ngay ở khung hình kế tiếp bằng `map._move(..., { pinch: true })`, giữ điểm dưới con trỏ đứng yên (tính cả góc xoay bản đồ), hết cử chỉ thì snap như pinch của leaflet-rotate. Handler mặc định của Leaflet chờ ngừng cuộn mới animate nên zoom bằng touchpad bị trễ, không bám tay.

## 2.7. Trang quản trị `/admin`

- `Root.jsx` chọn trang theo đường dẫn: `/` = bản đồ công khai (không có nút Admin); `/admin` = trang đăng nhập (`LoginDialog asPage`), đăng nhập xong mở `App` với `admin = { session, onSessionChange, onLogout }` → bản đồ + AdminPanel, header có nhãn QUẢN TRỊ, tên người dùng, nút mở trang công khai, nút đăng xuất. Cloudflare (`not_found_handling: single-page-application`) và Vite trả `index.html` cho `/admin`, không cần router.
- `api/auth.js`: `login`, `logout`, `getSession`; token lưu `sessionStorage` (hết khi đóng tab) và trong bộ nhớ nếu trình duyệt chặn storage.
- `request()` trong `locationApi.js` gắn `Authorization: Bearer` cho POST/PUT/DELETE. Bị 401/403 → xóa phiên, phát sự kiện `admin-session-expired`, ném `AuthError`; App hiện hộp đăng nhập đè lên bản đồ, form/lối đi chưa lưu vẫn giữ, đăng nhập lại rồi bấm lưu lần nữa.

## API khi deploy cloud

locationApi.js dùng VITE_API_BASE_URL là origin Render ở production; không đặt biến thì local dùng /api qua Vite proxy, bản build dùng file JSON trong public/data. Bản build không có Admin (`canEdit`). Không đặt credentials database trong frontend. Chi tiết tại [hướng dẫn](../CLOUD_DEPLOYMENT.md).
