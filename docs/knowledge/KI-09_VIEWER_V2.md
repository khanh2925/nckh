# KI-09 · Viewer v2 (khách tham quan) — React + TypeScript

Frontend v2 của khách tham quan, nối API v2. Bố cục theo bản thiết kế 31 (bản đồ phẳng tràn màn + thanh tìm kiếm nổi
+ bảng trượt dưới); màu và phông **giống Builder/Admin** (theme shadcn, xem [KI-10](KI-10_BUILDER_ADMIN_V2.md)):
chữ neutral-900 `#171717`, màu chủ đạo xanh dương `#155DFC`, một phông Inter.

## Bộ giao diện khách (client kit)

- Token màu của khách: `src/design/tokens.css` (cùng giá trị với theme Builder). Xanh dương cho nút chính, mục đang chọn,
  tuyến, vị trí của bạn; màu đậm cho HUD chỉ hướng. Tên biến cũ giữ nguyên (`--graphite` = màu đậm, `--signal` = màu chủ đạo).
- Lớp CSS: `src/styles/wayfind.css`, mọi lớp có tiền tố `wf-`. Cỡ chữ 13/15/17/22/28/44 (`wf-t13`…`wf-t44`), bo góc 4/12/16/24/999,
  chiều cao bấm 44/52, nút chính luôn ở đáy bảng trượt hoặc đáy màn. Chữ lớn (`html.large-text`) phóng cỡ chữ.
- Thành phần: `viewer/components/ui.tsx` (Button, IconButton, Sheet, Row, Segmented, Toggle, Hud, Dots, ErrorScreen, NotYet…).
- Icon giao diện: `src/design/Lc.tsx` (Lucide, sinh trong `src/design/lucide.ts`). Bootstrap Icons chỉ còn cho biểu tượng loại
  địa điểm lưu trong CSDL (`type.icon = "bi-…"`).
- Bản đồ (`FloorMap.tsx` + `viewer/mapTheme.ts` + `themePlanSvg` trong `lib/planSvg.ts`): mặt bằng tô theo vai trò màu, điểm là ô biển
  bo 4 px; nhìn xa chỉ hiện mốc định hướng (cửa ra, an ninh, thang máy, thông tin), gần hơn hiện thêm loại quan trọng và nhãn;
  tuyến xanh dương viền xanh đậm; vị trí khách = chấm xanh viền trắng + quầng sai số + nón hướng nhìn. Không nghiêng 3D.
  Màu Leaflet/SVG (cần hex) ở `viewer/mapTheme.ts`.
- Không giả số liệu: chức năng chưa có API hiện "Chưa khả dụng" (báo lỗi bản đồ, nhận diện mốc).

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
  src/design/           tokens.css (màu dùng chung), Lc.tsx + lucide.ts (icon)
  src/viewer/           VenueContext, useTripEngine, format.ts, mapTheme.ts, components (FloorMap, ui), pages/
  src/styles/wayfind.css   bộ giao diện khách (wf-*)
  src/portal/           trang 404
  scripts/build-demo-venue.py   sinh dữ liệu mẫu v2 + 04_plans_tan_son_nhat.sql từ dữ liệu v1 + bản vẽ InMapz
  scripts/export-data.mjs       chụp dữ liệu từ backend ra public/data/
  public/plans/tan-son-nhat/    11 bản vẽ SVG (InMapz, đã crawl)
  public/data/venues*.json      bản chụp tĩnh định dạng API v2
```

## Màn hình ↔ route

| Thiết kế | Route | Tệp |
|---|---|---|
| Main (chọn địa điểm) | `/` | `HomePage.tsx` |
| VenueInfo | `/v/:slug` | `VenueInfoPage.tsx` |
| Map (Khám phá), WhereAmI (`?pick=position`), FloorPicker (menu) | `/v/:slug/map` | `MapPage.tsx` |
| Preview (xem như khách) | `/v/:slug/preview` | `MapPage.tsx` |
| Search (+ `?pick=from\|to\|here`, `?group=`) | `/v/:slug/search` | `SearchPage.tsx` |
| Detail | `/v/:slug/place/:id` | `PlacePage.tsx` |
| Route, RouteError | `/v/:slug/route?to=` | `RoutePage.tsx` |
| Permission (xin quyền cảm biến/camera) | `/v/:slug/permission?to=&then=go\|camera` | `PermissionPage.tsx` |
| Navigate, FloorChange, Arrived | `/v/:slug/go` | `NavigatePage.tsx` |
| QR, QRLanding | `/v/:slug/scan`, `/scan`, `/q/:slug/:mã` | `ScanPage.tsx` |
| Camera, Camera-Lost | `/v/:slug/camera` | `CameraPage.tsx` |
| Share, SharedRoute | `/v/:slug/share?to=`, `/v/:slug/shared?den=&tu=` | `SharePage.tsx`, `SharedRoutePage.tsx` |
| Stride (đo bước chân) | `/v/:slug/stride`, `/settings/stride` | `StridePage.tsx` |
| Journeys, JourneyRun | `/v/:slug/journeys`, `/journeys/:id` | `JourneysPage.tsx`, `journeyRun.ts`; thẻ bước khi tới nơi trong `NavigatePage.tsx` |
| Report (chưa có API, không gửi gì) | `/v/:slug/report` | `ReportPage.tsx` |
| Settings | `/settings` | `SettingsPage.tsx` |
| Error | địa điểm không tồn tại / lỗi mạng | `ErrorScreen` trong `ui.tsx` |

**Link chia sẻ tuyến**: `/v/<slug>/shared?den=<id điểm đến>&tu=qr:<mã>|diem:<id>` — chỉ chứa id, không bao giờ chứa lat/lng thô.

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
   **Định vị nâng cao (thử nghiệm, bật trong Cài đặt)**: thay "mỗi bước cộng stepLength" bằng bộ lọc hạt theo lối đi — xem [KI-11](KI-11_INDOOR_POSITIONING_PF.md).
7. **GPS ngoài trời (khuôn viên)**: tầng **không có bản vẽ** được coi là bản đồ ngoài trời (`isOutdoorFloor`), vẽ thẳng
   trên nền OpenStreetMap. Trên tầng đó màn "Bạn đang ở đâu?" có thêm **Dùng GPS**, và lúc đi `useGps` theo dõi GPS:
   sai số ≤ 20 m (`GPS_USABLE_ACCURACY`) thì `gpsTripUpdate` kéo vị trí tới chỗ gần nhất trên tuyến (không lùi khi GPS rung
   ít hơn sai số; lệch tuyến > 25 m thì lập lại tuyến), bước chân lấp khoảng giữa hai lần đo. Tầng có bản vẽ (trong nhà)
   không bật GPS. Ví dụ: địa điểm `iuh` (khuôn viên IUH, một tầng "Mặt đất", điểm loại `building` / `campus_gate` nhóm `campus`).

## Quy trình (đi theo nhiều bước)

`/v/:slug/journeys` liệt kê quy trình đã công khai (`model.journeys`). Chọn một quy trình:
câu hỏi đầu (có/không) → điểm xuất phát (như "Bạn đang ở đâu?") → tổng quan → Bắt đầu.

- **Chọn nơi cho từng bước** (`packages/core/src/journey.ts`, `planJourney`): bước theo loại có nhiều nơi phục vụ.
  App chọn nơi cho cả chuỗi để tổng quãng ngắn nhất bằng quy hoạch động trên đồ thị phân tầng.
  Quãng đường lấy từ `createDistanceOracle` (`routing.ts`): một Dijkstra một-nguồn cho mỗi ứng viên của bước trước.
  `greedy: true` chọn nơi gần nhất từng bước, để so sánh trong báo cáo; test khẳng định quy hoạch động không dài hơn.
- **Bỏ bước** khi mọi điều kiện `skipIf` thoả, hiện mờ kèm lý do. Bước tuỳ chọn không có nơi tới được cũng bị bỏ;
  bước bắt buộc mà không có nơi tới được thì quy trình không bắt đầu được.
- **Tổng quan** hiện nơi được chọn, tầng, quãng đường của từng bước, và tổng "đi bộ X phút + chờ khoảng Y phút" (ước tính).
  "Đổi nơi" ghim nơi khách tự chọn (`pinned`), ví dụ đúng cửa ra máy bay của mình; các bước sau tự tính lại.
- **Đi từng bước**: mỗi bước là một Trip bình thường (màn Đang đi, GPS, QR, mô phỏng vẫn dùng được).
  Tới nơi → `JourneyStepArrived` hiện hướng dẫn tại bước + "Đã xong bước này" (bước tuỳ chọn có thêm "Bỏ qua").
  Bấm xong thì lập tuyến tới bước sau từ chỗ đang đứng (`done`/`skip` trong `planJourney`); bước cuối dẫn tới màn tổng kết.
- **Lưu tiến độ** (`journeyRun.ts`): localStorage `journey:<slug>`, tải lại trang thì đi tiếp (BR-34).
- **Chưa làm:** phiên bản quy trình (BR-35), quy trình mẫu (UC029), lọc nơi theo thuộc tính (vd. quầy của hãng),
  giờ mở cửa khi chọn nơi.

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
- Phông chữ đi kèm: Inter (`@fontsource-variable/inter`, có bộ tiếng Việt) — không phụ thuộc Google Fonts khi mạng trong toà nhà yếu.
- Leaflet + leaflet-rotate; bản vẽ SVG nội tuyến (`L.svgOverlay`) đặt bằng ma trận affine của `projection.ts`.
  Đã vá `_onZoomTransitionEnd` của Leaflet để không báo lỗi `_leaflet_pos` khi chuyển trang giữa lúc zoom.
- Nền bản đồ ngoài trời: tile OpenStreetMap, làm xám nhạt để mặt bằng nổi lên (CARTO không còn cho dùng không cần khoá API).
- Màn camera, quét QR (jsQR) và trang Builder/Admin được tải sau (code-splitting).
