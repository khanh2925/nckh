# KI-10 · Builder & Admin v2 (web) — React + TypeScript

Đợt 2 của frontend v2: màn hình quản trị địa điểm (Builder, vai trò `VENUE_ADMIN`) và quản trị hệ thống
(Admin, vai trò `SYSTEM_ADMIN`) theo bản thiết kế "UX/UI theo actor" (theme Cobalt, class `.cb-*` trong `.cb-root`).
Chỉ làm frontend: phần nào backend chưa có API thì hiện khung "Chưa có API" (`<NotYet>`), không giả số liệu.

## Cấu trúc

```
Front-End/src/
  console/              nền dùng chung Builder + Admin
    http.ts             fetch + Bearer token (localStorage "indoor-map.token"), lỗi {message} -> ApiError, 401 -> đăng xuất
    api.ts              authApi, venueApi, planApi, catalogApi, locationApi, walkwayApi, adminApi
    auth.tsx            AuthProvider (gọi /me khi mở), useAuth, RequireAuth({role}) -> /login?next=
    ui.tsx              Button, Field, Select, Card, Table, Status, Kpi, NotYet, toast + confirm, ColorPicker, IconPicker
    console.css         theme Cobalt (+ trang in thẻ QR A6)
    ConsoleRoot.tsx     font, provider, .cb-root
    routes.tsx          bảng route (lazy)
  builder/
    Workspace.tsx       tải toàn bộ dữ liệu 1 địa điểm, model = buildVenueModel(data), reload/patch, thanh 9 tab
    EditorMap.tsx       Leaflet + lớp bản vẽ (SVG hoặc ảnh), render-prop nhận map
    layers.tsx          ClickLayer, PlacesLayer (kéo được), ZonesLayer, DraftPolygonLayer, WalkwayPreviewLayer
    AuthPages.tsx       đăng nhập, đăng ký (tài khoản mới ở trạng thái PENDING)
    pages/              từng màn hình (bảng dưới)
  admin/AdminPages.tsx  tổng quan, kiểm duyệt, người dùng, danh mục mẫu, cấu hình, nhật ký
packages/core/src/
  checks.ts             analyzeVenue(): nút lẻ, mảnh lối đi rời, điểm không tới được, thang chưa nối, tầng thiếu bản vẽ
  projection.ts         + anchorsFromTwoPoints (2 cặp điểm bất kỳ -> anchor/end/depthScale), describeProjection
```

## Màn hình ↔ route

| Màn hình | Route | Tệp | API |
|---|---|---|---|
| Đăng nhập / Đăng ký | `/login`, `/register` | `AuthPages.tsx` | `/api/auth/*` |
| Địa điểm của tôi | `/builder` | `VenuesPage.tsx` | `/api/my/venues` |
| Tạo địa điểm (khoanh vùng) | `/builder/new` | `VenueCreatePage.tsx` | `POST /api/my/venues` |
| Toà nhà & tầng, thông tin | `/builder/v/:id/buildings` | `BuildingsPage.tsx` | buildings/floors CRUD |
| Tải & căn chỉnh mặt bằng | `/builder/v/:id/plan` | `CalibratePage.tsx` | `PUT .../floors/{id}/plan` |
| Điểm & vùng | `/builder/v/:id/editor` | `EditorPage.tsx` | locations, zones |
| Nhập CSV / GeoJSON | `/builder/v/:id/import` | `ImportPage.tsx` | tạo hàng loạt locations |
| Lối đi, nối tầng | `/builder/v/:id/walkways` | `WalkwaysPage.tsx` | `PUT .../walkways` (thay cả mạng) |
| Loại & tiện ích | `/builder/v/:id/types` | `TypesPage.tsx` | types, facilities, copy mẫu |
| Mã QR định vị | `/builder/v/:id/qr` | `QrPage.tsx` | — (tính ở client) |
| Mốc camera | `/builder/v/:id/landmarks` | `SimplePages.tsx` | **chưa có API** |
| Thử chỉ đường | `/builder/v/:id/test` | `TestPage.tsx` | — (chạy routing của core trên bản nháp) |
| Xuất bản | `/builder/v/:id/publish` | `PublishPage.tsx` | publish / unpublish |
| Thống kê | `/builder/stats` | `SimplePages.tsx` | **chưa có API** (chỉ hiện tóm tắt dữ liệu) |
| Tài khoản | `/builder/account` | `SimplePages.tsx` | `/api/auth/me`, đổi mật khẩu |
| Admin · Tổng quan | `/admin` | `AdminPages.tsx` | `/api/admin/*` |
| Admin · Kiểm duyệt | `/admin/review` | | đổi trạng thái, chuyển chủ sở hữu |
| Admin · Người dùng | `/admin/users` | | duyệt / khoá / mở khoá |
| Admin · Danh mục mẫu | `/admin/templates` | | type templates theo loại hình |
| Admin · Cấu hình | `/admin/settings` | | **chưa có API** (hiện bảng cấu hình hiện tại) |
| Admin · Nhật ký | `/admin/logs` | | **chưa có API** |

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
  Backend chưa có bảng mã QR nên danh sách đã chọn / đã dán lưu tạm `localStorage["indoor-map.qr.<venueId>"]`.
- **Kiểm tra trước khi xuất bản** chạy hoàn toàn ở client (`analyzeVenue` + routing 50 cặp ngẫu nhiên).

## Việc còn chờ backend

API thống kê lượt xem/tìm kiếm, nhật ký hệ thống, cấu hình hệ thống, bảng mã QR, mốc camera, lịch sử phiên bản xuất bản.

## Kiểm thử

`tsc -b`, `eslint`, `vite build`, 18 test core đều qua. Luồng giao diện đã chạy end-to-end bằng Playwright
trên API giả lập (không commit) — cần chạy lại với backend Spring Boot thật.
