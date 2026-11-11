# KI-11 · Định vị nâng cao: bước chân + bộ lọc hạt theo lối đi (thử nghiệm)

Mục tiêu đúng câu hỏi nghiên cứu của đặc tả: định vị trong nhà **không lắp thiết bị**, ràng buộc bởi chính mạng lối đi
chủ địa điểm đã vẽ. Bật trong **Cài đặt → Định vị nâng cao (thử nghiệm)**; tắt thì app chạy như cũ (mỗi bước cộng
`stepLength` dọc tuyến, KI-09).

## Ý tưởng

Bộ lọc hạt giữ cùng lúc ~400 **giả thuyết**, mỗi hạt = `{ x, y (m), tầng, độ lệch hướng, hệ số K }`:

1. **Mỗi bước chân**: mọi hạt bước theo số đo cảm biến, mỗi hạt hiểu theo giả thuyết riêng (+ nhiễu).
   - Độ dài bước **Weinberg**: `L = K × (a_max − a_min)^(1/4)`, `a` = độ lớn gia tốc trong bước. K riêng từng người, tự học.
   - Hướng: con quay (`deviceorientation` tương đối) + độ lệch riêng của hạt. Không tin la bàn tuyệt đối trong nhà.
2. **Ràng buộc bản đồ**: hạt xa nét lối đi (`corridorSigma` 2 m, quá `maxOffPath` 7 m) mất trọng số; không về 0 hẳn.
   Đang chỉ đường thì ưu tiên nhẹ tuyến (`routeSigma` 6 m, sàn `routeFloor` 0,15); đoạn từ cửa hàng ra lối đi cũng đi được.
3. **Mốc**: QR (σ 1,5 m), "Đã xong bước này" / đang ở địa điểm (3 m), chọn trên bản đồ (4 m), GPS ngoài trời (sai số GPS).
   Mốc xa hẳn chỗ bộ lọc đang tin thì rải lại quanh mốc, **giữ K và độ lệch hướng đã học**.
4. **Nhân bản** (systematic resampling) khi số hạt hiệu dụng < N/2; rung nhẹ K, hướng; rải mới 6% quanh ước lượng
   và 3% lên tuyến quanh ước lượng (thoát khi bám nhầm hành lang song song).
5. **Rẽ nhầm**: hướng đi lệch hướng đoạn tuyến gần nhất > 50° liên tục 6 bước (không ở khúc cua) → `offRoute`,
   bộ lọc thôi bám tuyến, giao diện báo "Có vẻ bạn đã đi khác tuyến, quét QR".

Đầu ra (`PositionEstimate`): vị trí trung bình có trọng số, bán kính sai số, K, độ lệch hướng, `offRoute`.
`pdrTripUpdate` (trip.ts) đặt vị trí lên tuyến giống GPS; lệch > 10 m khi bộ lọc đã chắc thì lập lại tuyến.

## Mã nguồn

| Tệp | Nội dung |
|---|---|
| `packages/core/src/positioning.ts` | `WeinbergStepDetector`, `headingFromOrientation`, `buildWalkwayIndex` (lưới 10 m), `ParticleFilter` (seed cố định được) |
| `packages/core/src/trip.ts` | `pdrTripUpdate`, nguồn vị trí `"pdr"` |
| `packages/core/src/geo.ts` | `fromLocalMeters` |
| `Front-End/src/lib/sensors.ts` | `usePdrSensors` (gia tốc + hướng con quay), `useWakeLock` |
| `Front-End/src/viewer/useTripEngine.ts` | tạo bộ lọc, đặt lại ở mỗi mốc, GPS là mốc, lưu K đã học (`settings.weinbergK`) |
| `Front-End/src/viewer/components/FloorMap.tsx` | lớp `particles`: chấm giả thuyết khi bật "Hiện các giả thuyết" |

## Đánh giá (mô phỏng)

`PF_EVAL=1 npx vitest run test/positioning.eval.test.ts` trong `packages/core`: 45 tuyến thật của Tân Sơn Nhất
(trung vị 152 m), người đi đúng tuyến, bộ lọc không biết K và độ lệch con quay, nhiễu hướng 4°/bước.

| Trường hợp | Sai số cuối tuyến (trung vị / lớn nhất) | Cách cũ, bước cố định 0,7 m |
|---|---|---|
| Có hướng ban đầu ±60° | 0,5 / 5,2 m | 20,6 / 80,2 m |
| Không biết hướng ban đầu | 0,5 / 4,6 m | 20,6 / 80,2 m |
| Bước ngắn (K 0,42) | 0,5 / 4,3 m | 48,9 / 196,6 m |
| Bước dài (K 0,56, gần 0,7 m) | 0,6 / 12,8 m | 1,5 / 8,8 m |
| Con quay trôi 0,05°/bước | 0,7 / 4,4 m | 20,6 / 80,2 m |

Rẽ nhầm (lệch tuyến ≥ 25 m): nhận ra 19/32 lần.

**Giới hạn**: số liệu mô phỏng, chưa đo bằng điện thoại thật. Lưới lối đi tự sinh của sân bay dày (nhiều nét song song)
nên khi đi tự do không có tuyến, bộ lọc dễ bám nhầm; cần mốc QR. Chưa ghi log cảm biến để chạy lại.

## Việc tiếp theo

- Ghi log cảm biến + nút đánh dấu điểm thật, chạy lại log trong Vitest (cùng seed) để tinh chỉnh tham số.
- Đo thật ở IUH: so cách cũ / Weinberg / bộ lọc hạt / + mốc quy trình (thí nghiệm A–D cho báo cáo).
- Nhận ra rẽ nhầm tốt hơn; đổi tầng tự động; beacon hoặc ảnh camera chỉ là thêm một loại mốc (`observe`).
