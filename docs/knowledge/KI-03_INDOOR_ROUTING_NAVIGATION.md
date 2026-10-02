# KI-03: Thuật Toán Chỉ Đường & Đồ Thị Lối Đi (Indoor Routing & Navigation Engine)

## 1. Mô Hình Đồ Thị Lối Đi (Walkways Graph)

Hệ thống dẫn đường trong nhà hoạt động dựa trên đồ thị vô hướng có trọng số (weighted undirected graph) được lưu tại `Front-End/src/data/walkways.js`:

```text
┌────────────────┐      (Edge cùng tầng)       ┌────────────────┐
│   Node A (F1)  │ ─────────────────────────── │   Node B (F1)  │
│   {x1, y1}     │  cost = distanceInMeters    │   {x2, y2}     │
└───────┬────────┘                             └────────────────┘
        │
        │ (Edge nối tầng qua Thang máy/cuốn)
        │ cost = 30 mét phạt (FLOOR_CHANGE_METERS)
        ▼
┌────────────────┐
│   Node C (F0)  │
│   {x3, y3}     │
└────────────────┘
```

### Thành phần đồ thị:
1. **Nodes (`walkways.nodes`)**:
   - Mỗi node là một điểm ngã rẽ hoặc điểm trung gian trên hành lang, có cấu trúc: `{ id: "1-u239", floor: 1, x: 239, y: 222, connector: "Thang máy" | "Thang cuốn" (optional) }`.
2. **Edges (`walkways.edges`)**:
   - Danh sách các cặp đỉnh nối trực tiếp không bị chắn tường `["1-u239", "1-u320"]`.
   - Cặp đỉnh ở 2 tầng khác nhau (ví dụ `["0-e300", "1-e300"]`) đại diện cho trục thang máy hoặc thang cuốn.

---

## 2. Thuật Toán Tìm Đường Dijkstra (`routing.js`)

Thuật toán định tuyến tìm đường ngắn nhất được thực thi trực tiếp trên Client Frontend theo 4 giai đoạn:

### Giai đoạn 1: Ánh xạ điểm bắt đầu & đích đến vào đồ thị (Nearest Node Search)
- Vì địa điểm người dùng chọn (`from`, `to`) không nhất thiết là một đỉnh trên đồ thị, hàm `findNearestNode(point)` sẽ tìm đỉnh `node` gần nhất **trên cùng tầng** (`node.floor === point.floor`).

### Giai đoạn 2: Tính trọng số cạnh (Edge Weights)
- **Cùng tầng**: `cost = meters(nodeA, nodeB)` (khoảng cách thực tế trích xuất qua `projection.toLatLng`).
- **Khác tầng (Thang máy/cuốn)**: `cost = FLOOR_CHANGE_METERS = 30m` (khoảng cách phạt để ưu tiên đi cùng tầng nếu không bắt buộc phải đổi tầng).

### Giai đoạn 3: Tìm đường ngắn nhất Dijkstra
- Khởi tạo khoảng cách các đỉnh bằng $\infty$, đỉnh xuất phát = 0.
- Liên tục chọn đỉnh chưa thăm có khoảng cách nhỏ nhất, nới lỏng các đỉnh kề (relaxation).
- Truy vết ngược (`previous[node]`) từ đỉnh đích về đỉnh bắt đầu.

### Giai đoạn 4: Phân chia chặng đường theo tầng (`splitByFloor`)
- Danh sách tọa độ trả về được gom nhóm thành các chặng (**Legs**).
- Mỗi **Leg** chứa:
  - `floor`: Tầng đang đi.
  - `points`: Mảng các điểm tọa độ pixel trên tầng đó.
  - `distance`: Chiều dài chặng đi tính bằng mét.
  - `connector`: Loại phương tiện chuyển tầng ở cuối chặng ("Thang máy" hoặc "Thang cuốn").

---

## 3. Tính Toán Thời Gian & Tốc Độ Di Chuyển

```javascript
const WALK_SPEED = 1.2;            // 1.2 mét / giây (tốc độ đi bộ bình quân mang hành lý)
const FLOOR_CHANGE_SECONDS = 45;   // 45 giây (thời gian trung bình chờ và đi thang máy/thang cuốn)

// Công thức ước lượng thời gian:
const totalSeconds = (totalDistance / WALK_SPEED) + (numberOfLegs - 1) * FLOOR_CHANGE_SECONDS;
const totalMinutes = Math.max(1, Math.ceil(totalSeconds / 60));
```

---

## 4. Render Đường Đi & Animation Trên Bản Đồ (`MapView.jsx`)

1. **Hiển thị chặng theo tầng hiện tại**: Khi người dùng đang ở tầng nào, chỉ chặng đường của tầng đó được vẽ lên bản đồ.
2. **Hiệu ứng trực quan**:
   - Đường nét đứt xanh dương (`dashArray: "8, 12"`).
   - Biểu tượng người đi bộ di chuyển dọc theo chặng đường (`walking-person-icon` có animation CSS).
   - Điểm đổi tầng có icon thang máy/thang cuốn nhấp nháy chỉ dẫn hành khách chuyển tầng.
