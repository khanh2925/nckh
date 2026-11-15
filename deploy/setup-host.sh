#!/usr/bin/env bash
# Chạy MỘT LẦN trên máy Ubuntu 24.04 mới của Oracle (A1): mở cổng 80/443, cài Docker và Caddy.
#   bash deploy/setup-host.sh
# Xong thì thoát SSH (exit) rồi SSH lại để dùng lệnh docker không cần sudo.
set -euo pipefail

echo "== 1/3 Mở cổng 80, 443 trong firewall của máy =="
# Image Ubuntu của Oracle chặn mọi cổng trừ 22 bằng iptables, kể cả khi security list của VCN đã mở.
# Làm trước khi cài Docker để không lưu luôn các rule Docker tự tạo.
sudo apt-get update
command -v netfilter-persistent >/dev/null || sudo DEBIAN_FRONTEND=noninteractive apt-get install -y iptables-persistent
if ! sudo iptables -C INPUT -p tcp -m multiport --dports 80,443 -m conntrack --ctstate NEW -j ACCEPT 2>/dev/null; then
    sudo iptables -I INPUT -p tcp -m multiport --dports 80,443 -m conntrack --ctstate NEW -j ACCEPT
fi
sudo netfilter-persistent save

echo "== 2/3 Cài Docker =="
if ! command -v docker >/dev/null; then
    curl -fsSL https://get.docker.com | sudo sh
fi
sudo usermod -aG docker "$USER"

echo "== 3/3 Cài Caddy (tự xin và gia hạn HTTPS cho mọi trang trên máy) =="
if ! command -v caddy >/dev/null; then
    sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl gnupg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
    sudo apt-get update
    sudo apt-get install -y caddy
fi

echo
echo "Xong. Gõ exit rồi SSH lại, sau đó chạy: bash deploy/deploy.sh"
