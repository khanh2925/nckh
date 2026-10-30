import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, Outlet, useLocation, useParams } from "react-router-dom";
import { ArrowLeft, Camera, ChevronsUpDown, ExternalLink, List, QrCode, Settings, Workflow, type LucideIcon } from "lucide-react";
import {
    buildVenueModel, type BuildingDto, type FacilityDto, type FloorDto, type LocationDto, type LocationTypeDto, type VenueDto, type VenueModel,
    type WalkwayNetworkDto, type ZoneDto
} from "@indoor-map/core";
import { adminApi, catalogApi, locationApi, planApi, venueApi, walkwayApi } from "../console/api";
import { useAuth } from "../console/auth";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { BrandMark, ConsoleFrame, GlobalNav, NavGroup, NavItem, StepMark } from "../console/Shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, Page } from "../console/page";

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
            <ConsoleFrame crumbs={[{ label: "Địa điểm của tôi", to: "/builder" }, { label: "Không mở được địa điểm" }]} nav={<GlobalNav />}>
                <Page actions={<Button asChild variant="outline"><Link to="/builder"><ArrowLeft />Về Địa điểm của tôi</Link></Button>}>
                    <ErrorState error={error} onRetry={() => setAttempt(a => a + 1)} />
                </Page>
            </ConsoleFrame>
        );
    }
    if (!data || !model) return (
        <ConsoleFrame crumbs={[{ label: "Địa điểm của tôi", to: "/builder" }, { label: "Đang mở…" }]} nav={<GlobalNav />}>
            <Page>
                <div className="grid grid-cols-4 gap-4" role="status" aria-label="Đang tải dữ liệu địa điểm">
                    {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
                </div>
                <Skeleton className="h-64 rounded-xl" />
            </Page>
        </ConsoleFrame>
    );
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
const TOOLS: [string, string, LucideIcon, string?][] = [
    ["journeys", "Quy trình", Workflow], ["qr", "Mã QR định vị", QrCode], ["types", "Loại và tiện ích", List],
    ["landmarks", "Mốc camera", Camera, "GĐ 2"], ["settings", "Cài đặt địa điểm", Settings]
];
const LABEL: Record<string, string> = {
    ...Object.fromEntries([...STEPS, ...TOOLS].map(([path, label]) => [path, label])),
    import: "Nhập từ CSV, GeoJSON", diff: "Khác biệt bản nháp", "qr-print": "In tem mã QR"
};
/** Màn biên tập trên bản đồ: thu sidebar về dạng icon để bản đồ rộng */
const WIDE = new Set(["editor", "walkways", "journeys", "plan", "test"]);

const STATUS_TEXT: Record<string, string> = { PUBLISHED: "Đang công khai", HIDDEN: "Bị ẩn", DRAFT: "Bản nháp" };

/** Đầu sidebar trong một địa điểm: tên địa điểm + menu chuyển về danh sách / xem như khách */
function VenueSwitcher({ venue }: { venue: WorkspaceData["venue"] }) {
    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
                            <BrandMark />
                            <span className="grid flex-1 text-left text-sm leading-tight">
                                <span className="truncate font-medium">{venue.name}</span>
                                <span className="truncate text-xs text-muted-foreground">{STATUS_TEXT[venue.status ?? "DRAFT"] ?? "Bản nháp"}</span>
                            </span>
                            <ChevronsUpDown className="ml-auto size-4" />
                        </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg" align="start" side="bottom" sideOffset={4}>
                        <DropdownMenuItem asChild><Link to="/builder"><ArrowLeft />Địa điểm của tôi</Link></DropdownMenuItem>
                        {venue.status === "PUBLISHED" && (
                            <DropdownMenuItem asChild><a href={`/v/${venue.slug}/map`} target="_blank" rel="noreferrer"><ExternalLink />Xem như khách</a></DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}

function WorkspaceNav({ base, data }: { base: string; data: WorkspaceData }) {
    return (
        <>
            <NavGroup label="Dựng bản đồ">
                {STEPS.map(([path, label, done], i) => (
                    <NavItem key={path} to={`${base}/${path}`} label={label} mark={<StepMark n={i + 1} done={done(data)} />}
                        sub={path === "editor" ? [{ to: `${base}/import`, label: "Nhập từ CSV, GeoJSON" }] : undefined} />
                ))}
            </NavGroup>
            <NavGroup label="Công cụ">
                {TOOLS.map(([path, label, icon, badge]) => <NavItem key={path} to={`${base}/${path}`} icon={icon} label={label} badge={badge} />)}
            </NavGroup>
        </>
    );
}

function WorkspaceFrame() {
    const { data, venueId } = useWorkspace();
    const { pathname } = useLocation();
    const base = `/builder/v/${venueId}`;
    const page = pathname.slice(base.length + 1).split("/")[0] ?? "";
    const wide = WIDE.has(page);
    return (
        <ConsoleFrame
            crumbs={[{ label: data.venue.name, to: `${base}/buildings` }, { label: LABEL[page] ?? "Dựng bản đồ" }]}
            heading={<VenueSwitcher venue={data.venue} />}
            nav={<WorkspaceNav base={base} data={data} />}
            collapsed={wide}
            full={wide}>
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
