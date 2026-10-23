# KI-03: Chỉ Đường & Mạng Lối Đi (Indoor Routing & Walkway Network)

## 1. Mạng lối đi (walkway network)

Đồ thị vô hướng, lưu trong PostgreSQL (bảng `walkway_nodes`, `walkway_edges`, file `Back-End/database/03_walkways_schema.sql`), đọc/ghi qua `GET/PUT /api/walkways`. Bản web tĩnh đọc `Front-End/public/data/walkways.json` (xuất bằng `npm run export-data`).

```text
{ "nodes": [ { "id": "T1-1-17", "terminal": "T1", "floor": 1, "lat": 10.8137, "lng": 106.6618, "connector": "Thang máy" } ],
  "edges": [ { "from": "T1-1-17", "to": "T1-0-42" } ] }
```

- **Node**: một điểm trên hành lang, tọa độ lat/lng (WGS84) như địa điểm. `connector` chỉ có ở điểm đổi tầng ("Thang máy", "Thang cuốn", "Thang bộ").
- **Edge**: đoạn đi thẳng được giữa 2 node, đi được 2 chiều. Hai node khác tầng = trục thang.
- Dữ liệu ban đầu (`04_walkways_seed.sql`) được **sinh tự động** từ mặt bằng SVG (đường tâm hành lang) và các địa điểm thang máy/thang cuốn/thang bộ. Đây là bản nháp: Admin cần kiểm tra và vẽ lại chỗ sai.

## 2. Admin vẽ lối đi (`WalkwayPanel.jsx`, `hooks/useWalkwayEditor.js`)

Admin → tab **Lối đi**. Bản nháp là cả mạng lối đi; chỉ ghi vào database khi bấm **Lưu lối đi** (PUT thay toàn bộ, trong 1 transaction).

| Công cụ | Thao tác |
|---|---|
| Vẽ | Bấm mặt bằng = thêm điểm nối với điểm trước; bấm điểm có sẵn = nối tới nó; bấm giữa một đoạn = chèn điểm (rẽ nhánh). Esc / bấm lại điểm cuối = kết thúc nét |
| Chọn | Đánh dấu điểm là thang, "Nối tới tầng này" (tạo/nối điểm thang cùng vị trí ở tầng khác), xóa điểm |
| Xóa | Bấm điểm (xóa cả đoạn nối) hoặc bấm đoạn |

Kéo điểm để dời vị trí. Ctrl+Z hoàn tác. Mở "Chỉ đường" khi đang vẽ để thử ngay trên bản nháp (lúc đó bản đồ khóa chỉnh sửa).

## 3. Thuật toán (`utils/routing.js`)

1. **Điểm bất kỳ**: điểm đi/đến là một địa điểm hoặc một vị trí bấm trên mặt bằng (`{ isPoint, terminal, floor, lat, lng }`). Chỉ hỗ trợ trong cùng một nhà ga.
2. **Nhập vào mạng**: tìm điểm gần nhất trên **đoạn** lối đi gần nhất cùng tầng (chiếu vuông góc lên đoạn, tối đa 60 m), không chỉ node gần nhất. Mạng có thể có nhiều "mảnh" chưa nối; hai đầu phải vào cùng một mảnh, chọn mảnh có tổng quãng đi bộ vào mạng ngắn nhất.
3. **Dijkstra** trên đồ thị + 2 node tạm (điểm vào/ra). Trọng số: cùng tầng = mét thật (lat/lng quy ra mét), đổi tầng = 30 m phạt.
4. **Chia chặng theo tầng** (`legs`): mỗi chặng có `floor`, `points` (lat/lng), `distance`, `connector` dùng để rời tầng.

Thời gian: `distance / 1.2 m/s + (số chặng - 1) × 45 s`, làm tròn lên phút.

## 4. Hiển thị (`MapView.jsx`)

Chỉ vẽ chặng của tầng đang xem: chấm xanh, icon người đi bộ có mũi tên hướng đi, nút đổi tầng ở cuối chặng, ghim ở đích. Điểm đi/đến chọn trên bản đồ có marker riêng khi chưa có đường.
