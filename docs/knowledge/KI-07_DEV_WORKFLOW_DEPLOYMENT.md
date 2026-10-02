# KI-07: Quy trình phát triển

Java 17+, PostgreSQL 16+, Node 20.19+ hoặc 22.12+. Không yêu cầu Docker.

[Hướng dẫn khởi tạo schema, nạp SQL, cấu hình kết nối và chạy](../../Back-End/database/README.md).

Frontend 5174 proxy `/api` về backend 8080. Có thể đổi backend bằng server.port và AIRPORT_MAP_API_URL ở Vite.

DB_INTEGRATION_TEST=true ./mvnw test chạy kiểm thử PostgreSQL trên database có seed; CRUD rollback. Database chưa có schema phải khởi tạo bằng SQL trước. Không tự import file hoặc fallback khi mất kết nối.

Mở rộng tầng/nhà ga cần đồng bộ cấu hình frontend và danh mục database. Mở rộng đồ thị vẫn theo KI-03; tọa độ theo KI-02. Sao lưu PostgreSQL trước thay đổi schema đang dùng; script 01_schema chỉ dành database trống.

## Deploy Cloudflare Workers + Render + Neon

Frontend dùng VITE_API_BASE_URL trỏ Render; local giữ proxy /api. Backend Docker dùng PORT và CORS_ALLOWED_ORIGINS là danh sách origin phân cách dấu phẩy, kết nối Neon qua DB_URL/DB_USERNAME/DB_PASSWORD. Blueprint render.yaml chọn main và Free; Cloudflare chọn main trong dashboard. Xem [hướng dẫn](../CLOUD_DEPLOYMENT.md). Chưa deploy cloud.
