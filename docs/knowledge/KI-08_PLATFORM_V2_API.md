# KI-08: Nền tảng v2 – mô hình nhiều địa điểm và REST API

Nhánh `platform-v2` dựng lại backend theo hướng nền tảng: một hệ thống phục vụ nhiều địa điểm (venue),
mỗi địa điểm do một chủ địa điểm (VENUE_ADMIN) tự dựng; sân bay Tân Sơn Nhất là venue đầu tiên (chuyển từ dữ liệu v1).
Package Java: `vn.edu.indoormap` (Controller → Service → Repository → PostgreSQL, Spring Data JPA).

## Vai trò

| Vai trò | Đăng nhập | Quyền |
|---|---|---|
| Khách tham quan | không | `GET /api/venues`, `GET /api/venues/{slug}`, `GET /api/venues/{slug}/map` (địa điểm PUBLISHED) |
| VENUE_ADMIN | email + mật khẩu, tài khoản phải được duyệt (ACTIVE) | mọi thao tác dưới `/api/venues/{id}/...` trên địa điểm mình sở hữu |
| SYSTEM_ADMIN | như trên | `/api/admin/**` và mọi địa điểm |

Token JWT (HS256, claim `roles`, `uid`) gửi trong `Authorization: Bearer <token>`. Lỗi trả về `{ "status": 403, "message": "..." }`.

## API

Xác thực `/api/auth`: `POST /login {email,password}` → `{token,user,expiresAt}`; `POST /register {email,password,fullName}` (trạng thái PENDING);
`GET /me`; `PUT /me {fullName}`; `PUT /me/password {currentPassword,newPassword}`.

Địa điểm: `GET /api/my/venues`; `POST /api/venues` (tự sao chép loại địa điểm mẫu theo `kind`); `PUT/DELETE /api/venues/{id}`;
`POST /api/venues/{id}/publish|unpublish`. Công khai: `GET /api/venues/{slug}/map` trả về
`{ venue, buildings, floors, zones, types, facilities, locations, walkways, journeys }` (`journeys` = quy trình đã công khai).

Dưới `/api/venues/{id}`: `buildings`, `floors`, `floors/{fid}/plan` (PUT: svg|imageUrl, width, height, anchor{image,latlng}, end, depthScale),
`zones`, `types` (+ `POST types/from-templates`), `facilities`, `locations` (+ `POST locations/import`), `walkways` (GET/PUT cả mạng),
`journeys` (quy trình: chủ địa điểm thấy cả nháp, người khác chỉ thấy bản công khai).
Tất cả CRUD chuẩn: GET danh sách, POST tạo, PUT /{id} sửa, DELETE /{id}.

Quản trị hệ thống `/api/admin`: `users?status=` + `PUT users/{id}/status {status}`; `venues` + `PUT venues/{id}/status {status}` + `PUT venues/{id}/owner {ownerId}`;
`type-templates` CRUD.

## Dữ liệu

- `locations.x, y` = pixel trên bản vẽ của tầng; `lat, lng` = WGS84. Mỗi tầng có tham số chiếu riêng (`floors.anchor_*`, `end_*`, `depth_scale`), thay cho anchor cứng trong `mapProjection.js`.
- `walkway_nodes.id` là chữ, do Builder đặt; nên có tiền tố venue để không trùng giữa các địa điểm.
- Loại địa điểm (`location_types`) và tiện ích (`facilities`) là dữ liệu theo venue; `type_templates` là danh mục mẫu.
- `journeys`: quy trình nhiều bước (docs/DAC_TA_QUY_TRINH.md). Câu hỏi đầu và các bước lưu JSONB trong dòng (`questions`, `steps`), mỗi bước trỏ tới một điểm (`targetLocationId`) hoặc một mã loại (`targetType`). Bản nháp lưu được khi còn dở; công khai phải có 2–15 bước và mọi bước có đích (BR-30). Xoá điểm/loại đang là đích của quy trình công khai → 409 (BR-36).
- Schema và migration: `Back-End/database/v2/` (`05_journeys.sql` cho bảng quy trình).

## Việc còn lại (frontend)

Frontend hiện vẫn gọi `/api/locations`, `/api/walkways` của v1. Bước tiếp theo: Viewer đọc `GET /api/venues/{slug}/map`,
Builder dùng các API theo venue; `terminals.js`, `floors.js`, `locationTypes.js` chuyển thành dữ liệu từ API.
