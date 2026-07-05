# Học React + Leaflet cho project bản đồ T3

> Đây là tài liệu học tập cá nhân, viết đúng theo thứ tự bạn cần dùng trong project.
> Bạn của bạn lo phần SVG — bạn chỉ cần lo phần này.

---

## Chương 1 — React cơ bản bạn PHẢI biết

### 1.1 useState — ghi nhớ trạng thái

`useState` giống như một cái hộp, React dùng để nhớ một giá trị giữa các lần render.

```jsx
import { useState } from 'react'

function App() {
  const [view, setView] = useState('outdoor') // giá trị ban đầu là 'outdoor'

  return (
    <div>
      <p>Đang xem: {view}</p>
      <button onClick={() => setView('indoor')}>Vào trong nhà ga</button>
      <button onClick={() => setView('outdoor')}>Quay ra ngoài</button>
    </div>
  )
}
```

**Hiểu đơn giản:**
- `view` — giá trị hiện tại (đọc)
- `setView(...)` — hàm để thay đổi giá trị (viết)
- Khi gọi `setView(...)`, React tự render lại component

---

### 1.2 Render có điều kiện — hiện màn nào tùy trạng thái

```jsx
function App() {
  const [view, setView] = useState('outdoor')

  return (
    <div>
      {view === 'outdoor' && <p>Bạn đang ở bản đồ ngoài trời</p>}
      {view === 'indoor'  && <p>Bạn đang ở bản đồ bên trong nhà ga</p>}
    </div>
  )
}
```

Hoặc dùng ternary gọn hơn:

```jsx
{view === 'outdoor' ? <AirportOverviewMap /> : <TerminalT3Map />}
```

**Đây là cơ chế chuyển màn hình của project bạn.**

---

### 1.3 Props — truyền dữ liệu xuống component con

```jsx
// Component cha truyền hàm xuống con
function App() {
  const [view, setView] = useState('outdoor')

  return (
    <AirportOverviewMap onEnterTerminal={() => setView('indoor')} />
  )
}

// Component con nhận và dùng hàm đó
function AirportOverviewMap({ onEnterTerminal }) {
  return (
    <button onClick={onEnterTerminal}>Vào T3</button>
  )
}
```

**Quy tắc:** Dữ liệu đi từ cha xuống con. Sự kiện đi từ con lên cha qua hàm callback.

---

## Chương 2 — React Leaflet

### 2.1 Cấu trúc cơ bản

```jsx
import { MapContainer, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

function MyMap() {
  return (
    <MapContainer
      center={[10.8120, 106.6538]}  // [lat, lng]
      zoom={18}
      style={{ height: '100vh', width: '100%' }}
    >
      <TileLayer url="https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png" />
    </MapContainer>
  )
}
```

**Lưu ý quan trọng:**
- Tọa độ Leaflet luôn là `[lat, lng]` (vĩ độ trước, kinh độ sau)
- GeoJSON ngược lại: `[lng, lat]` — phải đổi khi dùng
- `MapContainer` chỉ render 1 lần, không re-render khi props thay đổi

---

### 2.2 Polygon và bắt sự kiện click

```jsx
import { Polygon } from 'react-leaflet'

const positions = [
  [10.8110775, 106.6513371],
  [10.8113566, 106.6512363],
  // ... các điểm khác
]

function MyMap({ onClickT3 }) {
  return (
    <MapContainer ...>
      <TileLayer ... />

      <Polygon
        positions={positions}
        pathOptions={{
          color: '#d63384',
          fillOpacity: 0.18,
        }}
        eventHandlers={{
          click: () => onClickT3()   // gọi hàm khi người dùng click vào polygon
        }}
      />
    </MapContainer>
  )
}
```

**`eventHandlers`** là prop đặc biệt của react-leaflet để bắt các sự kiện chuột.

---

### 2.3 GeoJSON — cách dùng đúng

GeoJSON là format chuẩn để lưu dữ liệu bản đồ. Bạn đã dùng geojson.io để vẽ — đúng rồi.

```jsx
import { GeoJSON } from 'react-leaflet'

const t3GeoJson = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {},
      geometry: {
        type: "Polygon",
        coordinates: [[ [106.651, 10.811], ... ]]  // [lng, lat] — chuẩn GeoJSON
      }
    }
  ]
}

function MyMap({ onClickT3 }) {
  return (
    <MapContainer ...>
      <TileLayer ... />

      <GeoJSON
        data={t3GeoJson}
        style={{ color: '#d63384', fillOpacity: 0.18 }}
        onEachFeature={(feature, layer) => {
          layer.on('click', () => onClickT3())
        }}
      />
    </MapContainer>
  )
}
```

**Ưu điểm dùng GeoJSON thay Polygon:**
- Paste thẳng dữ liệu từ geojson.io, không cần đổi tọa độ tay
- Dễ cập nhật khi vẽ lại shape

---

## Chương 3 — Áp dụng vào project

### 3.1 Cấu trúc file mục tiêu

```
src/
  components/
    AirportOverviewMap.jsx   ← bản đồ ngoài trời (Leaflet)
    TerminalT3Map.jsx        ← bản đồ trong nhà ga (SVG — bạn của bạn lo)
  data/
    terminalT3GeoJson.js     ← dữ liệu GeoJSON vùng T3
  App.jsx                    ← chỉ giữ logic chuyển màn
```

---

### 3.2 App.jsx sau khi tách xong

```jsx
import { useState } from 'react'
import AirportOverviewMap from './components/AirportOverviewMap'
import TerminalT3Map from './components/TerminalT3Map'

function App() {
  const [view, setView] = useState('outdoor')

  return (
    <main className="app-shell">
      {view === 'outdoor'
        ? <AirportOverviewMap onEnterTerminal={() => setView('indoor')} />
        : <TerminalT3Map onBack={() => setView('outdoor')} />
      }
    </main>
  )
}

export default App
```

---

### 3.3 AirportOverviewMap.jsx

```jsx
import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet'
import t3GeoJson from '../data/terminalT3GeoJson'

function AirportOverviewMap({ onEnterTerminal }) {
  return (
    <section className="map-shell">
      <div className="map-header">
        <p className="eyebrow">Bản đồ định vị</p>
        <h1>Nhà ga T3</h1>
      </div>

      <MapContainer
        center={[10.8120, 106.6538]}
        zoom={18}
        maxZoom={22}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png"
          maxZoom={22}
          maxNativeZoom={20}
        />

        <GeoJSON
          data={t3GeoJson}
          style={{ color: '#d63384', weight: 3, fillOpacity: 0.18 }}
          onEachFeature={(feature, layer) => {
            layer.on('click', () => onEnterTerminal())
          }}
        />
      </MapContainer>
    </section>
  )
}

export default AirportOverviewMap
```

---

### 3.4 terminalT3GeoJson.js

```js
const t3GeoJson = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {},
      geometry: {
        type: "Polygon",
        coordinates: [[
          [106.6513371, 10.8110775],
          [106.6512363, 10.8113566],
          [106.6562175, 10.8132204],
          [106.6563252, 10.8129324],
          [106.6551139, 10.8124005],
          [106.6552074, 10.8121366],
          [106.6527862, 10.8112056],
          [106.652646,  10.8115576],
          [106.6517196, 10.8112121],
          [106.6513371, 10.8110775],
        ]]
      }
    }
  ]
}

export default t3GeoJson
```

---

## Tóm tắt thứ tự học

| Bước | Học gì | Dùng để làm gì |
|------|--------|----------------|
| 1 | `useState` | Nhớ đang xem màn nào |
| 2 | Render có điều kiện | Chuyển giữa 2 màn hình |
| 3 | Props + callback | Nút "Vào T3" và "Quay lại" |
| 4 | `eventHandlers` trên Polygon | Click vào vùng T3 |
| 5 | `<GeoJSON />` | Thay polygon hard-code bằng data sạch |
| 6 | Tách component | Code gọn, dễ bảo trì |
