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
Đã `offRoute` mà bộ lọc chắc (±5 m) thì cũng đưa vị trí vào chuyến đi để tự lập lại tuyến; còn mơ hồ thì báo quét QR.

## Học từ máy đếm bước của Apple Watch / iPhone

- Apple: đi ngoài trời ~20 phút có GPS để Watch học độ dài bước ở từng tốc độ, và học tiếp mỗi lần đi ngoài trời
  ([Apple Support 105048](https://support.apple.com/105048)). Bằng sáng chế US10001386 (Apple) chỉ dùng đoạn GPS "đẹp":
  nhịp bước đều kéo dài, đường thẳng, tốc độ ổn định, đủ dài, rồi gộp với kết quả cũ theo trọng số.
- Ở đây: `StrideCalibrator` tự đo khi đi ngoài trời (khuôn viên), cả hai cách định vị: GPS ≤ 10 m, ≥ 60 m và ≥ 60 bước,
  độ thẳng ≥ 0,92 (chỉ lấy các lần đo cách nhau ≥ 8 m), nhịp bước lệch ≤ 15%; `mergeStride` gộp theo quãng đường
  (giữ tối đa 2 km để vẫn theo kịp). Kết quả cập nhật `stepLength` (cách cơ bản) và `weinbergK` (định vị nâng cao).
- `StepGate`: chỉ tính bước khi có ≥ 4 bước đều nhịp (lệch ≤ 35%), rồi tính bù cả chuỗi; dừng > 2 s thì phải đều nhịp lại.
  Lắc máy, đặt máy xuống không thành bước. (Chỉ áp cho định vị nâng cao; cách cơ bản giữ nguyên.)
- Weinberg đã tự co giãn độ dài bước theo tốc độ (đi nhanh nhấp nhô mạnh hơn), nên chưa cần bảng K theo từng tốc độ.

## Xử lý các tình huống khi đi thật

- **Đổi cách cầm máy** (`PostureMonitor`): phương trọng lực đổi > 35° quá 0,8 s -> `filter.loosen()` nới độ lệch hướng ±30°, K ±10%.
- **Xoay màn hình ngang**: cộng góc màn hình vào hướng (như la bàn đang làm).
- **Trình duyệt chỉ cho hướng la bàn tuyệt đối** (`absolute` = true, một số máy Android): nhiễu hướng mỗi bước 12° thay vì 6°.
- **Tắt màn hình / chuyển tab**: giữ màn hình sáng khi đang đi (Wake Lock); quay lại thì nới vị trí theo thời gian đã mất.
- **Mô phỏng trên máy tính**: bật định vị nâng cao rồi bấm Mô phỏng: "người thật" đi đúng tuyến với bước K 0,5 (~0,62 m) và
  con quay lệch 40°, cảm biến giả có nhiễu đưa vào bộ lọc; chấm trên bản đồ là kết quả của bộ lọc. Không lưu K khi mô phỏng.

## Nhật ký cảm biến và chạy lại

- Cài đặt -> Định vị nâng cao -> **Ghi nhật ký cảm biến**. Ghi gia tốc, hướng, tuyến, mốc (kèm hướng ban đầu), GPS, đổi cách cầm,
  ước lượng; giữ trong bộ nhớ trang (tối đa 400 000 mục ~ 40 phút). **Tải về** ra JSON (kèm mạng lối đi).
- Quét QR bằng nút **Quét QR trong app** (mở link QR bằng app camera sẽ tải lại trang và mất nhật ký). Mỗi lần quét là một
  điểm đo: sai số = vị trí bộ lọc đang tin ngay trước khi QR sửa lại.
- Chạy lại: `PF_LOG=nhat-ky.json npx vitest run test/positioning.eval.test.ts` (trong `packages/core`), thử tham số bằng
  `PF_OPTS='{"corridorSigma":1.5}'`. `replayPositioningLog` (positioningLog.ts) đi đúng chuỗi xử lý của app, cùng seed,
  và tính luôn cách cũ (mỗi bước cộng stepLength dọc tuyến từ mốc trước) trên cùng lần đi để so sánh.

## Mã nguồn

| Tệp | Nội dung |
|---|---|
| `packages/core/src/positioning.ts` | `WeinbergStepDetector`, `StepGate`, `PostureMonitor`, `StrideCalibrator`, `headingFromOrientation`, `buildWalkwayIndex` (lưới 10 m), `ParticleFilter` (seed cố định được) |
| `packages/core/src/positioningLog.ts` | định dạng nhật ký, `replayPositioningLog` |
| `Front-End/src/lib/positioningLog.ts` | ghi nhật ký trong bộ nhớ, tải về JSON |
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
nên khi đi tự do không có tuyến, bộ lọc dễ bám nhầm; cần mốc QR. Chỉ chạy trong lúc chỉ đường (màn "Bạn đang ở đâu?" chưa dùng).
Đổi tầng vẫn xác nhận tay; đi thang cuốn không có bước chân.

## Việc tiếp theo

- Đi thật có ghi nhật ký, chạy lại để tinh chỉnh tham số (corridorSigma, routeSigma, nhiễu hướng, ngưỡng rẽ nhầm…).
- Đo thật ở IUH: so cách cũ / Weinberg / bộ lọc hạt / + mốc quy trình (thí nghiệm A–D cho báo cáo).
- Nhận ra rẽ nhầm tốt hơn; đổi tầng tự động; beacon hoặc ảnh camera chỉ là thêm một loại mốc (`observe`).
