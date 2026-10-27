import type {
    BuildingDto, FacilityDto, FloorDto, ImportResultDto, LocationDto, LocationTypeDto, LoginResponse, PlanDto, UserDto, UserStatus,
    VenueDto, VenueStatus, WalkwayNetworkDto, ZoneDto
} from "@indoor-map/core";
import { del, get, post, put } from "./http";

// Các API của Back-End v2 mà Builder và Admin dùng (xem docs/knowledge/KI-08_PLATFORM_V2_API.md)

export const authApi = {
    login: (email: string, password: string) => post<LoginResponse>("/api/auth/login", { email, password }),
    register: (email: string, password: string, fullName: string) => post<UserDto>("/api/auth/register", { email, password, fullName }),
    me: () => get<UserDto>("/api/auth/me"),
    updateProfile: (fullName: string) => put<UserDto>("/api/auth/me", { fullName }),
    changePassword: (currentPassword: string, newPassword: string) => put<void>("/api/auth/me/password", { currentPassword, newPassword })
};

export const venueApi = {
    mine: () => get<VenueDto[]>("/api/my/venues"),
    create: (dto: Partial<VenueDto>) => post<VenueDto>("/api/venues", dto),
    update: (id: number, dto: Partial<VenueDto>) => put<VenueDto>(`/api/venues/${id}`, dto),
    remove: (id: number) => del(`/api/venues/${id}`),
    publish: (id: number) => post<VenueDto>(`/api/venues/${id}/publish`),
    unpublish: (id: number) => post<VenueDto>(`/api/venues/${id}/unpublish`)
};

const v = (venueId: number) => `/api/venues/${venueId}`;

export const planApi = {
    buildings: (venueId: number) => get<BuildingDto[]>(`${v(venueId)}/buildings`),
    createBuilding: (venueId: number, dto: Partial<BuildingDto>) => post<BuildingDto>(`${v(venueId)}/buildings`, dto),
    updateBuilding: (venueId: number, id: number, dto: Partial<BuildingDto>) => put<BuildingDto>(`${v(venueId)}/buildings/${id}`, dto),
    removeBuilding: (venueId: number, id: number) => del(`${v(venueId)}/buildings/${id}`),
    floors: (venueId: number) => get<FloorDto[]>(`${v(venueId)}/floors`),
    createFloor: (venueId: number, dto: Partial<FloorDto>) => post<FloorDto>(`${v(venueId)}/floors`, dto),
    updateFloor: (venueId: number, id: number, dto: Partial<FloorDto>) => put<FloorDto>(`${v(venueId)}/floors/${id}`, dto),
    setPlan: (venueId: number, id: number, plan: PlanDto | null) => put<FloorDto>(`${v(venueId)}/floors/${id}/plan`, plan),
    removeFloor: (venueId: number, id: number) => del(`${v(venueId)}/floors/${id}`),
    zones: (venueId: number) => get<ZoneDto[]>(`${v(venueId)}/zones`),
    createZone: (venueId: number, dto: Partial<ZoneDto>) => post<ZoneDto>(`${v(venueId)}/zones`, dto),
    updateZone: (venueId: number, id: number, dto: Partial<ZoneDto>) => put<ZoneDto>(`${v(venueId)}/zones/${id}`, dto),
    removeZone: (venueId: number, id: number) => del(`${v(venueId)}/zones/${id}`)
};

export const catalogApi = {
    types: (venueId: number) => get<LocationTypeDto[]>(`${v(venueId)}/types`),
    createType: (venueId: number, dto: Partial<LocationTypeDto>) => post<LocationTypeDto>(`${v(venueId)}/types`, dto),
    updateType: (venueId: number, id: number, dto: Partial<LocationTypeDto>) => put<LocationTypeDto>(`${v(venueId)}/types/${id}`, dto),
    removeType: (venueId: number, id: number) => del(`${v(venueId)}/types/${id}`),
    copyTemplates: (venueId: number) => post<LocationTypeDto[]>(`${v(venueId)}/types/from-templates`),
    facilities: (venueId: number) => get<FacilityDto[]>(`${v(venueId)}/facilities`),
    createFacility: (venueId: number, name: string) => post<FacilityDto>(`${v(venueId)}/facilities`, { name }),
    updateFacility: (venueId: number, id: number, name: string) => put<FacilityDto>(`${v(venueId)}/facilities/${id}`, { id, name }),
    removeFacility: (venueId: number, id: number) => del(`${v(venueId)}/facilities/${id}`)
};

export const locationApi = {
    list: (venueId: number) => get<LocationDto[]>(`${v(venueId)}/locations`),
    create: (venueId: number, dto: Partial<LocationDto>) => post<LocationDto>(`${v(venueId)}/locations`, dto),
    update: (venueId: number, id: number, dto: Partial<LocationDto>) => put<LocationDto>(`${v(venueId)}/locations/${id}`, dto),
    remove: (venueId: number, id: number) => del(`${v(venueId)}/locations/${id}`),
    importMany: (venueId: number, items: Partial<LocationDto>[]) => post<ImportResultDto>(`${v(venueId)}/locations/import`, items)
};

export const walkwayApi = {
    get: (venueId: number) => get<WalkwayNetworkDto>(`${v(venueId)}/walkways`),
    replace: (venueId: number, network: WalkwayNetworkDto) => put<WalkwayNetworkDto>(`${v(venueId)}/walkways`, network)
};

export const adminApi = {
    users: (status?: UserStatus) => get<UserDto[]>(`/api/admin/users${status ? `?status=${status}` : ""}`),
    setUserStatus: (id: number, status: UserStatus) => put<UserDto>(`/api/admin/users/${id}/status`, { status }),
    venues: () => get<VenueDto[]>("/api/admin/venues"),
    setVenueStatus: (id: number, status: VenueStatus) => put<VenueDto>(`/api/admin/venues/${id}/status`, { status }),
    setVenueOwner: (id: number, ownerId: number) => put<VenueDto>(`/api/admin/venues/${id}/owner`, { ownerId }),
    templates: () => get<LocationTypeDto[]>("/api/admin/type-templates"),
    createTemplate: (dto: Partial<LocationTypeDto>) => post<LocationTypeDto>("/api/admin/type-templates", dto),
    updateTemplate: (id: number, dto: Partial<LocationTypeDto>) => put<LocationTypeDto>(`/api/admin/type-templates/${id}`, dto),
    removeTemplate: (id: number) => del(`/api/admin/type-templates/${id}`)
};
