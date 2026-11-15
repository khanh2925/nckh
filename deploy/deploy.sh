#!/usr/bin/env bash
# Deploy hoặc cập nhật AeroProce trên máy A1 (sau khi đã chạy setup-host.sh).
#   Lần đầu:      bash deploy/deploy.sh
#   Có code mới:  git pull && bash deploy/deploy.sh
set -euo pipefail
cd "$(dirname "$0")"

# 1. deploy/.env: lần đầu tự tạo với mật khẩu ngẫu nhiên, những lần sau giữ nguyên
if [ ! -f .env ]; then
    ip=$(curl -fsS https://api.ipify.org)
    admin_password=$(openssl rand -base64 18 | tr -d '/+=')
    cat > .env <<EOF
DOMAIN=aeroproce.${ip//./-}.sslip.io
DB_PASSWORD=$(openssl rand -hex 16)
ADMIN_EMAIL=admin@aeroproce.local
ADMIN_PASSWORD=${admin_password}
JWT_SECRET=$(openssl rand -hex 32)
EOF
    chmod 600 .env
    echo "Đã tạo deploy/.env. Tài khoản /admin: admin@aeroproce.local / ${admin_password}"
    echo "(Lưu mật khẩu này lại. Xem lại bằng: grep ADMIN deploy/.env)"
fi
set -a
. ./.env
set +a

# 2. Build và chạy database, backend, web (lần đầu mất vài phút)
docker compose up -d --build

# 3. Caddy của máy: thêm tên miền AeroProce nếu chưa có, Caddy tự xin HTTPS
caddyfile=/etc/caddy/Caddyfile
if ! grep -qF "$DOMAIN" "$caddyfile"; then
    # Lần đầu: bỏ trang mặc định của gói Caddy (khối ":80"), giữ bản sao lưu
    if grep -q '^:80' "$caddyfile"; then
        sudo cp "$caddyfile" "$caddyfile.bak"
        sudo truncate -s 0 "$caddyfile"
    fi
    printf '\n# AeroProce (deploy/docker-compose.yml)\n%s {\n\treverse_proxy 127.0.0.1:8090\n}\n' "$DOMAIN" | sudo tee -a "$caddyfile" >/dev/null
    sudo caddy fmt --overwrite "$caddyfile"
    sudo systemctl reload caddy
fi

# 4. Chờ backend sẵn sàng
for _ in $(seq 1 60); do
    if curl -fsS -o /dev/null http://127.0.0.1:8090/api/venues; then
        echo "AeroProce đang chạy: https://$DOMAIN"
        exit 0
    fi
    sleep 5
done
echo "Sau 5 phút backend vẫn chưa lên. Xem log: docker compose -f deploy/docker-compose.yml logs api" >&2
exit 1
