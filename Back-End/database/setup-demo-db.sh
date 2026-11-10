#!/usr/bin/env bash
# Dựng database có sẵn dữ liệu demo (Sân bay Tân Sơn Nhất + khuôn viên IUH, 2 quy trình mẫu) trong một lệnh.
#   cd Back-End && ./database/setup-demo-db.sh            # tạo database indoor_map_v2
#   ./database/setup-demo-db.sh ten_khac                  # hoặc tên khác
# Cần PostgreSQL (createdb, psql) trên máy. Database trùng tên đã có dữ liệu thì dừng, không ghi đè.
set -euo pipefail
DB="${1:-indoor_map_v2}"
DIR="$(cd "$(dirname "$0")" && pwd)"

if psql -lqt | cut -d '|' -f1 | grep -qw "$DB"; then
    if [ "$(psql -d "$DB" -Atc "select count(*) from information_schema.tables where table_schema='public'")" != "0" ]; then
        echo "Database '$DB' đã có bảng. Xoá nó trước (dropdb $DB) hoặc đặt tên khác: $0 ten_khac" >&2
        exit 1
    fi
else
    createdb "$DB"
fi
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$DIR/v2/demo_data.sql" > /dev/null
psql -d "$DB" -Atc "select 'Đã dựng ' || current_database() || ': ' || (select count(*) from venues) || ' địa điểm, ' || (select count(*) from locations) || ' điểm, ' || (select count(*) from journeys) || ' quy trình'"
echo "Tiếp theo: Back-End/.env đặt DB_URL=jdbc:postgresql://localhost:5432/$DB cùng ADMIN_EMAIL, ADMIN_PASSWORD (tài khoản quản trị tạo ở lần chạy đầu)."
