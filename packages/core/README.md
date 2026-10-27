# @indoor-map/core

Logic dùng chung cho **Viewer web** (`Front-End`) và **app React Native** sau này. TypeScript thuần, không dùng DOM, Leaflet hay React.

| Tệp | Nội dung |
|---|---|
| `types.ts` | Kiểu dữ liệu API v2 (khớp DTO Java của Back-End) |
| `api.ts` | `createApiClient()` — đọc API, tự dùng bản chụp tĩnh `/data/*.json` khi không có backend |
| `venueModel.ts` | `buildVenueModel()` lập chỉ mục gói `/api/venues/{slug}/map`; `searchPlaces()` tìm không dấu |
| `projection.ts` | Đặt bản vẽ mặt bằng (pixel) lên bản đồ (lat/lng) bằng 2 điểm mốc, Web Mercator tự viết |
| `routing.ts` | Dijkstra (heap) trên mạng lối đi nhiều tầng, tránh thang cuốn/thang bộ, chiếu điểm lên tuyến |
| `directions.ts` | Chỉ dẫn từng bước theo mốc: "Rẽ trái tại Quầy thông tin", "Đi thang cuốn lên Tầng 2" |
| `trip.ts` | Trạng thái chuyến đi (hàm thuần): tiến theo bước chân, dừng chờ đổi tầng, căn lại bằng QR, lập lại tuyến |
| `pdr.ts` | Đếm bước từ gia tốc, làm mượt la bàn, ước lượng độ lệch vị trí |
| `qr.ts` | Đọc nội dung mã QR định vị (`/q/<slug>/<mã>`), tìm nút theo mã |

```bash
npm install
npm test          # vitest, chạy trên dữ liệu thật của Tân Sơn Nhất
npm run typecheck
```

Web dùng qua `"@indoor-map/core": "file:../packages/core"` trong `Front-End/package.json`.
App React Native (Expo) sau này: thêm cùng dòng đó, cấu hình Metro `watchFolders` trỏ tới `packages/core`,
rồi đọc cảm biến bằng `expo-sensors` và đưa vào `StepDetector` / `HeadingFilter`.
