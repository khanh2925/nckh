# Dự án bản đồ nhà ga T3 sân bay

## 1. Mục tiêu dự án

Dự án này nhằm xây dựng một bản đồ tương tác cho khu vực nhà ga T3 sân bay.

Ý tưởng ban đầu là làm một hệ thống tương tự bản đồ sàn số của AEON Mall, nhưng thay vì dùng dịch vụ bên ngoài, dự án sẽ tự xây dựng bản MVP bằng React.

Mục tiêu hiện tại:

```text
Hiển thị bản đồ ngoài trời
→ định vị khu vực sân bay / nhà ga T3
→ tô nổi bật vùng nhà ga T3
→ click vào T3
→ mở bản đồ chi tiết bên trong nhà ga
2. Công nghệ sử dụng

Hiện tại dự án đang dùng:

React
React Leaflet
Leaflet
OpenStreetMap / CARTO TileLayer
GeoJSON

Các thư viện chính:

react-leaflet
leaflet
react-leaflet-cluster
3. Những phần đã làm được

Dự án hiện tại đã làm được các phần sau:

Hiển thị bản đồ nền
Định vị bản đồ về TP.HCM / sân bay Tân Sơn Nhất
Hiển thị marker cho nhà ga T3
Dùng MarkerClusterGroup
Thay đổi style bản đồ nền
Zoom bản đồ
Thử vẽ Rectangle / Polygon
Tạo GeoJSON từ geojson.io
4. Các vấn đề đã gặp
4.1. Map nền nhìn chưa đẹp

Ban đầu dùng OpenStreetMap mặc định nhưng giao diện khá thô.

Sau đó thử CARTO light nhưng bị trắng bệt, mất chi tiết.

Hướng xử lý hiện tại:

Dùng CARTO Voyager hoặc OpenStreetMap với CSS filter nhẹ
Ưu tiên bản đồ dễ nhìn, hài hòa, đủ đẹp để demo
Không cần giống AEON 100% ở giai đoạn đầu
4.2. Rectangle không phù hợp để phủ nhà ga T3

Ban đầu thử dùng Rectangle để khoanh vùng nhà ga T3.

Nhưng nhà ga T3 có hình nghiêng và dài, nên Rectangle không ôm đúng hình.

Kết luận:

Không dùng Rectangle để phủ T3
4.3. Vẽ Polygon trực tiếp trong React không ổn

Đã thử làm công cụ:

Click từng điểm trên map
Kéo từng chấm
Thêm điểm
Xóa điểm
Di chuyển vùng

Nhưng cách này không hiệu quả vì:

Zoom chưa đủ sát
Map nền không rõ
Bấm điểm dễ lệch
Kéo chấm khó chỉnh
Tốn thời gian
Shape không ôm đúng nhà ga

Kết luận:

Không nên tự làm tool vẽ polygon trong React ở giai đoạn này
5. Hướng xử lý đã chọn

Hướng tốt hơn là dùng GeoJSON.

Quy trình:

Dùng geojson.io
→ vẽ vùng nhà ga T3 bên ngoài
→ export GeoJSON
→ đưa GeoJSON vào React
→ render bằng <GeoJSON />

Lý do chọn GeoJSON:

Dễ quản lý dữ liệu bản đồ
Dễ sửa vùng T3
Không cần tự code tool vẽ phức tạp
React chỉ cần hiển thị dữ liệu
6. Vai trò của GeoJSON trong dự án

GeoJSON dùng để đánh dấu chính xác khu vực nhà ga T3 trên bản đồ ngoài trời.

Nó dùng cho các việc:

Tô màu vùng nhà ga T3
Định danh khu vực T3
Cho phép người dùng click vào vùng T3
Làm bước chuyển sang bản đồ chi tiết bên trong nhà ga

GeoJSON không dùng để làm bản đồ chi tiết bên trong nhà ga.

7. Kiến trúc dự án đề xuất

Kiến trúc nên chia thành 2 phần rõ ràng:

Bản đồ ngoài trời
→ React Leaflet
→ TileLayer
→ GeoJSON vùng T3
→ Marker / Popup

Bản đồ bên trong T3
→ SVG hoặc HTML block layout
→ Các khu vực như Check-in, Security, Gate, Toilet...

Không nên cố vẽ toàn bộ chi tiết nhà ga ngay trên Leaflet.

8. Flow người dùng

Flow MVP mong muốn:

Người dùng mở web
→ thấy bản đồ sân bay
→ thấy khu nhà ga T3 được tô màu
→ click vào vùng T3
→ chuyển sang bản đồ bên trong T3
→ click từng khu vực để xem thông tin
9. Cấu trúc thư mục đề xuất
src/
  components/
    AirportOverviewMap.jsx
    TerminalT3Map.jsx
    ZoneDetailPanel.jsx

  data/
    terminalT3GeoJson.js
    terminalT3Zones.js

  App.jsx
  App.css
10. Bước tiếp theo cần làm

Sau khi đã có GeoJSON vùng T3, các bước tiếp theo là:

1. Tạo file terminalT3GeoJson.js
2. Dán dữ liệu GeoJSON vào file đó
3. Render GeoJSON bằng <GeoJSON />
4. Xóa phần tool kéo điểm / thêm điểm cũ nếu không dùng nữa
5. Thêm sự kiện click vào vùng T3
6. Khi click T3 thì đổi view sang TerminalT3Map
7. Làm bản đồ bên trong T3 bằng hình chữ nhật hoặc SVG đơn giản
11. MVP cần đạt được

MVP hiện tại chỉ cần có:

Bản đồ ngoài trời
Vùng T3 được tô màu
Click vào T3
Màn bản đồ chi tiết bên trong T3
Các block cơ bản: Check-in, Security, Gate, Toilet, Thang máy
Click từng block hiện thông tin
Nút quay lại bản đồ ngoài trời
12. Những phần chưa cần làm vội

Các chức năng sau chưa cần làm ở giai đoạn đầu:

Chỉ đường
GPS trong nhà
Định vị realtime
Backend
Database
Admin quản lý
Bản đồ chi tiết từng phòng / từng gate thật
13. Kết luận hướng đi

Hướng đi hiện tại:

Leaflet dùng cho bản đồ ngoài trời.
GeoJSON dùng để khoanh vùng nhà ga T3.
SVG hoặc block layout dùng để làm bản đồ chi tiết bên trong nhà ga.