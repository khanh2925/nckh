// leaflet-rotate không có kiểu TypeScript: khai báo phần đang dùng
import "leaflet";

declare module "leaflet" {
    interface MapOptions {
        rotate?: boolean;
        bearing?: number;
        touchRotate?: boolean;
        rotateControl?: boolean;
        shiftKeyRotate?: boolean;
    }
    interface Map {
        setBearing(degrees: number): this;
        getBearing(): number;
    }
}
