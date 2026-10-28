import { createContext, Fragment, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { NavLink, Outlet, useLocation, useParams } from "react-router-dom";
import {
    buildVenueModel, type BuildingDto, type FacilityDto, type FloorDto, type LocationDto, type LocationTypeDto, type VenueDto, type VenueModel,
    type WalkwayNetworkDto, type ZoneDto
} from "@indoor-map/core";
import { adminApi, catalogApi, locationApi, planApi, venueApi, walkwayApi } from "../console/api";
import { useAuth } from "../console/auth";
import { ConsoleFrame, GlobalSidebar, SideGroup, SideItem, SideSep, Sidebar, StepMark } from "../console/Shell";
import { Button, ErrorNote, Spinner } from "../console/ui";
import Lc, { type LucideName } from "../design/Lc";

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
        return (
            <ConsoleFrame crumbs={[{ label: "Địa điểm của tôi", to: "/builder" }, { label: "Không mở được địa điểm" }]} nav={<GlobalSidebar />}>
                <div className="k-page"><ErrorNote error={error} onRetry={() => setAttempt(a => a + 1)} /><div><Button to="/builder" icon="arrow-left">Về Địa điểm của tôi</Button></div></div>
            </ConsoleFrame>
        );
    }
    if (!data || !model) return <ConsoleFrame crumbs={[{ label: "Địa điểm của tôi", to: "/builder" }, { label: "Đang mở…" }]} nav={<GlobalSidebar />}><Spinner label="Đang tải dữ liệu địa điểm…" /></ConsoleFrame>;
    return <WorkspaceContext.Provider value={{ venueId, data, model, reload, patch }}>{children}</WorkspaceContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWorkspace(): WorkspaceState {
    const value = useContext(WorkspaceContext);
    if (!value) throw new Error("useWorkspace() phải nằm trong <WorkspaceProvider>");
    return value;
}

// Thứ tự dựng bản đồ (sidebar "Dựng bản đồ") và công cụ phụ, giống bản thiết kế
const STEPS: [string, string, (d: WorkspaceData) => boolean][] = [
    ["buildings", "Toà nhà và tầng", d => d.floors.length > 0],
    ["plan", "Mặt bằng", d => d.floors.length > 0 && d.floors.every(f => !!f.plan)],
    ["editor", "Điểm và vùng", d => d.locations.length > 0],
    ["walkways", "Lối đi", d => d.walkways.nodes.length > 1],
    ["test", "Thử chỉ đường", () => false],
    ["publish", "Xuất bản", d => d.venue.status === "PUBLISHED"]
];
const TOOLS: [string, string, LucideName, string?][] = [
    ["journeys", "Quy trình", "workflow"], ["qr", "Mã QR định vị", "qr-code"], ["types", "Loại và tiện ích", "list"],
    ["landmarks", "Mốc camera", "camera", "GĐ 2"], ["settings", "Cài đặt địa điểm", "settings"]
];
const SHORT: Record<string, string> = {
    buildings: "Toà nhà", plan: "Mặt bằng", editor: "Điểm", walkways: "Lối đi", test: "Thử", publish: "Xuất bản",
    journeys: "Quy trình", qr: "Mã QR", types: "Loại", landmarks: "Mốc", settings: "Cài đặt"
};
const LABEL: Record<string, string> = {
    ...Object.fromEntries([...STEPS, ...TOOLS].map(([path, label]) => [path, label])),
    import: "Nhập từ CSV, GeoJSON", diff: "Khác biệt bản nháp", "qr-print": "In tem mã QR"
};
/** Màn biên tập canvas: sidebar thu gọn thành rail để canvas rộng */
const RAIL = new Set(["editor", "walkways", "journeys"]);

function WorkspaceSidebar({ base, data }: { base: string; data: WorkspaceData }) {
    return (
        <Sidebar label="Các bước dựng bản đồ">
            <SideGroup>Dựng bản đồ</SideGroup>
            {STEPS.map(([path, label, done], i) => (
                <Fragment key={path}>
                    <SideItem to={`${base}/${path}`} mark={<StepMark n={i + 1} done={done(data)} />} label={label} />
                    {path === "editor" && <SideItem sub to={`${base}/import`} label="Nhập từ CSV, GeoJSON" />}
                </Fragment>
            ))}
            <SideSep />
            <SideGroup>Công cụ</SideGroup>
            {TOOLS.map(([path, label, icon, badge]) => <SideItem key={path} to={`${base}/${path}`} icon={icon} label={label} count={badge} />)}
        </Sidebar>
    );
}

function WorkspaceRail({ base, data }: { base: string; data: WorkspaceData }) {
    return (
        <nav className="cs-rail" aria-label="Các bước dựng bản đồ (thu gọn)">
            {STEPS.map(([path, label, done], i) => (
                <NavLink key={path} to={`${base}/${path}`} title={label}><StepMark n={i + 1} done={done(data)} />{SHORT[path]}</NavLink>
            ))}
            <div className="cs-sep" role="separator" />
            {TOOLS.map(([path, label, icon]) => <NavLink key={path} to={`${base}/${path}`} title={label}><Lc name={icon} />{SHORT[path]}</NavLink>)}
        </nav>
    );
}

function PublishChip({ status }: { status?: string }) {
    if (status === "PUBLISHED") return <span className="cs-chip"><Lc name="circle-check" size={15} />Đang công khai</span>;
    if (status === "HIDDEN") return <span className="cs-chip"><Lc name="eye-off" size={15} />Bị ẩn</span>;
    return <span className="cs-chip" style={{ color: "var(--hud-muted)" }}>Bản nháp, chưa công khai</span>;
}

function WorkspaceFrame() {
    const { data, venueId } = useWorkspace();
    const { pathname } = useLocation();
    const base = `/builder/v/${venueId}`;
    const page = pathname.slice(base.length + 1).split("/")[0] ?? "";
    const rail = RAIL.has(page);
    return (
        <ConsoleFrame
            crumbs={[{ label: data.venue.name, to: `${base}/buildings` }, { label: LABEL[page] ?? "Dựng bản đồ" }]}
            chip={<PublishChip status={data.venue.status} />}
            nav={rail ? <WorkspaceRail base={base} data={data} /> : <WorkspaceSidebar base={base} data={data} />}
            full={rail || page === "plan" || page === "test"}>
            <Outlet />
        </ConsoleFrame>
    );
}

export function WorkspaceLayout() {
    return (
        <WorkspaceProvider>
            <WorkspaceFrame />
        </WorkspaceProvider>
    );
}
