# KI-09 · Viewer v2 (khách tham quan) — React + TypeScript

Đợt 1 của frontend v2: 13 màn hình của khách tham quan theo bản thiết kế "UX/UI theo actor" (theme Wayfind),
nối API v2. Builder và Admin: xem [KI-10](KI-10_BUILDER_ADMIN_V2.md).

## Cấu trúc

```
packages/core/          @indoor-map/core — TypeScript thuần, dùng chung web + React Native sau này
  src/types.ts          kiểu dữ liệu API v2
  src/api.ts            client: API trước, lỗi thì đọc bản chụp tĩnh /data/*.json
  src/venueModel.ts     lập chỉ mục gói /api/venues/{slug}/map, tìm kiếm không dấu
  src/projection.ts     bản vẽ (pixel) <-> lat/lng bằng 2 điểm mốc
  src/routing.ts        Dijkstra nhiều tầng, tránh thang cuốn/thang bộ
  src/directions.ts     chỉ dẫn từng bước theo mốc
  src/trip.ts           trạng thái chuyến đi (hàm thuần)
  src/pdr.ts            đếm bước, làm mượt la bàn, độ lệch vị trí
  src/qr.ts             mã QR định vị
  test/core.test.ts     15 test trên dữ liệu thật Tân Sơn Nhất
Front-End/
  src/main.tsx          bảng route
  src/lib/              phần chỉ có trên web: Leaflet, SVG mặt bằng, cảm biến trình duyệt, camera + jsQR, cài đặt
  src/viewer/           VenueContext, useTripEngine, components (FloorMap, ui, Icon), pages/
  src/styles/wayfind.css
  src/portal/           trang 404 (theme Cobalt)
  scripts/build-demo-venue.py   sinh dữ liệu mẫu v2 + 04_plans_tan_son_nhat.sql từ dữ liệu v1 + bản vẽ InMapz
  scripts/export-data.mjs       chụp dữ liệu từ backend ra public/data/
  public/plans/tan-son-nhat/    11 bản vẽ SVG (InMapz, đã crawl)
  public/data/venues*.json      bản chụp tĩnh định dạng API v2
```

## Màn hình ↔ route

| Thiết kế | Route | Tệp |
|---|---|---|
| Chọn địa điểm | `/` | `HomePage.tsx` |
| Thông tin địa điểm | `/v/:slug` | `VenueInfoPage.tsx` |
| Bản đồ trong nhà (+ chọn vị trí `?pick=position`) | `/v/:slug/map` | `MapPage.tsx` |
| Tìm kiếm (+ chọn điểm đi/đến `?pick=from|to`) | `/v/:slug/search` | `SearchPage.tsx` |
| Chi tiết địa điểm | `/v/:slug/place/:id` | `PlacePage.tsx` |
| Xem tuyến | `/v/:slug/route?to=` | `RoutePage.tsx` |
| Đang đi 2D · Chuyển tầng · Đã đến | `/v/:slug/go` | `NavigatePage.tsx` |
| Quét QR định vị | `/v/:slug/scan`, `/scan`, `/q/:slug/:mã` | `ScanPage.tsx` |
| Chỉ đường bằng camera · Mất vị trí | `/v/:slug/camera` | `CameraPage.tsx` |
| Cài đặt | `/settings` | `SettingsPage.tsx` |

## Định vị trong nhà (không có GPS)

1. **Điểm xuất phát chắc chắn**: quét mã QR (mã = id nút lối đi, ví dụ `T1-1-17`; nội dung khuyến nghị
   `https://<website>/q/<slug>/<mã>` để app camera của điện thoại mở thẳng bản đồ), chọn địa điểm gần mình,
   hoặc kéo bản đồ tới chỗ đứng.
2. **Trong lúc đi**: mỗi bước chân (cảm biến gia tốc) tiến thêm `stepLength` mét *dọc tuyến* (bám tuyến nên không trôi
   ngang). La bàn cho hướng nhìn, bản đồ xoay theo hướng đi.
3. **Căn lại**: độ lệch ước lượng = 1 m (QR) + 8% quãng đi bằng bước chân. Quá ~14 m thì gợi ý quét QR.
   Quét QR gần tuyến (≤ 15 m) → nhảy tới đúng chỗ; xa tuyến → lập lại tuyến.
4. **Đổi tầng**: tới chân thang thì dừng, hiện màn Chuyển tầng; khách bấm xác nhận (hoặc quét QR đầu thang).
5. **Camera (AR-lite, thử nghiệm)**: mũi tên vẽ trên sàn, góc = hướng đoạn tuyến phía trước − hướng la bàn.
   Chưa có nhận diện cảnh bằng AI (giai đoạn sau: DINOv2/NetVLAD so khớp ảnh mốc do chủ địa điểm chụp).
6. **Mô phỏng đi bộ** (1,3 m/s): cho máy tính không có cảm biến và khi trình diễn.

## Chạy

```bash
cd packages/core && npm install && npm test     # một lần, để chạy test logic
cd Front-End && npm install
npm run dev            # http://localhost:5173 — /api chuyển tới backend :8080; backend tắt thì dùng bản chụp tĩnh
npm run dev:phone      # HTTPS tự ký + --host: mở https://<IP-máy>:5173 trên điện thoại cùng Wi-Fi (camera, la bàn cần HTTPS)
npm run build          # tsc -b && vite build
npm run lint
npm run export-data    # backend đang chạy -> public/data/venues*.json
npm run build-demo     # dữ liệu v1 + bản vẽ InMapz -> dữ liệu mẫu v2 + SQL gắn bản vẽ
```

CSDL đã migrate v2: chạy thêm `Back-End/database/v2/04_plans_tan_son_nhat.sql` để các tầng có bản vẽ InMapz
(`plan_image_url = /plans/tan-son-nhat/T1_L1.svg`, điểm mốc = 2 góc trên của bản vẽ).

## Ghi chú kỹ thuật

- TypeScript strict + `noUncheckedIndexedAccess`; ESLint typescript-eslint + react-hooks 7.
- Phông chữ đi kèm (`@fontsource`, có bộ tiếng Việt) — không phụ thuộc Google Fonts khi mạng trong toà nhà yếu.
- Leaflet + leaflet-rotate; bản vẽ SVG nội tuyến (`L.svgOverlay`) đặt bằng ma trận affine của `projection.ts`.
  Đã vá `_onZoomTransitionEnd` của Leaflet để không báo lỗi `_leaflet_pos` khi chuyển trang giữa lúc zoom.
- Nền bản đồ ngoài trời: CARTO light (OpenStreetMap).
- Màn camera, quét QR (jsQR) và trang Builder/Admin được tải sau (code-splitting).
