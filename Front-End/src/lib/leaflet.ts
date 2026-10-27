import * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";

// "leaflet-rotate" là plugin kiểu cũ: nó đọc và vá biến TOÀN CỤC "L". Module ES không tạo biến toàn cục,
// nên tạo ở đây. Phải import tệp này TRƯỚC "leaflet-rotate".
const L = { ...Leaflet } as typeof Leaflet;
(window as unknown as { L: typeof Leaflet }).L = L;

// Leaflet hẹn giờ 250 ms để kết thúc hiệu ứng zoom. Nếu bản đồ bị gỡ (chuyển trang) trước khi hẹn giờ chạy,
// hàm cũ đọc pane đã xoá và báo lỗi "_leaflet_pos". Bỏ qua khi bản đồ đã bị gỡ.
type ZoomEndProto = { _onZoomTransitionEnd: (this: { _mapPane?: unknown }, ...args: unknown[]) => unknown };
const proto = Leaflet.Map.prototype as unknown as ZoomEndProto;
const onZoomEnd = proto._onZoomTransitionEnd;
proto._onZoomTransitionEnd = function (...args: unknown[]) {
    if (!this._mapPane) return undefined;
    return onZoomEnd.apply(this, args);
};

export default L;
