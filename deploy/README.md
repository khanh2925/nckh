# Deploy AeroProce lên máy Oracle A1 (Always Free)

Một máy `VM.Standard.A1.Flex` 2 OCPU / 12 GB (Ubuntu 24.04, ARM) chạy cùng lúc AeroProce và các trang khác.
Caddy cài trên máy làm cổng vào duy nhất (80/443) và tự xin HTTPS cho từng tên miền.

```
Internet ─► Caddy của máy (HTTPS, /etc/caddy/Caddyfile)
              ├─ aeroproce.<IP>.sslip.io ─► 127.0.0.1:8090  web (Caddy: trang React + /api) ─► api (Spring Boot) ─► db (PostgreSQL 16)
              └─ các trang khác          ─► cổng riêng của từng trang
```

Database chạy trong Docker trên chính máy này, nạp sẵn `Back-End/database/v2/demo_data.sql` ở lần chạy đầu.
Không dùng Neon, nên web cũ (Cloudflare Workers + Render + Neon) vẫn chạy bình thường.

## Lần đầu

```bash
ssh ubuntu@<IP máy mới>
git clone -b feat/pdr-pf https://github.com/khanh2925/nckh.git aeroproce
cd aeroproce
bash deploy/setup-host.sh     # mở cổng 80/443, cài Docker + Caddy
exit                          # SSH lại để dùng được lệnh docker
ssh ubuntu@<IP máy mới>
cd aeroproce && bash deploy/deploy.sh
```

`deploy.sh` tự tạo `deploy/.env` (mật khẩu ngẫu nhiên), build và chạy 3 container, thêm tên miền vào Caddy,
rồi in ra địa chỉ web và tài khoản `/admin`. Lần đầu build mất khoảng 5–10 phút.

Repo private thì `git clone` sẽ hỏi đăng nhập: dùng tên GitHub và một Personal Access Token (quyền đọc repo) thay cho mật khẩu.

## Cập nhật khi có code mới

```bash
cd ~/aeroproce && git pull && bash deploy/deploy.sh
```

## Lệnh hay dùng (trong thư mục `deploy`)

| Việc | Lệnh |
|---|---|
| Xem trạng thái | `docker compose ps` |
| Xem log backend | `docker compose logs -f api` |
| Sao lưu database | `docker compose exec -T db pg_dump -U indoor_map indoor_map > ~/backup-$(date +%F).sql` |
| Khởi động lại | `docker compose restart` |
| Nạp lại dữ liệu demo (XOÁ hết dữ liệu hiện tại) | `docker compose down -v && bash deploy.sh` |

## Thêm trang khác trên cùng máy

Mỗi trang chạy ở một cổng `127.0.0.1:<cổng>` riêng, rồi thêm một khối vào `/etc/caddy/Caddyfile`:

```
api.ten-mien.com {
	reverse_proxy 127.0.0.1:8080
}
```

Sau đó `sudo systemctl reload caddy`. Tên miền phải trỏ (bản ghi A) về IP máy này.

## Lưu ý

- RAM: db 512 MB, api 1 GB, web 256 MB (giới hạn trong `docker-compose.yml`).
- Không mở cổng 5432 hay 8090 ra internet; chỉ Caddy nhận kết nối từ ngoài.
- Oracle có thể thu hồi máy Always Free nếu 7 ngày liền CPU, mạng và RAM đều dưới 20%: nên sao lưu database định kỳ.
