(function () {
  'use strict';

  const DEFAULT_BEARING = 85;
  const DETAIL_ZOOM = 17.4;
  const OVERVIEW_CENTER = [10.8133, 106.6574];
  const T1_CENTER = [10.81375, 106.66205];
  const IMAGE_SIZE = { width: 1598, height: 682 };
  const ANCHOR = { image: [163, 192], latlng: [10.8126984, 106.6615654] };
  const END = { image: [1177, 192], latlng: [10.8148356, 106.6617537] };
  const DEPTH_SCALE = 0.61;

  const terminalT1 = [
    [10.8148241,106.6618890],[10.8152286,106.6619245],[10.8152117,106.6620597],
    [10.8151771,106.6625317],[10.8147735,106.6624961],[10.8147697,106.6625408],
    [10.8146907,106.6625339],[10.8146839,106.6626143],[10.8129481,106.6624618],
    [10.8129551,106.6623797],[10.8125658,106.6623455],[10.8126189,106.6617191],
    [10.8126849,106.6617249],[10.8126984,106.6615654],[10.8127813,106.6615727],
    [10.8128227,106.6615763],[10.8131822,106.6616080],[10.8134428,106.6616310],
    [10.8141349,106.6616920],[10.8148176,106.6617521],[10.8148356,106.6617537]
  ];
  const terminalT3 = [
    [10.8110775,106.6513371],[10.8113566,106.6512363],[10.8132204,106.6562175],
    [10.8129324,106.6563252],[10.8124005,106.6551139],[10.8121366,106.6552074],
    [10.8112056,106.6527862],[10.8115576,106.6526460],[10.8112121,106.6517196]
  ];

  const locations = [
    { id: 1, name: 'Cửa 01–02', type: 'gate', typeName: 'Cửa ra máy bay', x: 239, y: 168, floor: 1 },
    { id: 2, name: 'Cửa 09', type: 'gate', typeName: 'Cửa ra máy bay', x: 775, y: 168, floor: 1 },
    { id: 3, name: 'Cửa 15', type: 'gate', typeName: 'Cửa ra máy bay', x: 1203, y: 234, floor: 1 },
    { id: 4, name: 'WC khu A', type: 'restroom', typeName: 'Nhà vệ sinh', x: 405, y: 476, floor: 1 },
    { id: 5, name: 'Quầy thông tin', type: 'information', typeName: 'Thông tin sân bay', x: 317, y: 497, floor: 1 },
    { id: 6, name: 'Phòng chờ', type: 'lounge', typeName: 'Phòng chờ hành khách', x: 824, y: 325, floor: 1 },
    { id: 7, name: 'Thang máy tầng 2', type: 'elevator', typeName: 'Thang máy', x: 515, y: 355, floor: 2 },
    { id: 8, name: 'WC tầng 2', type: 'restroom', typeName: 'Nhà vệ sinh', x: 885, y: 355, floor: 2 },
    { id: 9, name: 'Phòng chờ tầng 2', type: 'lounge', typeName: 'Phòng chờ hành khách', x: 1040, y: 350, floor: 2 }
  ];

  const map = L.map('airport-map', {
    center: OVERVIEW_CENTER, zoom: 16.2, minZoom: 14, maxZoom: 22,
    zoomSnap: 0.1, zoomDelta: 0.5, zoomControl: false,
    scrollWheelZoom: true, rotate: true, bearing: DEFAULT_BEARING,
    rotateControl: false, touchRotate: true
  });

  L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png', {
    maxZoom: 22, maxNativeZoom: 20,
    attribution: '&copy; Stadia Maps &copy; OpenMapTiles &copy; OpenStreetMap'
  }).addTo(map);

  const overviewLayer = L.layerGroup().addTo(map);
  let floorOverlay = null;
  let markerLayer = L.layerGroup().addTo(map);
  let currentFloor = 1;

  const startWorld = L.CRS.EPSG3857.project(L.latLng(ANCHOR.latlng));
  const endWorld = L.CRS.EPSG3857.project(L.latLng(END.latlng));
  const span = END.image[0] - ANCHOR.image[0];
  const ux = (endWorld.x - startWorld.x) / span;
  const uy = (endWorld.y - startWorld.y) / span;

  function projectImage(x, y) {
    return {
      x: startWorld.x + (x - ANCHOR.image[0]) * ux + (y - ANCHOR.image[1]) * uy * DEPTH_SCALE,
      y: startWorld.y + (x - ANCHOR.image[0]) * uy - (y - ANCHOR.image[1]) * ux * DEPTH_SCALE
    };
  }

  const corners = [[0,0],[IMAGE_SIZE.width,0],[IMAGE_SIZE.width,IMAGE_SIZE.height],[0,IMAGE_SIZE.height]].map(p => projectImage(p[0], p[1]));
  const minX = Math.min(...corners.map(p => p.x));
  const maxX = Math.max(...corners.map(p => p.x));
  const minY = Math.min(...corners.map(p => p.y));
  const maxY = Math.max(...corners.map(p => p.y));
  const origin = projectImage(0, 0);
  const floorBounds = L.latLngBounds(
    L.CRS.EPSG3857.unproject(L.point(minX, minY)),
    L.CRS.EPSG3857.unproject(L.point(maxX, maxY))
  );
  const floorTransform = `matrix(${ux} ${-uy} ${uy * DEPTH_SCALE} ${ux * DEPTH_SCALE} ${origin.x - minX} ${maxY - origin.y})`;

  function imagePointToLatLng(x, y) {
    const point = projectImage(x, y);
    return L.CRS.EPSG3857.unproject(L.point(point.x, point.y));
  }

  function makeSvgElement(floor) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', `0 0 ${maxX - minX} ${maxY - minY}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('class', 'floor-plan-svg');
    const group = document.createElementNS(ns, 'g');
    group.setAttribute('transform', floorTransform);
    group.innerHTML = floor === 1 ? floorOneMarkup() : floorTwoMarkup();
    svg.appendChild(group);
    return svg;
  }

  function gate(x, y, name) {
    return `<g transform="translate(${x} ${y})"><circle class="gate" r="20"/><text y="3" fill="#fff" font-size="7">Cửa ${name}</text></g>`;
  }

  function floorOneMarkup() {
    const gates = [[239,168,'01–02'],[340,168,'03'],[408,168,'04'],[475,168,'05'],[540,168,'06'],[609,168,'07'],[686,168,'08'],[775,168,'09'],[860,168,'10'],[956,168,'12'],[1057,168,'13'],[1128,168,'14'],[1203,234,'15']].map(g => gate(...g)).join('');
    return `
      <g stroke="#cecece" stroke-width="2" stroke-linejoin="round">
        <polygon fill="#fff" points="70,192 231,192 231,96 246,96 246,192 533,192 533,96 547,96 547,192 853,192 853,96 868,96 868,192 1165,192 1165,96 1177,96 1177,259 1399,259 1399,488 1385,488 1385,522 1177,522 1177,569 1160,569 1160,592 353,592 353,570 163,570 163,272 70,272"/>
        <polygon fill="#d8dada" points="353,500 917,500 917,416 1048,416 1048,500 1177,500 1177,285 1399,285 1399,488 1385,488 1385,522 1177,522 1177,569 1160,569 1160,592 353,592"/>
        <polygon fill="#d8dada" points="373,361 441,361 441,374 599,374 599,303 651,303 651,422 373,422"/>
        <path fill="#cce2ef" d="M70 192h139v80H70zM163 294h58v106h-58zM353 304h246v57H353zM353 448h565v52H353zM1049 450h128v50h-128z"/>
        <path fill="#d6d3e9" d="M234 238h68v16h-68zM412 238h273v16H412zM789 292h76v68h-76zM761 384h105v42H761zM997 276h28v-27h72v49h50v126h-74V307h-48v-13h-28z"/>
        <path fill="#ece3e3" d="M259 322h49v34h-49zM652 304h103v49H652zM671 354h62v68h-62zM889 258h21v160h-21zM960 330h98v85h-98z"/>
        <path fill="#e3eadb" d="M164 260h45v34h-45zM353 378h20v44h-20zM690 316h33v37h-33zM1025 398h22v38h-22z"/>
        <path fill="#e0a084" d="M282 436h49v-14h22v148h-71z"/>
        <path d="M209 194H1177M212 204H1177M239 96v98M540 96v98M860 96v98M1171 96v98" fill="none"/>
      </g>
      <g font-size="11" font-weight="700"><text x="575" y="337">KHU DỊCH VỤ</text><text x="705" y="401">SASCO SHOP</text><text x="1110" y="356">ORCHIDS GOLD</text><text x="715" y="474">TWIKE JOYS</text></g>
      ${gates}
    `;
  }

  function floorTwoMarkup() {
    return `
      <g stroke="#c9ced1" stroke-width="2" stroke-linejoin="round">
        <polygon fill="#fff" points="163,192 1177,192 1177,285 1280,285 1280,500 1177,500 1177,550 260,550 260,500 163,500"/>
        <rect x="260" y="300" width="820" height="160" fill="#edf0f1"/>
        <rect x="310" y="325" width="180" height="110" fill="#cce2ef"/>
        <rect x="515" y="325" width="190" height="110" fill="#d6d3e9"/>
        <rect x="730" y="325" width="160" height="110" fill="#ece3e3"/>
        <rect x="915" y="325" width="215" height="110" fill="#d6d3e9"/>
        <path d="M163 240h1014M260 460h917" fill="none"/>
      </g>
      <g font-weight="700"><text x="400" y="385">DỊCH VỤ</text><text x="610" y="385">PHÒNG CHỜ</text><text x="810" y="385">CỬA HÀNG</text><text x="1020" y="385">PHÒNG CHỜ</text></g>
      <text x="720" y="275" font-size="22" font-weight="700">TẦNG 2 · MẶT BẰNG MẪU</text>
    `;
  }

  function addOverview() {
    overviewLayer.clearLayers();
    const style = { color: '#bd2e39', weight: 2, fillColor: '#dc4f59', fillOpacity: 0.8 };
    const t1 = L.polygon(terminalT1, style).bindPopup('Ga Nội Địa T1. Phóng to để xem mặt bằng chi tiết.');
    t1.bindTooltip('✈ &nbsp; SGN · Ga Nội Địa T1', { permanent: true, direction: 'center', className: 'terminal-label' });
    const t3 = L.polygon(terminalT3, { ...style, fillOpacity: 0.68 }).bindPopup('Nhà ga T3 — khu vực từ project cũ.');
    t3.bindTooltip('✈ &nbsp; Ga T3', { permanent: true, direction: 'center', className: 'terminal-label' });
    overviewLayer.addLayer(t1).addLayer(t3);
  }

  function markerIcon(location) {
    const symbols = { gate: 'G', restroom: 'WC', information: 'i', lounge: 'L', elevator: '↕' };
    return L.divIcon({ className: '', html: `<span class="location-marker">${symbols[location.type] || '•'}</span>`, iconSize: [34,34], iconAnchor: [17,17] });
  }

  function clearMarkers() { markerLayer.clearLayers(); }

  function addLocationMarker(location) {
    const marker = L.marker(imagePointToLatLng(location.x, location.y), { icon: markerIcon(location) });
    marker.bindPopup(`<strong>${location.name}</strong><br>Loại: ${location.typeName}<br>Tầng: ${location.floor}`);
    marker.locationId = location.id;
    markerLayer.addLayer(marker);
    return marker;
  }

  function renderLocations(floorId) {
    clearMarkers();
    locations.filter(item => item.floor === floorId).forEach(addLocationMarker);
  }

  function loadFloor(floorId) {
    if (floorOverlay) map.removeLayer(floorOverlay);
    floorOverlay = L.svgOverlay(makeSvgElement(floorId), floorBounds, { interactive: false, opacity: 0.98 }).addTo(map);
    renderLocations(floorId);
  }

  function updateLayers() {
    const detailed = map.getZoom() >= DETAIL_ZOOM;
    if (detailed) {
      overviewLayer.removeFrom(map);
      if (!floorOverlay) loadFloor(currentFloor);
      if (!map.hasLayer(markerLayer)) markerLayer.addTo(map);
    } else {
      if (floorOverlay) { map.removeLayer(floorOverlay); floorOverlay = null; }
      clearMarkers();
      if (!map.hasLayer(overviewLayer)) overviewLayer.addTo(map);
    }
    document.getElementById('map-status').textContent = detailed
      ? `Mặt bằng chi tiết · Tầng ${currentFloor} · Phân vùng gần đúng, không dùng để chỉ đường thực tế`
      : 'Toàn cảnh sân bay · Phóng to Ga T1 để xem mặt bằng';
  }

  function changeFloor(floorId) {
    currentFloor = floorId;
    document.querySelectorAll('.floor-button').forEach(button => {
      button.classList.toggle('active', Number(button.dataset.floor) === floorId);
    });
    if (map.getZoom() < DETAIL_ZOOM) map.setView(T1_CENTER, 18.8, { animate: false });
    loadFloor(floorId);
    updateLayers();
  }

  function resetMap() {
    if (map.setBearing) map.setBearing(DEFAULT_BEARING);
    map.setView(T1_CENTER, 18.8, { animate: false });
  }

  function showLocation(location) {
    if (location.floor !== currentFloor) changeFloor(location.floor);
    if (map.setBearing) map.setBearing(DEFAULT_BEARING);
    map.setView(imagePointToLatLng(location.x, location.y), 20, { animate: true });
    setTimeout(() => {
      markerLayer.eachLayer(marker => { if (marker.locationId === location.id) marker.openPopup(); });
    }, 300);
    document.getElementById('search-results').hidden = true;
  }

  function searchLocation(keyword) {
    const query = keyword.trim().toLocaleLowerCase('vi');
    return query ? locations.filter(location => `${location.name} ${location.typeName}`.toLocaleLowerCase('vi').includes(query)) : [];
  }

  function renderSearch(keyword) {
    const panel = document.getElementById('search-results');
    const results = searchLocation(keyword);
    panel.replaceChildren();
    if (!keyword.trim()) { panel.hidden = true; return; }
    if (!results.length) {
      const empty = document.createElement('div'); empty.className = 'search-result'; empty.textContent = 'Không tìm thấy địa điểm'; panel.appendChild(empty);
    } else {
      results.forEach(location => {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'search-result';
        button.innerHTML = `${location.name}<small>${location.typeName} · Tầng ${location.floor}</small>`;
        button.addEventListener('click', () => showLocation(location)); panel.appendChild(button);
      });
    }
    panel.hidden = false;
  }

  addOverview();
  updateLayers();
  map.on('zoomend', updateLayers);
  document.querySelectorAll('.floor-button').forEach(button => button.addEventListener('click', () => changeFloor(Number(button.dataset.floor))));
  document.getElementById('location-search').addEventListener('input', event => renderSearch(event.target.value));
  document.getElementById('zoom-in').addEventListener('click', () => map.zoomIn());
  document.getElementById('zoom-out').addEventListener('click', () => map.zoomOut());
  document.getElementById('reset-bearing').addEventListener('click', () => map.setBearing && map.setBearing(DEFAULT_BEARING));
  document.getElementById('airport-overview').addEventListener('click', () => {
    if (map.setBearing) map.setBearing(DEFAULT_BEARING);
    map.setView(OVERVIEW_CENTER, 16.2, { animate: false });
  });
  document.getElementById('go-t1').addEventListener('click', resetMap);
  window.addEventListener('resize', () => map.invalidateSize());
}());
