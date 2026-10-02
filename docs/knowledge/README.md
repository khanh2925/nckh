# Hệ Thống Tri Thức Dự Án (Knowledge Items - KIs)

Thư mục `docs/knowledge/` đóng vai trò là **Bộ nhớ dài hạn (Long-term Memory & System Knowledge Base)** cho toàn bộ dự án **Bản đồ trong nhà sân bay Tân Sơn Nhất (Airport Indoor Map)**.

Hệ thống được chuẩn hóa để cả thành viên nhóm phát triển và các AI Agent đều có thể nhanh chóng tra cứu, nắm bắt kiến trúc và tiếp tục phát triển codebase mà không làm gãy vỡ hệ thống.

---

## 1. Danh Mục Toàn Bộ Knowledge Items (KIs)

```
docs/knowledge/
├── README.md                                  # Index trung tâm & Giao thức duy trì bộ nhớ
├── KI-01_SYSTEM_ARCHITECTURE.md               # Kiến trúc tổng thể & Luồng dữ liệu
├── KI-02_COORDINATE_PROJECTION_SYSTEM.md       # Hệ tọa độ kép (Pixel ↔ Lat/Lng) & Phép chiếu
├── KI-03_INDOOR_ROUTING_NAVIGATION.md         # Thuật toán tìm đường Dijkstra & Đồ thị Walkways
├── KI-04_DATA_PERSISTENCE_BACKEND_API.md      # Backend REST API & PostgreSQL/Flyway và JSON Atomic dự phòng
├── KI-05_FRONTEND_UI_INTERACTION.md           # Giao diện React, MapView, Tìm kiếm & Admin Panel
├── KI-06_DATA_INGESTION_CRAWLING.md           # Pipeline thu thập dữ liệu & Nạp Seed Locations
└── KI-07_DEV_WORKFLOW_DEPLOYMENT.md           # Môi trường chạy, gỡ lỗi & Quy chuẩn mở rộng
```

---

## 2. Giao Thức Duy Trì Bộ Nhớ (Memory Retention Protocol)

Để duy trì tính chuẩn xác tuyệt đối của tài liệu khi codebase thay đổi, mọi Developer và AI Agent phải tuân thủ các quy tắc sau:

### Quy Tắc 1: Single Source of Truth
- Mọi quyết định kỹ thuật quan trọng (sửa đổi thuật toán, thêm trường dữ liệu `Location`, đổi cơ chế lưu trữ sang PostgreSQL/JPA) **phải được cập nhật ngay vào KI tương ứng**.

### Quy Tắc 2: Nguyên Tắc Bất Biến Về Tọa Độ
- **Tọa độ bản vẽ (`x, y`)** được căn chuẩn theo khung gốc `1598 x 682` pixel.
- **Tọa độ địa lý (`lat, lng`)** được dùng để gắn bản vẽ lên bản đồ thế giới Leaflet qua ma trận phép chiếu.
- Bất kỳ thay đổi nào với phép chiếu phải đồng bộ tại cả `mapProjection.js`, `projection.js` và `KI-02`.

### Quy Tắc 3: Kiểm Tra Tính Tương Thích Ngược
- Khi thêm loại địa điểm mới (`locationTypes.js`), thêm tầng (`floors.js`) hoặc sửa đồ thị lối đi (`walkways.js`), cần đối chiếu với `KI-03` và `KI-05` để đảm bảo thuật toán Dijkstra không sinh ra chu trình cô lập (isolated component) hoặc lỗi render.

---

## 3. Liên Kết Nhanh Đến Các KIs

- [KI-01: Tổng quan Kiến trúc Hệ thống](KI-01_SYSTEM_ARCHITECTURE.md)
- [KI-02: Hệ Tọa độ & Phép chiếu Bản đồ](KI-02_COORDINATE_PROJECTION_SYSTEM.md)
- [KI-03: Thuật toán Chỉ đường & Đồ thị Lối đi](KI-03_INDOOR_ROUTING_NAVIGATION.md)
- [KI-04: Backend REST API & Lưu trữ Dữ liệu](KI-04_DATA_PERSISTENCE_BACKEND_API.md)
- [KI-05: Giao diện Người dùng & Tương tác React](KI-05_FRONTEND_UI_INTERACTION.md)
- [KI-06: Thu thập Dữ liệu & Xử lý Dữ liệu Mẫu](KI-06_DATA_INGESTION_CRAWLING.md)
- [KI-07: Hướng dẫn Phát triển & Triển khai](KI-07_DEV_WORKFLOW_DEPLOYMENT.md)
