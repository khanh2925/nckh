# KI-01: Kiến trúc hệ thống

Frontend React/Leaflet hiển thị SVG, marker và định tuyến Dijkstra. HTTP API nối frontend với Spring Boot.

Backend phân tầng: `controller/LocationController` → `service/LocationService` / `impl/LocationServiceImpl` → `dao/LocationDao` / `impl/LocationPostgresDao` → JDBC/PostgreSQL. `model/Location` là DTO API với Lombok. Không có lưu trữ file JSON hay fallback.

Sáu bảng nghiệp vụ và khóa ngoại được định nghĩa trực tiếp trong `Back-End/database/01_schema.sql`. `02_seed.sql` nạp dữ liệu SQL riêng. Không tự thay đổi schema/nạp data trong startup. [ERD](DATABASE_SCHEMA.md), [cấu hình và chạy](../../Back-End/database/README.md).

Frontend vẫn quản lý mặt bằng và đồ thị tại src/data và phép chiếu tại src/utils. Giữ x/y pixel riêng với lat/lng WGS84; schema không thay đổi thuật toán định tuyến.
