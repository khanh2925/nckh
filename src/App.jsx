import { divIcon, point } from "leaflet";
import "./App.css";
import "leaflet/dist/leaflet.css";
import { MapContainer, Marker, Polygon, Popup, TileLayer } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";

const TERMINAL_T3_POLYGONS = [
  [
    [10.8110775, 106.6513371],
    [10.8113566, 106.6512363],
    [10.8132204, 106.6562175],
    [10.8129324, 106.6563252],
    [10.8124005, 106.6551139],
    [10.8121366, 106.6552074],
    [10.8112056, 106.6527862],
    [10.8115576, 106.652646],
    [10.8112121, 106.6517196],
    [10.8110775, 106.6513371],
  ],
];

function App() {
  const customIcon = divIcon({
    html: '<span class="station-marker__label">T3</span>',
    iconSize: point(36, 24, true),
    iconAnchor: [18, 12],
    popupAnchor: [0, -12],
    className: "station-marker",
  });

  const markers = [
    {
      geocode: [10.8119, 106.6532],
      popUp: "Nhà ga T3 - Sân bay Tân Sơn Nhất",
    },
  ];

  const createCustomClusterIcon = (cluster) => {
    return divIcon({
      html: `<div class="cluster-icon">${cluster.getChildCount()}</div>`,
      iconSize: point(33, 33, true),
      className: "custom-marker-cluster",
    });
  };

  return (
    <main className="app-shell">
      <section className="map-shell">
        <div className="map-header">
          <div>
            <p className="eyebrow">Bản đồ định vị</p>
            <h1>Nhà ga T3</h1>
          </div>

          <p className="map-status">Sân bay Tân Sơn Nhất</p>
        </div>

        <MapContainer
          center={[10.8120, 106.6538]}
          zoom={18}
          maxZoom={22}
          zoomControl={false}
          scrollWheelZoom
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png"
            maxZoom={22}
            maxNativeZoom={20}
          />

          {TERMINAL_T3_POLYGONS.map((polygon, index) => (
            <Polygon
              key={`terminal-t3-polygon-${index}`}
              positions={polygon}
              pathOptions={{
                color: "#d63384",
                opacity: 0.9,
                weight: 3,
                fillColor: "#d63384",
                fillOpacity: 0.18,
              }}
            >
              <Popup>
                <h2>Nhà ga T3</h2>
                <p>Khu vực đang được làm nổi bật trên bản đồ.</p>
              </Popup>
            </Polygon>
          ))}

          <MarkerClusterGroup
            chunkedLoading
            iconCreateFunction={createCustomClusterIcon}
          >
            {markers.map((marker, index) => (
              <Marker key={index} position={marker.geocode} icon={customIcon}>
                <Popup>
                  <h2>{marker.popUp}</h2>
                </Popup>
              </Marker>
            ))}
          </MarkerClusterGroup>
        </MapContainer>
      </section>
    </main>
  );
}

export default App;
