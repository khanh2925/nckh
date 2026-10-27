// Kiểu dữ liệu của API v2 (khớp các DTO Java trong Back-End/src/main/java/vn/edu/indoormap/dto).

export type VenueKind = "airport" | "hospital" | "school" | "mall" | "park" | "office" | "other";
export type VenueStatus = "DRAFT" | "PUBLISHED" | "HIDDEN";

export interface LatLng {
    lat: number;
    lng: number;
}

/** Điểm nằm trên một tầng cụ thể */
export interface FloorPoint extends LatLng {
    floorId: number;
}

export interface VenueDto {
    id: number;
    slug: string;
    name: string;
    kind?: VenueKind | string;
    description?: string;
    centerLat?: number;
    centerLng?: number;
    /** [[lat, lng], ...] */
    outline?: [number, number][];
    status?: VenueStatus;
    ownerId?: number;
    ownerName?: string;
    updatedAt?: string;
    buildingCount?: number;
    floorCount?: number;
    locationCount?: number;
}

export interface BuildingDto {
    id: number;
    venueId?: number;
    code: string;
    name: string;
    centerLat?: number;
    centerLng?: number;
    outline?: [number, number][];
    sortOrder?: number;
}

/** image = [x, y] pixel trên bản vẽ; latlng = [lat, lng] thực tế */
export interface ControlPoint {
    image: [number, number];
    latlng: [number, number];
}

export interface PlanDto {
    svg?: string;
    imageUrl?: string;
    width?: number;
    height?: number;
    anchor?: ControlPoint;
    end?: ControlPoint;
    depthScale?: number;
}

export interface FloorDto {
    id: number;
    buildingId: number;
    buildingCode?: string;
    level: number;
    name: string;
    plan?: PlanDto;
}

export interface ZoneDto {
    id: number;
    floorId: number;
    name: string;
    color?: string;
    /** [[x, y], ...] pixel trên bản vẽ */
    polygon: [number, number][];
    sortOrder?: number;
}

export interface LocationTypeDto {
    id?: number;
    code: string;
    name: string;
    /** Tên icon Bootstrap Icons, ví dụ "bi-cup-hot" */
    icon?: string;
    color?: string;
    groupName?: string;
    sortOrder?: number;
    kind?: string;
}

export interface FacilityDto {
    id: number;
    name: string;
}

export interface LocationDto {
    id: number;
    floorId: number;
    building?: string;
    floor?: number;
    name: string;
    type?: string;
    x?: number;
    y?: number;
    lat?: number;
    lng?: number;
    phone?: string;
    website?: string;
    area?: string;
    description?: string;
    openingHours?: string;
    imageUrl?: string;
    sourceId?: number;
    facilities?: string[];
}

export interface WalkwayNodeDto {
    id: string;
    floorId: number;
    building?: string;
    floor?: number;
    lat: number;
    lng: number;
    /** "Thang máy" | "Thang cuốn" | "Thang bộ" khi đổi tầng tại nút này */
    connector?: string;
}

export interface WalkwayEdgeDto {
    from: string;
    to: string;
}

export interface WalkwayNetworkDto {
    nodes: WalkwayNodeDto[];
    edges: WalkwayEdgeDto[];
}

/** GET /api/venues/{slug}/map */
export interface VenueMapDto {
    venue: VenueDto;
    buildings: BuildingDto[];
    floors: FloorDto[];
    zones: ZoneDto[];
    types: LocationTypeDto[];
    facilities: FacilityDto[];
    locations: LocationDto[];
    walkways: WalkwayNetworkDto;
}
