import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { NavLink, Outlet, useParams } from "react-router-dom";
import {
    buildVenueModel, type BuildingDto, type FacilityDto, type FloorDto, type LocationDto, type LocationTypeDto, type VenueDto, type VenueModel,
    type WalkwayNetworkDto, type ZoneDto
} from "@indoor-map/core";
import { adminApi, catalogApi, locationApi, planApi, venueApi, walkwayApi } from "../console/api";
import { useAuth } from "../console/auth";
import { Button, ErrorNote, Spinner, Status } from "../console/ui";

// Dữ liệu một địa điểm đang biên tập (bản nháp, chưa cần xuất bản). Mọi tab của trình biên tập dùng chung.
export interface WorkspaceData {
    venue: VenueDto;
    buildings: BuildingDto[];
    floors: FloorDto[];
    zones: ZoneDto[];
    types: LocationTypeDto[];
    facilities: FacilityDto[];
    locations: LocationDto[];
    walkways: WalkwayNetworkDto;
}
type Part = keyof WorkspaceData;

interface WorkspaceState {
    venueId: number;
    data: WorkspaceData;
    /** Mô hình giống Viewer (có phép chiếu, lat/lng) dựng từ bản nháp */
    model: VenueModel;
    reload(...parts: Part[]): Promise<void>;
    patch<K extends Part>(part: K, value: WorkspaceData[K]): void;
}

const WorkspaceContext = createContext<WorkspaceState | null>(null);

async function loadPart(venueId: number, part: Part, isSystemAdmin: boolean): Promise<unknown> {
    switch (part) {
        case "venue": {
            const list = isSystemAdmin ? await adminApi.venues() : await venueApi.mine();
            const venue = list.find(v => v.id === venueId);
            if (!venue) throw new Error("Không tìm thấy địa điểm, hoặc bạn không phải chủ sở hữu.");
            return venue;
        }
        case "buildings": return planApi.buildings(venueId);
        case "floors": return planApi.floors(venueId);
        case "zones": return planApi.zones(venueId);
        case "types": return catalogApi.types(venueId);
        case "facilities": return catalogApi.facilities(venueId);
        case "locations": return locationApi.list(venueId);
        case "walkways": return walkwayApi.get(venueId);
    }
}

const ALL: Part[] = ["venue", "buildings", "floors", "zones", "types", "facilities", "locations", "walkways"];

export function WorkspaceProvider({ children }: { children: ReactNode }) {
    const { venueId: raw } = useParams();
    const venueId = Number(raw);
    const { user } = useAuth();
    const isSystemAdmin = user?.role === "SYSTEM_ADMIN";
    const [data, setData] = useState<WorkspaceData | null>(null);
    const [error, setError] = useState<Error | null>(null);
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        let alive = true;
        Promise.all(ALL.map(part => loadPart(venueId, part, isSystemAdmin)))
            .then(values => {
                if (!alive) return;
                setError(null);
                setData(Object.fromEntries(ALL.map((part, i) => [part, values[i]])) as unknown as WorkspaceData);
            })
            .catch((err: Error) => alive && setError(err));
        return () => {
            alive = false;
        };
    }, [venueId, isSystemAdmin, attempt]);

    const reload = useCallback(async (...parts: Part[]) => {
        const list = parts.length ? parts : ALL;
        const values = await Promise.all(list.map(part => loadPart(venueId, part, isSystemAdmin)));
        setData(current => current && { ...current, ...Object.fromEntries(list.map((part, i) => [part, values[i]])) });
    }, [venueId, isSystemAdmin]);

    const patch = useCallback(<K extends Part>(part: K, value: WorkspaceData[K]) => {
        setData(current => current && { ...current, [part]: value });
    }, []);

    const model = useMemo(() => (data ? buildVenueModel({ ...data, venue: data.venue }) : null), [data]);

    if (error) {
        return <div className="cb-main"><ErrorNote error={error} onRetry={() => setAttempt(a => a + 1)} /><Button to="/builder">← Về danh sách địa điểm</Button></div>;
    }
    if (!data || !model) return <Spinner label="Đang tải dữ liệu địa điểm…" />;
    return <WorkspaceContext.Provider value={{ venueId, data, model, reload, patch }}>{children}</WorkspaceContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWorkspace(): WorkspaceState {
    const value = useContext(WorkspaceContext);
    if (!value) throw new Error("useWorkspace() phải nằm trong <WorkspaceProvider>");
    return value;
}

const TABS: [string, string][] = [
    ["plan", "Mặt bằng"], ["buildings", "Toà nhà & tầng"], ["editor", "Điểm & vùng"], ["walkways", "Lối đi"], ["types", "Loại & tiện ích"],
    ["qr", "Mã QR"], ["landmarks", "Mốc camera"], ["test", "Thử chỉ đường"], ["publish", "Xuất bản"]
];

function Workbar() {
    const { data, venueId } = useWorkspace();
    const status = data.venue.status;
    return (
        <header className="cb-workbar">
            <NavLink to="/builder" className="cb-back">← Địa điểm</NavLink>
            <span className="cb-venue-name" title={data.venue.name}>{data.venue.name}</span>
            {status === "PUBLISHED" ? <Status kind="ok">Đã xuất bản</Status> : status === "HIDDEN" ? <Status kind="err">Bị ẩn</Status> : <Status kind="mut">Bản nháp</Status>}
            <nav className="cb-tabs" aria-label="Các bước dựng bản đồ">
                {TABS.map(([path, label]) => <NavLink key={path} to={`/builder/v/${venueId}/${path}`}>{label}</NavLink>)}
            </nav>
        </header>
    );
}

export function WorkspaceLayout() {
    return (
        <WorkspaceProvider>
            <Workbar />
            <Outlet />
        </WorkspaceProvider>
    );
}
