# KI-06: Dữ liệu nguồn và SQL seed

`Back-End/database/02_seed.sql` là snapshot dữ liệu khởi tạo PostgreSQL: 705 địa điểm, 4 nhà ga/khu vực, 11 tầng, 18 loại, 9 tiện ích và 167 liên kết. Script xuất từ PostgreSQL đã chuẩn hóa; không phụ thuộc JSON lúc chạy.

Chạy `01_schema.sql` trước rồi `02_seed.sql` trên database mới. Dữ liệu crawled_data và crawl_airport_map.py chỉ là nguồn nghiên cứu/lưu trữ thô, không nằm trong luồng persistence của ứng dụng. Không còn AirportSeed hoặc DatabaseLocationImporter. Các file JSON persistence cũ trong Back-End đã được loại bỏ sau khi xác minh bản SQL bảo toàn dữ liệu.

Muốn cập nhật snapshot: xuất các bảng nghiệp vụ bằng pg_dump --data-only --column-inserts cùng sequences; kiểm tra nạp trên database riêng và so sánh toàn bộ trường, ID, tọa độ. Không chạy seed đè lên database có dữ liệu. Sao lưu database người dùng bằng pg_dump trước mọi thay đổi.
