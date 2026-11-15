# KI-11 · Định vị nâng cao: bước chân + bộ lọc hạt theo lối đi (thử nghiệm)

Mục tiêu đúng câu hỏi nghiên cứu của đặc tả: định vị trong nhà **không lắp thiết bị**, ràng buộc bởi chính mạng lối đi
chủ địa điểm đã vẽ. Bật trong **Cài đặt → Định vị nâng cao (thử nghiệm)**; tắt thì app chạy như cũ (mỗi bước cộng
`stepLength` dọc tuyến, KI-09).

## Ý tưởng

Bộ lọc hạt giữ cùng lúc 1000 **giả thuyết** (`count`, trước là 400), mỗi hạt = `{ x, y (m), tầng, độ lệch hướng, hệ số K }`:

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

## Chấm nhảy: phát hiện, chặn và học từ lần sai

Chấm trên bản đồ không được nhảy xa hơn quãng người đi được. Bốn lớp, từ cảm biến tới màn hình:

| Lớp | Làm gì | Mã |
|---|---|---|
| Đếm bước | Đang đi đều mà một "bước" tới sớm hơn 60% nhịp (lắc máy, va chạm): bỏ, ghi `stepReject` | `StepGate` (`minFraction`) |
| Số đo GPS | Lần đo cách lần tin trước xa hơn `2,5 m/s × thời gian + sai số + 5 m`: bỏ, ghi `outlier`; ba lần liền cùng chỉ chỗ mới thì nhận | `PlausibilityGate` |
| Đặt lên tuyến | Chỉ tìm chỗ trên tuyến trong cửa sổ quanh chỗ đang đứng (lùi 2×sai số, tiến 4 m + sai số mỗi bước; GPS 15 m + 2×sai số). Ước lượng vọt xa thì chấm đuổi theo từng đoạn, không nhảy sang nhánh khác của tuyến. Chỉ lập lại tuyến khi bộ lọc đã báo rẽ nhầm (`offRoute`) | `snapToRoute(window)`, `pdrTripUpdate`, `gpsTripUpdate` |
| Màn hình | Chấm vẫn nhảy xa hơn quãng đi được thì ghi một sự cố kèm nguyên nhân (`step`, `gps`, `reroute`, `floor`…). Quét QR luôn ghi khoảng sửa = sai số thật ngay trước đó | `JumpMonitor` |

Học từ lần sai: giữa hai mã QR liền nhau (cùng tuyến, cùng chặng, không rẽ nhầm), quãng dọc tuyến là quãng thật, chia số bước
ra độ dài bước và K (`AnchorCalibrator`), gộp vào bước đã học (`mergeStride`) và chỉnh K của mọi giả thuyết (`retuneK`).

Xem: Cài đặt → Sự cố định vị (đếm trong lần mở app). Nhật ký cảm biến ghi đủ `jump`, `outlier`, `stepReject`, `stride`;
`PF_LOG=... npx vitest run test/positioning.eval.test.ts` in danh sách sự cố cùng sai số tại các mốc QR.

## Kết hợp GPS (ngoài trời)

GPS chỉ bật khi chặng đang đi nằm trên tầng không có bản vẽ (`isOutdoorFloor`). Mỗi lần đo: lọc nhảy (`PlausibilityGate`) ->
tự đo bước (`StrideCalibrator`) -> bỏ nếu sai số > 20 m -> đưa vào bộ lọc (`observe`) **5 s một lần với σ = 2 × max(3, sai số)**.
Lý do: sai số GPS điện thoại kéo dài nhiều giây, các lần đo liền nhau sai giống nhau; đưa vào cả mỗi giây với σ = sai số thì
bộ lọc tin GPS quá mức. Mô phỏng khuôn viên (lưới lối đi 30 m, 40 lần đi ~300 m, con quay trôi 0,05°/bước):

| Cách | GPS lệch ~5 m: trung vị / p90 / p99 | GPS lệch ~10 m: trung vị / p90 / p99 |
|---|---|---|
| Chỉ bước chân (bộ lọc, không GPS) | 1,0 / 4,1 / 17,4 m | 1,1 / 4,5 / 11,4 m |
| Bộ lọc + GPS mỗi giây, σ = sai số (cũ) | 2,0 / 6,7 / 11,0 m | 2,6 / 15,3 / 30,7 m |
| Bộ lọc + GPS 5 s, σ × 2 (hiện tại) | 0,8 / 2,4 / 5,8 m | 0,9 / 3,2 / 8,1 m |
| GPS thô | 6,3 / 12,0 / 61,6 m | 11,9 / 22,4 / 59,7 m |

Mô phỏng giả định người đi đúng tuyến; cần đo lại bằng nhật ký đi thật ở IUH.

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

Số giả thuyết (45 tuyến × 3 trường hợp × 3 seed = 405 lần đi, nửa sau mỗi tuyến):

| Số hạt | p50 | p90 | p99 | Cuối tuyến sai > 5 m | Thời gian / bước (máy chủ) |
|---|---|---|---|---|---|
| 200 | 0,7 m | 5,0 m | 72,9 m | 34/405 | 0,15 ms |
| 400 | 0,6 m | 2,2 m | 13,6 m | 13/405 | 0,31 ms |
| 1000 | 0,5 m | 1,7 m | 12,7 m | 1/405 | 0,76 ms |
| 2000 | 0,5 m | 1,6 m | 11,5 m | 0/405 | 1,53 ms |

Thêm hạt chủ yếu giảm các lần bám nhầm hẳn (đuôi phân bố), sai số thường gặp gần như không đổi. Chọn 1000.

**Giới hạn**: số liệu mô phỏng, chưa đo bằng điện thoại thật. Lưới lối đi tự sinh của sân bay dày (nhiều nét song song)
nên khi đi tự do không có tuyến, bộ lọc dễ bám nhầm; cần mốc QR. Chỉ chạy trong lúc chỉ đường (màn "Bạn đang ở đâu?" chưa dùng).
Đổi tầng vẫn xác nhận tay; đi thang cuốn không có bước chân.

## Việc tiếp theo

- Đi thật có ghi nhật ký, chạy lại để tinh chỉnh tham số (corridorSigma, routeSigma, nhiễu hướng, ngưỡng rẽ nhầm…).
- Đo thật ở IUH: so cách cũ / Weinberg / bộ lọc hạt / + mốc quy trình (thí nghiệm A–D cho báo cáo).
- Nhận ra rẽ nhầm tốt hơn; đổi tầng tự động; beacon hoặc ảnh camera chỉ là thêm một loại mốc (`observe`).
