import { createContext, Fragment, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link, useMatch, useNavigate } from "react-router-dom";
import { Building2, ChartColumn, Check, ChevronsUpDown, LogOut, MapPin, ShieldCheck, UserRound, type LucideIcon } from "lucide-react";
import {
    Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator
} from "@/components/ui/breadcrumb";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
    Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuBadge,
    SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem, SidebarProvider, SidebarRail, SidebarTrigger
} from "@/components/ui/sidebar";
import { useAuth } from "./auth";

// MỘT khung cho mọi màn máy tính (Builder, Admin) theo mẫu shadcn/ui "sidebar-07":
// sidebar thu gọn được (logo/địa điểm ở trên, nhóm mục giữa, tài khoản ở dưới) + header 56 (nút thu gọn, breadcrumb, nút của trang).
// Trang đặt nút lên header bằng <HeaderActions>, trạng thái lưu bằng <HeaderStatus> (cổng React).

interface Slots {
    actions: HTMLElement | null;
    status: HTMLElement | null;
}
const SlotContext = createContext<Slots>({ actions: null, status: null });

/** Nút của trang, hiện ở bên phải header. Mỗi màn tối đa một nút chính. */
export function HeaderActions({ children }: { children: ReactNode }) {
    const { actions } = useContext(SlotContext);
    return actions ? createPortal(children, actions) : null;
}

/** Trạng thái cạnh breadcrumb (đã lưu, chưa lưu, lỗi lưu). */
export function HeaderStatus({ children }: { children: ReactNode }) {
    const { status } = useContext(SlotContext);
    return status ? createPortal(children, status) : null;
}

export function SaveState({ state, count, onRetry }: { state: "saved" | "saving" | "dirty" | "error"; count?: number; onRetry?: () => void }) {
    const base = "inline-flex items-center gap-1.5 text-xs whitespace-nowrap";
    if (state === "saved") return <span className={`${base} text-muted-foreground`} role="status"><Check className="size-3.5" />Đã lưu</span>;
    if (state === "saving") return <span className={`${base} text-muted-foreground`} role="status">Đang lưu…</span>;
    if (state === "dirty") {
        return (
            <span className={`${base} text-foreground`} role="status">
                <span className="size-1.5 rounded-full bg-warning" aria-hidden="true" />{count ? `${count} thay đổi chưa lưu` : "Có thay đổi chưa lưu"}
            </span>
        );
    }
    return (
        <span className={`${base} text-destructive`} role="status">
            Lưu thất bại{onRetry && <button type="button" onClick={onRetry} className="font-medium underline underline-offset-4">Thử lại</button>}
        </span>
    );
}

export interface Crumb {
    label: string;
    to?: string;
}

function initials(name?: string) {
    const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    return (parts[0]!.charAt(0) + (parts.length > 1 ? parts[parts.length - 1]!.charAt(0) : "")).toUpperCase();
}

/** Ô logo vuông màu chủ đạo */
export function BrandMark() {
    return (
        <span className="flex aspect-square size-8 items-center justify-center rounded-lg bg-brand text-brand-foreground">
            <MapPin className="size-4" strokeWidth={2.25} />
        </span>
    );
}

function NavUser({ area }: { area: "builder" | "admin" }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-medium">{initials(user?.fullName)}</span>
                            <span className="grid flex-1 text-left text-sm leading-tight">
                                <span className="truncate font-medium">{user?.fullName}</span>
                                <span className="truncate text-xs text-muted-foreground">{user?.email}</span>
                            </span>
                            <ChevronsUpDown className="ml-auto size-4" />
                        </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg" side="right" align="end" sideOffset={4}>
                        <DropdownMenuLabel className="font-normal">
                            <div className="grid text-sm leading-tight">
                                <span className="truncate font-medium">{user?.fullName}</span>
                                <span className="truncate text-xs text-muted-foreground">{user?.email}</span>
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                            <DropdownMenuItem asChild><Link to="/builder/account"><UserRound />Tài khoản</Link></DropdownMenuItem>
                            {user?.role === "SYSTEM_ADMIN" && (area === "admin"
                                ? <DropdownMenuItem asChild><Link to="/builder"><Building2 />Mở Builder</Link></DropdownMenuItem>
                                : <DropdownMenuItem asChild><Link to="/admin"><ShieldCheck />Quản trị hệ thống</Link></DropdownMenuItem>)}
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => { logout(); navigate("/login"); }}><LogOut />Đăng xuất</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}

/** Đầu sidebar mặc định: logo + tên khu vực */
export function AppHeading({ title, sub, to }: { title: string; sub: string; to: string }) {
    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <SidebarMenuButton size="lg" asChild>
                    <Link to={to}>
                        <BrandMark />
                        <span className="grid flex-1 text-left text-sm leading-tight">
                            <span className="truncate font-medium">{title}</span>
                            <span className="truncate text-xs text-muted-foreground">{sub}</span>
                        </span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}

interface FrameProps {
    area?: "builder" | "admin";
    crumbs: Crumb[];
    /** Chip cạnh breadcrumb (ví dụ trạng thái xuất bản) */
    chip?: ReactNode;
    /** Đầu sidebar; mặc định logo + "Indoor Map" */
    heading?: ReactNode;
    /** Các nhóm mục (<NavGroup>) */
    nav: ReactNode;
    /** true: trang tự lo cuộn (canvas, bản đồ tràn màn) */
    full?: boolean;
    /** Thu sidebar về dạng icon (màn biên tập bản đồ cần rộng) */
    collapsed?: boolean;
    children: ReactNode;
}

export function ConsoleFrame({ area = "builder", crumbs, chip, heading, nav, full, collapsed = false, children }: FrameProps) {
    const [slots, setSlots] = useState<Slots>({ actions: null, status: null });
    const actionsRef = useRef<HTMLDivElement>(null);
    const statusRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(!collapsed);
    useEffect(() => setSlots({ actions: actionsRef.current, status: statusRef.current }), []);
    // Đổi sang màn biên tập thì tự thu gọn, rời đi thì mở lại; khách vẫn tự bấm được
    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => setOpen(!collapsed), [collapsed]);
    return (
        <SlotContext.Provider value={slots}>
            <SidebarProvider open={open} onOpenChange={setOpen} className="h-svh overflow-hidden">
                <Sidebar collapsible="icon">
                    <SidebarHeader>
                        {heading ?? (area === "admin"
                            ? <AppHeading title="Indoor Map" sub="Quản trị hệ thống" to="/admin" />
                            : <AppHeading title="Indoor Map" sub="Builder" to="/builder" />)}
                    </SidebarHeader>
                    <SidebarContent>{nav}</SidebarContent>
                    <SidebarFooter><NavUser area={area} /></SidebarFooter>
                    <SidebarRail />
                </Sidebar>
                <SidebarInset className="min-w-0 overflow-hidden">
                    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
                        <SidebarTrigger className="-ml-1" />
                        <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
                        <Breadcrumb className="min-w-0">
                            <BreadcrumbList className="flex-nowrap">
                                {crumbs.map((c, i) => (
                                    <Fragment key={i}>
                                        {i > 0 && <BreadcrumbSeparator />}
                                        <BreadcrumbItem className="min-w-0">
                                            {i < crumbs.length - 1 && c.to
                                                ? <BreadcrumbLink asChild><Link to={c.to} className="block max-w-56 truncate">{c.label}</Link></BreadcrumbLink>
                                                : i < crumbs.length - 1 ? <span className="truncate">{c.label}</span>
                                                    : <BreadcrumbPage className="truncate">{c.label}</BreadcrumbPage>}
                                        </BreadcrumbItem>
                                    </Fragment>
                                ))}
                            </BreadcrumbList>
                        </Breadcrumb>
                        {chip}
                        <div ref={statusRef} className="contents" />
                        <div ref={actionsRef} className="ml-auto flex items-center gap-2 [&_[data-slot=button]]:h-8" />
                    </header>
                    <div className={full ? "flex min-h-0 flex-1 flex-col overflow-hidden" : "min-h-0 flex-1 overflow-y-auto"}>{children}</div>
                </SidebarInset>
            </SidebarProvider>
        </SlotContext.Provider>
    );
}

// ---------------------------------------------------------------- mục sidebar
export function NavGroup({ label, children }: { label: string; children: ReactNode }) {
    return (
        <SidebarGroup>
            <SidebarGroupLabel>{label}</SidebarGroupLabel>
            <SidebarMenu>{children}</SidebarMenu>
        </SidebarGroup>
    );
}

interface NavItemProps {
    to: string;
    label: string;
    icon?: LucideIcon;
    /** Thay icon bằng phần tử tuỳ ý (dấu bước) */
    mark?: ReactNode;
    badge?: ReactNode;
    end?: boolean;
    /** Mục con (thụt vào dưới mục cha) */
    sub?: { to: string; label: string }[];
}

function SubItem({ to, label }: { to: string; label: string }) {
    const active = !!useMatch({ path: to, end: true });
    return (
        <SidebarMenuSubItem>
            <SidebarMenuSubButton asChild isActive={active} className="data-[active=true]:bg-primary/10 data-[active=true]:text-primary"><Link to={to}>{label}</Link></SidebarMenuSubButton>
        </SidebarMenuSubItem>
    );
}

export function NavItem({ to, label, icon: Icon, mark, badge, end, sub }: NavItemProps) {
    const active = !!useMatch({ path: to, end: !!end });
    return (
        <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={active} tooltip={label}
                className="data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:hover:bg-primary/15 data-[active=true]:hover:text-primary">
                <Link to={to}>{mark ?? (Icon && <Icon />)}<span>{label}</span></Link>
            </SidebarMenuButton>
            {badge != null && <SidebarMenuBadge className="text-muted-foreground">{badge}</SidebarMenuBadge>}
            {sub && (
                <SidebarMenuSub>
                    {sub.map(s => <SubItem key={s.to} {...s} />)}
                </SidebarMenuSub>
            )}
        </SidebarMenuItem>
    );
}

/** Dấu bước dựng bản đồ: xong = tick tròn, chưa = số trong vòng tròn (cùng cỡ icon 16) */
export function StepMark({ n, done }: { n: number; done: boolean }) {
    return done
        ? <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-success text-white" aria-label="Đã xong"><Check className="size-2.5" strokeWidth={3} /></span>
        : <span className="flex size-4 shrink-0 items-center justify-center rounded-full border border-current text-[10px] leading-none font-medium" aria-hidden="true">{n}</span>;
}

export function GlobalNav() {
    return (
        <NavGroup label="Quản lý">
            <NavItem to="/builder" end icon={Building2} label="Địa điểm của tôi" />
            <NavItem to="/builder/stats" icon={ChartColumn} label="Thống kê" />
            <NavItem to="/builder/account" icon={UserRound} label="Tài khoản" />
        </NavGroup>
    );
}
