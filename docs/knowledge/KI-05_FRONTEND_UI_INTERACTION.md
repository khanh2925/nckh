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

## 2.7. Ứng dụng quản trị `/admin` (`src/admin/`)

Trang công khai (`App.jsx`) chỉ có bản đồ, tìm kiếm, chỉ đường; không còn chế độ Admin. `Root.jsx` chuyển mọi đường dẫn `/admin…` sang `AdminApp` sau khi đăng nhập (`LoginDialog asPage`). Không dùng thư viện router: `history.pushState` + `popstate`; Cloudflare/Vite trả `index.html` cho mọi đường dẫn.

| Đường dẫn | Trang | Nội dung |
|---|---|---|
| `/admin` | `OverviewPage` | Bảng theo nhà ga/tầng (số địa điểm, điểm lối đi, % chỉ đường tới được, mảnh rời), "Việc cần làm", số địa điểm theo nhóm |
| `/admin/locations` | `LocationsPage` + `LocationEditor` (+ `LocationsTable`) | **Bản đồ là trung tâm**: trái = danh sách địa điểm của tầng đang xem (tìm kiếm thì tìm mọi nhà ga, lọc nhóm), giữa = bản đồ (chọn ga/tầng ở góc; bấm marker để sửa), phải = ngăn sửa khi đang sửa. "Thêm địa điểm"/"Dời vị trí" → chế độ đặt (con trỏ ngắm, thông báo dưới bản đồ, Esc hủy) → bấm mặt bằng; ga/tầng lấy theo chỗ đặt, không chọn tay. Chế độ "Bảng": tìm/lọc/sắp xếp mọi địa điểm, bấm dòng → mở trên bản đồ. Xóa bấm 2 lần. URL `?edit=<id>`, `?view=table`, `?terminal=T2&floor=0` |
| `/admin/walkways` | `WalkwaysPage` | Trình vẽ lối đi toàn màn hình (`useWalkwayEditor` với `initialNetwork`) + `WalkwayPanel` và kiểm tra lối đi. `?terminal=T2`. Rời trang khi chưa lưu → hỏi lại (cả khi đóng tab) |
| `/admin/quality` | `QualityPage` | Lối đi: % tới được, mảnh rời, thang chưa nối. Dữ liệu (`admin/dataChecks.js`): loại cửa ra máy bay nhưng tên không phải số cửa, tên "vệ sinh" sai loại, "Của" gõ nhầm "Cửa", chưa phân loại, thiếu lat/lng, nghi trùng (cùng tên, cùng tầng, < 3 m), cách lối đi > 20 m. Mỗi dòng có "Sửa"/"Vẽ lối đi" |

Giao diện: `admin/admin.css`, font Be Vietnam Pro (Google Fonts trong `index.html`). Sidebar màu than chì, trang hiện tại đánh dấu bằng ô vàng `#F2B705` (kiểu biển chỉ dẫn sân bay); màu đỏ thương hiệu chỉ cho logo và xóa. Dưới 992px sidebar thành thanh biểu tượng phía trên; trang Địa điểm xếp bản đồ trên, danh sách dưới, ngăn sửa phủ toàn màn hình. `MapView` theo dõi kích thước khung (ResizeObserver → `invalidateSize`) vì panel bên cạnh mở/đóng làm đổi kích thước bản đồ.

Đăng nhập: `api/auth.js` (`login`, `logout`, `getSession`, token trong `sessionStorage` + bộ nhớ). `request()` trong `locationApi.js` gắn `Authorization: Bearer` cho POST/PUT/DELETE; bị 401/403 → xóa phiên, sự kiện `admin-session-expired` → `AdminApp` hiện hộp đăng nhập, dữ liệu đang sửa vẫn giữ.

## API khi deploy cloud

locationApi.js dùng VITE_API_BASE_URL là origin Render ở production; không đặt biến thì local dùng /api qua Vite proxy, bản build dùng file JSON trong public/data. Bản build không có Admin (`canEdit`). Không đặt credentials database trong frontend. Chi tiết tại [hướng dẫn](../CLOUD_DEPLOYMENT.md).
