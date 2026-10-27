# AGENT GUIDELINES & LONG-TERM MEMORY (AGENTS.md)

Chào mừng tất cả AI Agents (Antigravity, Devin, Claude, Cursor, GitHub Copilot, v.v.) tham gia phát triển repository **Airport Indoor Map (NCKH)**.

Tài liệu này là **chỉ dẫn bắt buộc** nhằm định hướng hành vi, duy trì ngữ cảnh hệ thống và đảm bảo tính nhất quán của toàn bộ codebase.

---

## 1. Nguyên Tắc Cốt Lõi Cho AI Agents

1. **Đọc KIs Trước Khi Code**: Trước khi thực hiện bất kỳ thay đổi nào liên quan đến kiến trúc, thuật toán định vị, chỉ đường hoặc cơ chế dữ liệu, Agent **BẮT BUỘC** phải tra cứu Knowledge Items tương ứng trong `docs/knowledge/`.
2. **Bảo Vệ Tính Toàn Vẹn Tọa Độ (Dual Coordinates)**:
   - Hệ thống vận hành trên 2 không gian tọa độ: **Tọa độ Pixel trên bản vẽ SVG** (`x, y`) và **Tọa độ Địa lý Thực tế** (`lat, lng`).
   - Tuyệt đối không nhầm lẫn giữa pixel trên bản vẽ và lat/lng khi tính toán khoảng cách hoặc lưu trữ dữ liệu. Tra cứu [KI-02](docs/knowledge/KI-02_COORDINATE_PROJECTION_SYSTEM.md).
3. **Bảo Vệ Dữ Liệu Địa Điểm Gốc**:
   - Dữ liệu 705 địa điểm Tân Sơn Nhất (T1, T2, T3) nằm tại `Back-End/data/airport-locations.json` và `crawled_data/`.
   - Cơ chế ghi file JSON là Atomic Write (`synchronized`), không được bypass lớp DAO hoặc làm hỏng cấu trúc ID.
4. **Cập Nhật KIs Khi Thay Đổi Thiết Kế**: Khi thêm tính năng mới, thay đổi API, cấu trúc dữ liệu hoặc mô hình thuật toán, Agent phải cập nhật KI tương ứng theo giao thức tại [docs/knowledge/README.md](docs/knowledge/README.md).

---

## 2. Mục Lục Tra Cứu Bộ Nhớ Hệ Thống (Knowledge Items)

Mọi tri thức kỹ thuật chi tiết của dự án được module hóa tại thư mục `docs/knowledge/`:

| Mã KI | Chủ Đề Tri Thức | Mô Tả & Phạm Vi Tra Cứu |
| :--- | :--- | :--- |
| [**KI-01**](docs/knowledge/KI-01_SYSTEM_ARCHITECTURE.md) | **Tổng Quan Kiến Trúc Hệ Thống** | Mô hình tách rời React + Spring Boot, luồng dữ liệu tổng thể và cấu trúc source code. |
| [**KI-02**](docs/knowledge/KI-02_COORDINATE_PROJECTION_SYSTEM.md) | **Hệ Tọa Độ & Phép Chiếu Bản Đồ** | Nguyên lý Dual-Coordinate (Pixel SVG ↔ Lat/Lng WGS84), ma trận Affine Transform & Leaflet Projection. |
| [**KI-03**](docs/knowledge/KI-03_INDOOR_ROUTING_NAVIGATION.md) | **Thuật Toán Chỉ Đường & Đồ Thị Lối Đi** | Đồ thị Walkways (nodes/edges), thuật toán Dijkstra, phân chia chặng (Legs) và chuyển tầng (thang máy/cuốn). |
| [**KI-04**](docs/knowledge/KI-04_DATA_PERSISTENCE_BACKEND_API.md) | **Backend REST API & Lưu Trữ Dữ Liệu** | Spring Boot REST API, cơ chế `LocationJsonDao` (In-memory cache + Atomic File Sync) và lộ trình nâng cấp DB. |
| [**KI-05**](docs/knowledge/KI-05_FRONTEND_UI_INTERACTION.md) | **Kiến Trúc Frontend & Tương Tác Bản Đồ** | Quản lý state tập trung (`App.jsx`), tích hợp `leaflet-rotate`, tìm kiếm tiếng Việt không dấu, Admin CRUD. |
| [**KI-06**](docs/knowledge/KI-06_DATA_INGESTION_CRAWLING.md) | **Pipeline Thu Thập Dữ Liệu & Seed Data** | Script cào dữ liệu `crawl_airport_map.py`, cấu trúc `crawled_data/` và cơ chế nạp tự động `AirportSeed`. |
| [**KI-07**](docs/knowledge/KI-07_DEV_WORKFLOW_DEPLOYMENT.md) | **Quy Trình Phát Triển & Mở Rộng** | Hướng dẫn chạy dev, xử lý xung đột port (8080/5173), test mobile qua Wi-Fi và quy tắc mở rộng tầng/nhà ga. |

---

## 3. Bản Đồ Công Nghệ Nhanh (Tech Stack Quickview)

- **Backend**: Java 17+, Spring Boot 3.x, Maven Wrapper (`./mvnw`), Lombok, Jackson.
- **Frontend**: React 18+, Vite, Leaflet, Leaflet-Rotate, React-Leaflet, Bootstrap 5.
- **Data & Maps**: GeoJSON, SVG Floorplans, Dijkstra Graph Pathfinding, JSON File Storage.
