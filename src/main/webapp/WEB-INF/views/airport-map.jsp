<%@ page contentType="text/html;charset=UTF-8" language="java" %>
<!doctype html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Ga T1 · Bản đồ mặt bằng</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
  <link rel="stylesheet" href="${pageContext.request.contextPath}/css/airport-map.css">
</head>
<body data-context-path="${pageContext.request.contextPath}">
<main class="app-shell">
  <header class="topbar">
    <div class="identity">
      <span class="terminal-badge">T1</span>
      <div><h1>Ga nội địa Tân Sơn Nhất</h1><p>Bản đồ mặt bằng · Prototype Jakarta EE</p></div>
    </div>
    <nav class="floor-tabs" aria-label="Chọn tầng">
      <button type="button" class="floor-button active" data-floor="1">Tầng 1</button>
      <button type="button" class="floor-button" data-floor="2">Tầng 2</button>
    </nav>
  </header>

  <section class="map-shell" aria-label="Bản đồ nhà ga T1">
    <div class="search-panel">
      <label for="location-search" class="sr-only">Tìm địa điểm</label>
      <input id="location-search" type="search" placeholder="Tìm Gate, WC, quầy thông tin…" autocomplete="off">
      <div id="search-results" class="search-results" hidden></div>
    </div>
    <div id="airport-map"></div>
    <div class="map-controls" aria-label="Điều khiển bản đồ">
      <button type="button" id="zoom-in" aria-label="Phóng to">+</button>
      <button type="button" id="zoom-out" aria-label="Thu nhỏ">−</button>
      <button type="button" id="reset-bearing" aria-label="Đặt lại hướng">↻</button>
      <button type="button" id="airport-overview" aria-label="Xem toàn sân bay">⌂</button>
      <button type="button" id="go-t1" aria-label="Về ga T1">T1</button>
    </div>
    <div class="legend" aria-label="Chú giải">
      <span><i class="room"></i>Khu dịch vụ</span><span><i class="lounge"></i>Phòng chờ</span>
      <span><i class="shop"></i>Cửa hàng</span><span><i class="security"></i>Khu kiểm soát</span>
    </div>
    <p id="map-status" class="map-footnote">Toàn cảnh sân bay · Phóng to Ga T1 để xem mặt bằng</p>
  </section>
</main>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="https://unpkg.com/leaflet-rotate@0.2.8/dist/leaflet-rotate-src.js"></script>
<script src="${pageContext.request.contextPath}/js/airport-map.js"></script>
</body>
</html>
