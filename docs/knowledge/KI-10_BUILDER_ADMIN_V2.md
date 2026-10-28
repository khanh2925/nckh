# KI-10 · Builder & Admin v2 (web) — React + TypeScript

Đợt 2 của frontend v2: màn hình quản trị địa điểm (Builder, vai trò `VENUE_ADMIN`) và quản trị hệ thống
(Admin, vai trò `SYSTEM_ADMIN`) theo bản thiết kế hướng **"Biển chỉ dẫn"** (bản 31, 2026-10-28), dùng chung bảng màu với Viewer
(`src/design/tokens.css`). Chỉ làm frontend: phần nào backend chưa có API thì hiện "Chưa khả dụng" (`<NotYet>`), không giả số liệu.

## Bộ giao diện màn máy tính

- `console/console.css`: lớp `.k-*` khớp 1:1 bản thiết kế; lớp `.cb-*` cũ vẽ lại theo cùng giá trị (biến cũ `--cobalt`, `--line`… trỏ về token mới).
  Cỡ chữ 12/14/16/20/24/28, độ đậm 400/600, bo góc 4/6/12/999, cao 32/40, một màu viền `--rule`, vàng chỉ cho **một** nút chính mỗi màn.
- `console/Shell.tsx`: **một khung cho mọi màn** — header 64 than chì có vạch vàng (logo, breadcrumb, chip trạng thái xuất bản,
  nút của trang, menu tài khoản) + sidebar 224. Trang đặt nút lên header bằng `<HeaderActions>`, trạng thái lưu bằng
  `<HeaderStatus><SaveState …/></HeaderStatus>`.
  - Ngoài địa điểm: sidebar "Quản lý" (`GlobalSidebar`, trong `BuilderShell.tsx`).
  - Trong địa điểm (`Workspace.tsx`): sidebar "Dựng bản đồ" 6 bước, dấu tick khi bước xong tính từ dữ liệu thật
    (có tầng, mọi tầng có mặt bằng, có điểm, có lối đi, đã xuất bản) + "Công cụ". Màn editor/walkways/journeys dùng rail 64.
  - Admin: sidebar "Quản trị hệ thống", số "N chờ" ở Người dùng.
- Icon giao diện: `src/design/Lc.tsx` (Lucide). `UiIcon`/`Button icon=` nhận tên Lucide; tên `bi-*` (biểu tượng loại lưu trong CSDL) vẫn vẽ bằng Bootstrap Icons.
- CSS bố cục riêng: `builder/pages/workspace.css` (`ws-*`), `builder/pages/global.css` (`kg-*`), `admin/admin.css` (`ka-*`).
- Màu Leaflet đọc biến CSS qua `mapColors()` (`builder/layers.tsx`); hex trong TSX chỉ còn là màu dữ liệu (màu loại, màu vùng).
- Điện thoại (< 900 px) mở `/builder` hoặc `/admin` sau khi đăng nhập: màn "Mở Builder trên máy tính" (`ConsoleRoot.tsx`); đăng nhập/đăng ký vẫn dùng được.

## Cấu trúc

```
Front-End/src/
  console/              nền dùng chung Builder + Admin
    http.ts             fetch + Bearer token (localStorage "indoor-map.token"), lỗi {message} -> ApiError, 401 -> đăng xuất
    api.ts              authApi, venueApi, planApi, catalogApi, locationApi, walkwayApi, adminApi
    auth.tsx            AuthProvider (gọi /me khi mở), useAuth, RequireAuth({role}) -> /login?next=
    ui.tsx              Button, Field, Select, Card, Table, Status, Kpi, NotYet, toast + confirm, ColorPicker, IconPicker
    console.css         bộ giao diện màn máy tính (.k-*, .cb-*, khung .cs-*)
    Shell.tsx           ConsoleFrame, HeaderActions, HeaderStatus, SaveState, sidebar/rail
    ConsoleRoot.tsx     provider, .cb-root, chặn màn hình điện thoại
    routes.tsx          bảng route (lazy)
  builder/
    Workspace.tsx       tải toàn bộ dữ liệu 1 địa điểm, model = buildVenueModel(data), reload/patch, khung + sidebar bước
    EditorMap.tsx       Leaflet + lớp bản vẽ (SVG hoặc ảnh), render-prop nhận map
    layers.tsx          ClickLayer, PlacesLayer (kéo được), ZonesLayer, DraftPolygonLayer, WalkwayPreviewLayer
    AuthPages.tsx       đăng nhập, đăng ký (tài khoản mới ở trạng thái PENDING), quên mật khẩu, bảo trì
    AuthArt.tsx         hình minh hoạ màn đăng nhập (mặt bằng T1 thật + tuyến tới Cửa 12)
    FloorList.tsx       FloorList, FloorChips, FloorSelect, GuestLink, Dialog, RowMenu
    pages/              từng màn hình (bảng dưới)
  admin/AdminPages.tsx  tổng quan, kiểm duyệt, người dùng, danh mục mẫu, cấu hình, nhật ký
packages/core/src/
  checks.ts             analyzeVenue(): nút lẻ, mảnh lối đi rời, điểm không tới được, thang chưa nối, tầng thiếu bản vẽ
  projection.ts         + anchorsFromTwoPoints (2 cặp điểm bất kỳ -> anchor/end/depthScale), describeProjection
```

## Màn hình ↔ route

| Màn hình | Route | Tệp | API |
|---|---|---|---|
| Đăng nhập (`?next=`, `?registered=1`, `?expired=1`) / Đăng ký | `/login`, `/register` | `AuthPages.tsx` | `/api/auth/*` |
| Quên mật khẩu | `/forgot` | `AuthPages.tsx` | **chưa có API** (gửi đi hiện "Chưa khả dụng") |
| Bảo trì / lỗi máy chủ | `/maintenance` | `AuthPages.tsx` | **chưa có API** chế độ bảo trì |
| Địa điểm của tôi | `/builder` | `VenuesPage.tsx` | `/api/my/venues` |
| Tạo địa điểm (2 bước: thông tin, phạm vi) | `/builder/new` | `VenueCreatePage.tsx` | `POST /api/venues` |
| Thống kê | `/builder/stats` | `SimplePages.tsx` | số liệu từ dữ liệu địa điểm; lượt dùng **chưa có API** |
| Tài khoản | `/builder/account` | `SimplePages.tsx` | `/api/auth/me`, đổi mật khẩu |
| Thông báo | `/builder/notifications` | `NotificationsPage.tsx` | **chưa có API** |
| Toà nhà và tầng | `/builder/v/:id/buildings` | `BuildingsPage.tsx` | buildings/floors CRUD |
| Mặt bằng (tải & căn chỉnh) | `/builder/v/:id/plan` | `CalibratePage.tsx` | `PUT .../floors/{id}/plan` |
| Điểm và vùng | `/builder/v/:id/editor` | `EditorPage.tsx` | locations, zones |
| Nhập CSV / GeoJSON | `/builder/v/:id/import` | `ImportPage.tsx` | tạo hàng loạt locations |
| Lối đi, nối tầng | `/builder/v/:id/walkways` | `WalkwaysPage.tsx` | `PUT .../walkways` (thay cả mạng) |
| Thử chỉ đường (một tuyến / hàng loạt) | `/builder/v/:id/test` | `TestPage.tsx` | — (routing của core trên bản nháp) |
| Xuất bản | `/builder/v/:id/publish` | `PublishPage.tsx` | publish / unpublish; lịch sử phát hành **chưa có API** |
| Quy trình | `/builder/v/:id/journeys` | `JourneysPage.tsx` | **chưa có API** |
| Mã QR định vị | `/builder/v/:id/qr` | `QrPage.tsx` | — (tính ở client) |
| In tem mã QR (`?codes=`) | `/builder/v/:id/qr-print` | `QrPrintPage.tsx` | — |
| Loại và tiện ích | `/builder/v/:id/types` | `TypesPage.tsx` | types, facilities, copy mẫu |
| Mốc camera | `/builder/v/:id/landmarks` | `SimplePages.tsx` | **chưa có API** |
| Cài đặt địa điểm (thông tin, phạm vi, xoá) | `/builder/v/:id/settings` | `VenueSettingsPage.tsx` | `PUT/DELETE /api/venues/{id}` |
| Khác biệt bản nháp | `/builder/v/:id/diff` | `DiffPage.tsx` | **chưa có API** (sửa là lưu thẳng, không có bản công khai riêng) |
| Admin · Tổng quan | `/admin` | `AdminPages.tsx` | `/api/admin/*` |
| Admin · Kiểm duyệt | `/admin/review` | | đổi trạng thái, chuyển chủ sở hữu |
| Admin · Người dùng | `/admin/users` | | duyệt / khoá / mở khoá |
| Admin · Danh mục mẫu | `/admin/templates` | | type templates theo loại hình |
| Admin · Cấu hình | `/admin/settings` | | **chưa có API** (hiện cấu hình hiện tại, chỉ đọc) |
| Admin · Nhật ký | `/admin/logs` | | **chưa có API** |
| 404 | mọi đường dẫn khác | `portal/ComingSoon.tsx` | — |

## Ghi chú kỹ thuật

- **Căn chỉnh mặt bằng**: khung trái là ảnh (CRS.Simple, pixel (x,y) ↔ latLng(−y, x)), khung phải là bản đồ thật.
  Chấm A, B ở cả hai bên → `anchorsFromTwoPoints` ra phép đồng dạng (xoay + tỉ lệ), `depthScale` chỉnh co giãn chiều sâu.
  Tệp SVG/PNG/JPG tối đa 8 MB, gửi lên dạng data URL.
  **Tỉ lệ theo số đo thật** (`withMeasuredDistance`): gõ khoảng cách thật A–B (thước, máy laser, app Đo) → giữ A và hướng A→B
  trên bản đồ, kéo B tới đúng khoảng cách đó; bản đồ đường phố chỉ còn quyết định vị trí + hướng. SVG có
  `data-px-per-meter="100"` trên thẻ gốc (mặt bằng xuất từ LiDAR/RoomPlan, CAD có thước) thì tự áp dụng, không cần gõ.
- **Lối đi**: sửa trên bản sao cục bộ (có hoàn tác), lưu là thay toàn bộ mạng; rời trang khi chưa lưu sẽ bị hỏi.
  Nối tầng: chọn nút thang → nối với nút chồng đúng vị trí hoặc gần nhất ở tầng kia.
- **Mã QR** = id nút lối đi, URL `/q/<slug>/<mã>`. Gợi ý = nút thang + giao lộ ≥ 3 nhánh, cách nhau ≥ 30 m.
  Backend chưa có bảng mã QR nên danh sách đã chọn / đã in / đã dán (`printed[]`, thời điểm `times{}`) lưu tạm
  `localStorage["indoor-map.qr.<venueId>"]` (dữ liệu cũ vẫn đọc được). In tem: `qr-print?codes=a,b` hoặc mọi mã đã tạo.
- **Kiểm tra trước khi xuất bản** chạy hoàn toàn ở client (`analyzeVenue` + routing 50 cặp ngẫu nhiên).

- Phiên hết hạn: 401 → `auth.tsx` đặt cờ `expired`, `RequireAuth` chuyển tới `/login?next=…&expired=1`.
- Rời trang khi chưa lưu chỉ chặn bằng `beforeunload` (app dùng `BrowserRouter`, chưa có `useBlocker`).

## Việc còn chờ backend

API thống kê lượt xem/tìm kiếm, nhật ký hệ thống, cấu hình hệ thống, bảng mã QR, mốc camera, lịch sử phiên bản xuất bản,
quy trình (journeys), thông báo, đặt lại mật khẩu, chế độ bảo trì, thành viên địa điểm.

## Kiểm thử

`tsc -b`, `eslint`, `vite build`, 18 test core đều qua. Luồng giao diện đã chạy end-to-end bằng Playwright
trên API giả lập (không commit) — cần chạy lại với backend Spring Boot thật.
