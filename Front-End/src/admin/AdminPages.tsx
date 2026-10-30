import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { groupLabel, type LocationTypeDto, type UserDto, type UserStatus, type VenueDto, type VenueStatus } from "@indoor-map/core";
import {
    Activity, AlertCircle, Building2, Check, Clock, Download, ExternalLink, Eye, EyeOff, FileText, Layers, LayoutDashboard, List, Lock,
    MapPin, MoreHorizontal, MousePointer2, Plus, Search, Settings, ShieldCheck, Trash2, TriangleAlert, UserPlus, Users, Workflow, X, type LucideIcon
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { adminApi } from "../console/api";
import { useAuth } from "../console/auth";
import { EmptyState, ErrorState, Page, Section, Stat } from "../console/page";
import { ConsoleFrame, NavGroup, NavItem } from "../console/Shell";
import { COLORS, ICONS, useAction, useFeedback } from "../console/ui";
import { KIND_LABEL } from "../builder/pages/VenuesPage";

// ---------------------------------------------------------------- dữ liệu dùng chung
function useAdminData() {
    const [users, setUsers] = useState<UserDto[] | null>(null);
    const [venues, setVenues] = useState<VenueDto[] | null>(null);
    const [error, setError] = useState<unknown>(null);
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        let alive = true;
        Promise.all([adminApi.users(), adminApi.venues()])
            .then(([u, v]) => {
                if (!alive) return;
                setUsers(u);
                setVenues(v);
                setError(null);
            })
            .catch(e => alive && setError(e));
        return () => {
            alive = false;
        };
    }, [attempt]);
    const reload = useCallback(() => {
        setError(null);
        setUsers(null);
        setVenues(null);
        setAttempt(a => a + 1);
    }, []);
    return { users, venues, error, reload, setUsers, setVenues };
}

const ADMIN_PAGES: [string, string, LucideIcon][] = [
    ["", "Tổng quan", LayoutDashboard], ["review", "Kiểm duyệt", ShieldCheck], ["users", "Người dùng", Users],
    ["templates", "Danh mục mẫu", List], ["settings", "Cấu hình", Settings], ["logs", "Nhật ký", FileText]
];

export function AdminLayout() {
    const { pathname } = useLocation();
    const [pending, setPending] = useState<number | null>(null);
    useEffect(() => {
        void adminApi.users("PENDING").then(list => setPending(list.length)).catch(() => setPending(null));
    }, []);
    const page = pathname.replace(/^\/admin\/?/, "").split("/")[0] ?? "";
    const current = ADMIN_PAGES.find(([path]) => path === page)?.[1] ?? "Tổng quan";
    return (
        <ConsoleFrame area="admin" crumbs={[{ label: "Quản trị hệ thống", to: "/admin" }, { label: current }]}
            nav={(
                <NavGroup label="Quản trị hệ thống">
                    {ADMIN_PAGES.map(([path, label, icon]) => (
                        <NavItem key={path} to={path ? `/admin/${path}` : "/admin"} end={!path} icon={icon} label={label}
                            badge={path === "users" && pending ? pending : undefined} />
                    ))}
                </NavGroup>
            )}>
            <Outlet />
        </ConsoleFrame>
    );
}

// ---------------------------------------------------------------- thành phần nhỏ
const DOT = "size-1.5 rounded-full";

/** Nút bị vô hiệu kèm lý do (nút disabled không nhận chuột nên bọc trong span để hiện tooltip) */
function WithReason({ reason, children }: { reason?: string; children: ReactNode }) {
    if (!reason) return <>{children}</>;
    return (
        <Tooltip>
            <TooltipTrigger asChild><span tabIndex={0} className="inline-flex">{children}</span></TooltipTrigger>
            <TooltipContent>{reason}</TooltipContent>
        </Tooltip>
    );
}

/** Bộ lọc trạng thái dạng nút bật, kèm số đếm */
function FilterGroup<T extends string>({ label, items, value, onChange }: { label: string; items: [T, string, number | null][]; value: T; onChange: (v: T) => void }) {
    return (
        <ToggleGroup type="single" variant="outline" size="sm" value={value} onValueChange={v => v && onChange(v as T)} aria-label={label}>
            {items.map(([key, text, n]) => (
                <ToggleGroupItem key={key} value={key} className="gap-1.5 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                    {text}{n != null && <span className="text-xs tabular-nums opacity-70">{n}</span>}
                </ToggleGroupItem>
            ))}
        </ToggleGroup>
    );
}

function NotAvailable() {
    return <Badge variant="outline" className="text-muted-foreground">Chưa khả dụng</Badge>;
}

function Who({ user, extra }: { user: UserDto; extra?: string }) {
    return (
        <div className="rounded-lg border px-4 py-3">
            <p className="text-sm font-medium">{user.fullName}</p>
            <p className="text-xs text-muted-foreground">{user.email}{extra ? `, ${extra}` : ""}</p>
        </div>
    );
}

function StatSkeleton() {
    return (
        <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
            <Skeleton className="size-9 rounded-lg" />
            <div className="space-y-2"><Skeleton className="h-3 w-20" /><Skeleton className="h-5 w-10" /><Skeleton className="h-3 w-28" /></div>
        </div>
    );
}

/** "3 giờ", "2 ngày"… tính từ thời điểm tạo */
function since(iso?: string): { text: string; late: boolean } | null {
    if (!iso) return null;
    const ms = Date.now() - new Date(iso).getTime();
    if (!Number.isFinite(ms) || ms < 0) return null;
    const min = Math.floor(ms / 60000);
    if (min < 60) return { text: `${Math.max(1, min)} phút`, late: false };
    const h = Math.floor(min / 60);
    if (h < 24) return { text: `${h} giờ`, late: false };
    const d = Math.floor(h / 24);
    return { text: `${d} ngày`, late: d >= 2 };
}

const dateTime = (iso?: string) => (iso ? new Date(iso).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "");

// ---------------------------------------------------------------- tổng quan
export function AdminDashboard() {
    const { users, venues, error, reload } = useAdminData();
    const ready = users && venues;
    const pending = (users ?? []).filter(u => u.status === "PENDING").sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
    const lockedOwners = new Set((users ?? []).filter(u => u.status === "LOCKED").map(u => u.id));
    const orphaned = (venues ?? []).filter(v => v.ownerId != null && lockedOwners.has(v.ownerId));
    const count = (s: VenueStatus) => (venues ?? []).filter(v => v.status === s).length;
    const oldest = since(pending[0]?.createdAt);
    const emailOf = (id?: number) => users?.find(u => u.id === id)?.email ?? "";
    const jobs = pending.length + orphaned.length;

    return (
        <Page actions={<Button variant="outline" asChild><Link to="/admin/logs"><FileText />Nhật ký</Link></Button>}>
            {error ? <ErrorState error={error} onRetry={reload} /> : null}
            <section aria-label="Số liệu chính" aria-busy={!ready && !error ? true : undefined} className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
                {ready ? (
                    <>
                        <Stat icon={<Building2 />} tone="blue" label="Địa điểm" value={venues.length}
                            hint={`${count("PUBLISHED")} công khai, ${count("DRAFT")} nháp, ${count("HIDDEN")} ẩn`} />
                        <Stat icon={<UserPlus />} tone="amber" label="Tài khoản chờ duyệt" value={pending.length} hint={oldest ? `Lâu nhất ${oldest.text}` : "Không có"} />
                        <Stat icon={<Lock />} tone="amber" label="Chủ bị khoá" value={orphaned.length} hint="Địa điểm cần chuyển chủ" />
                    </>
                ) : error ? (
                    <>
                        <Stat icon={<Building2 />} tone="blue" label="Địa điểm" value="—" hint="Không tải được" />
                        <Stat icon={<UserPlus />} tone="amber" label="Tài khoản chờ duyệt" value="—" hint="Không tải được" />
                        <Stat icon={<Lock />} tone="amber" label="Chủ bị khoá" value="—" hint="Không tải được" />
                    </>
                ) : [0, 1, 2].map(i => <StatSkeleton key={i} />)}
                <Stat icon={<Eye />} tone="muted" label="Lượt mở bản đồ" value="—" hint="Chưa khả dụng" />
                <Stat icon={<Activity />} tone="muted" label="Lỗi API 24 giờ" value="—" hint="Chưa khả dụng" />
            </section>

            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
                <Section title="Hàng đợi cần xử lý" flush
                    actions={ready ? <span className="text-sm text-muted-foreground tabular-nums">{jobs} việc</span> : !error && <Skeleton className="h-4 w-12" />}>
                    {error ? (
                        <p className="px-6 py-10 text-center text-sm text-muted-foreground">Không tải được hàng đợi.</p>
                    ) : ready && jobs === 0 ? (
                        <p className="px-6 py-10 text-center text-sm text-muted-foreground">Không có việc chờ xử lý.</p>
                    ) : (
                        <Table aria-busy={!ready || undefined}>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="pl-6">Việc</TableHead>
                                    <TableHead>Đối tượng</TableHead>
                                    <TableHead>Chờ</TableHead>
                                    <TableHead className="w-0"><span className="sr-only">Thao tác</span></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {!ready ? [0, 1, 2].map(i => (
                                    <TableRow key={i}>
                                        <TableCell className="pl-6"><Skeleton className="h-4 w-32" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-28" /><Skeleton className="mt-2 h-3 w-36" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-10" /></TableCell>
                                        <TableCell className="pr-6"><Skeleton className="ml-auto h-8 w-16" /></TableCell>
                                    </TableRow>
                                )) : (
                                    <>
                                        {pending.map(u => {
                                            const wait = since(u.createdAt);
                                            return (
                                                <TableRow key={`u${u.id}`}>
                                                    <TableCell className="pl-6">Duyệt tài khoản</TableCell>
                                                    <TableCell>
                                                        <p className="font-medium">{u.fullName}</p>
                                                        <p className="text-xs text-muted-foreground">{u.email}</p>
                                                    </TableCell>
                                                    <TableCell>
                                                        {wait ? (wait.late ? <Badge className="bg-warning/10 text-warning"><Clock />{wait.text}</Badge> : <span className="tabular-nums">{wait.text}</span>)
                                                            : <span className="text-muted-foreground">—</span>}
                                                    </TableCell>
                                                    <TableCell className="pr-6 text-right"><Button asChild variant="outline" size="sm"><Link to="/admin/users">Xử lý</Link></Button></TableCell>
                                                </TableRow>
                                            );
                                        })}
                                        {orphaned.map(v => (
                                            <TableRow key={`v${v.id}`}>
                                                <TableCell className="pl-6">Chuyển chủ địa điểm</TableCell>
                                                <TableCell>
                                                    <p className="font-medium">{v.name}</p>
                                                    <p className="text-xs text-muted-foreground">Chủ bị khoá: {emailOf(v.ownerId) || v.ownerName}</p>
                                                </TableCell>
                                                <TableCell className="text-muted-foreground">—</TableCell>
                                                <TableCell className="pr-6 text-right"><Button asChild variant="outline" size="sm"><Link to="/admin/review">Xử lý</Link></Button></TableCell>
                                            </TableRow>
                                        ))}
                                    </>
                                )}
                            </TableBody>
                        </Table>
                    )}
                </Section>

                <div className="flex flex-col gap-6">
                    <Section title="Sức khoẻ hệ thống" actions={<NotAvailable />}>
                        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
                            {["API", "Cơ sở dữ liệu", "Lưu trữ mặt bằng", "Email"].map(k => (
                                <div key={k} className="contents"><dt>{k}</dt><dd className="text-right text-muted-foreground">—</dd></div>
                            ))}
                        </dl>
                    </Section>
                    <Section title="Hoạt động gần đây" actions={<NotAvailable />}>
                        <div className="flex flex-col items-start gap-3">
                            <p className="text-sm text-muted-foreground">Chưa ghi nhật ký hoạt động.</p>
                            <Button asChild variant="outline" size="sm"><Link to="/admin/logs">Xem nhật ký</Link></Button>
                        </div>
                    </Section>
                </div>
            </div>
        </Page>
    );
}

// ---------------------------------------------------------------- kiểm duyệt địa điểm
type ReviewFilter = "ALL" | "PUBLISHED" | "DRAFT" | "LOCKED_OWNER" | "HIDDEN";
type ReviewDialog = "hide" | "unhide" | "owner" | null;

function VenueBadge({ status }: { status?: string }) {
    if (status === "HIDDEN") return <Badge className="bg-destructive/10 text-destructive"><EyeOff />Đã ẩn</Badge>;
    if (status === "PUBLISHED") return <Badge className="gap-1.5 bg-success/10 text-success"><span className={`${DOT} bg-success`} aria-hidden="true" />Công khai</Badge>;
    return <Badge className="gap-1.5 bg-warning/10 text-warning"><span className={`${DOT} bg-warning`} aria-hidden="true" />Bản nháp</Badge>;
}

const LockedOwnerBadge = () => <Badge className="bg-destructive/10 text-destructive"><Lock />Chủ bị khoá</Badge>;

function ReviewSkeleton() {
    return (
        <div className="grid items-start gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]" aria-busy="true">
            <span className="sr-only" role="status">Đang tải địa điểm cần kiểm duyệt</span>
            <div className="flex flex-col gap-1 rounded-xl border bg-card p-1">
                {[0, 1, 2, 3].map(i => (
                    <div key={i} className="space-y-2 px-3 py-2"><Skeleton className="h-4 w-40" /><Skeleton className="h-3 w-28" /></div>
                ))}
            </div>
            <div className="flex flex-col gap-6">
                <div className="space-y-2"><Skeleton className="h-6 w-64" /><Skeleton className="h-3 w-48" /></div>
                <div className="grid grid-cols-3 gap-4">{[0, 1, 2].map(i => <StatSkeleton key={i} />)}</div>
                <Skeleton className="h-28 w-full rounded-xl" />
            </div>
        </div>
    );
}

export function AdminReview() {
    const { users, venues, error, reload, setVenues } = useAdminData();
    const { confirm } = useFeedback();
    const { busy, run } = useAction();
    const [filter, setFilter] = useState<ReviewFilter>("ALL");
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [dialog, setDialog] = useState<ReviewDialog>(null);
    const [ownerId, setOwnerId] = useState<number | "">("");

    const lockedOwners = useMemo(() => new Set((users ?? []).filter(u => u.status === "LOCKED").map(u => u.id)), [users]);
    const isOwnerLocked = (v: VenueDto) => v.ownerId != null && lockedOwners.has(v.ownerId);
    const all = venues ?? [];
    const matches = (v: VenueDto, f: ReviewFilter) => f === "ALL" || (f === "LOCKED_OWNER" ? isOwnerLocked(v) && v.status !== "HIDDEN" : v.status === f);
    const list = all.filter(v => matches(v, filter));
    const selected = list.find(v => v.id === selectedId) ?? list[0];
    const owner = users?.find(u => u.id === selected?.ownerId);
    const loaded = !!venues && !!users;

    const patch = (saved: VenueDto | null) => {
        if (saved && venues) setVenues(venues.map(x => (x.id === saved.id ? { ...x, ...saved } : x)));
        return saved;
    };
    const setStatus = async (v: VenueDto, status: VenueStatus, message: string) => {
        if (patch(await run(() => adminApi.setVenueStatus(v.id, status), message))) setDialog(null);
    };
    const unpublish = async (v: VenueDto) => {
        if (!(await confirm(`Gỡ xuất bản ${v.name}?`, { detail: "Địa điểm về Nháp, khách không mở được cho tới khi chủ xuất bản lại.", danger: true, okLabel: "Gỡ xuất bản" }))) return;
        await setStatus(v, "DRAFT", "Đã gỡ xuất bản");
    };
    const saveOwner = async (e: FormEvent) => {
        e.preventDefault();
        if (!selected || !ownerId) return;
        if (patch(await run(() => adminApi.setVenueOwner(selected.id, Number(ownerId)), "Đã chuyển chủ sở hữu"))) setDialog(null);
    };

    const chips: [ReviewFilter, string, number | null][] = [
        ["ALL", "Tất cả", venues ? all.length : null], ["PUBLISHED", "Công khai", venues ? all.filter(v => matches(v, "PUBLISHED")).length : null],
        ["DRAFT", "Nháp", venues ? all.filter(v => matches(v, "DRAFT")).length : null],
        ["LOCKED_OWNER", "Chủ bị khoá", venues && users ? all.filter(v => matches(v, "LOCKED_OWNER")).length : null],
        ["HIDDEN", "Đã ẩn", venues ? all.filter(v => matches(v, "HIDDEN")).length : null]
    ];

    const actions = loaded && selected ? (
        <>
            <Button variant="outline" onClick={() => { setOwnerId(""); setDialog("owner"); }}>Chuyển chủ…</Button>
            {selected.status === "HIDDEN"
                ? <Button onClick={() => setDialog("unhide")}>Hiện lại về Nháp…</Button>
                : <Button asChild><Link to={`/builder/v/${selected.id}/buildings`}>Mở trong Builder</Link></Button>}
        </>
    ) : undefined;
    const close = (open: boolean) => !open && setDialog(null);

    return (
        <Page actions={actions}>
            <div className="flex items-center gap-2">
                <FilterGroup label="Lọc theo trạng thái" items={chips} value={filter} onChange={f => { setFilter(f); setSelectedId(null); }} />
            </div>
            {error ? <ErrorState error={error} onRetry={reload} /> : !loaded ? <ReviewSkeleton /> : !selected ? (
                <EmptyState icon={<ShieldCheck />} title="Không có địa điểm cần kiểm duyệt" description="Địa điểm công khai, bị ẩn hoặc có chủ bị khoá sẽ hiện ở đây."
                    action={filter !== "ALL" ? <Button variant="outline" onClick={() => setFilter("ALL")}>Xem tất cả</Button> : undefined} />
            ) : (
                <div className="grid items-start gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
                    <nav aria-label="Địa điểm cần xem" className="flex flex-col gap-0.5 rounded-xl border bg-card p-1">
                        {list.map(v => {
                            const cur = v.id === selected.id;
                            return (
                                <button key={v.id} type="button" aria-current={cur} onClick={() => setSelectedId(v.id)}
                                    className={`flex w-full flex-col items-start gap-1 rounded-lg px-3 py-2 text-left ${cur ? "bg-primary/10" : "hover:bg-muted/60"}`}>
                                    <span className="flex w-full min-w-0 items-center gap-2">
                                        <span className={`min-w-0 flex-1 truncate text-sm ${cur ? "font-medium text-primary" : ""}`}>{v.name}</span>
                                        {isOwnerLocked(v) && v.status !== "HIDDEN" ? <LockedOwnerBadge /> : <VenueBadge status={v.status} />}
                                    </span>
                                    <span className="w-full truncate text-xs text-muted-foreground">Chủ: {v.ownerName ?? "—"}</span>
                                </button>
                            );
                        })}
                    </nav>

                    <section className="flex min-w-0 flex-col gap-6" aria-label="Chi tiết địa điểm">
                        <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h2 className="truncate text-lg font-semibold">{selected.name}</h2>
                                    <VenueBadge status={selected.status} />
                                    {isOwnerLocked(selected) && <LockedOwnerBadge />}
                                </div>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                    <span>/v/{selected.slug}</span>
                                    <span>{KIND_LABEL[selected.kind ?? "other"] ?? selected.kind}</span>
                                    <span>Chủ: {selected.ownerName ?? "—"}{isOwnerLocked(selected) ? " (bị khoá)" : ""}</span>
                                </div>
                            </div>
                            {selected.status === "PUBLISHED" && (
                                <Button asChild variant="outline" size="sm"><a href={`/v/${selected.slug}`} target="_blank" rel="noreferrer"><ExternalLink />Xem như khách</a></Button>
                            )}
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <Stat icon={<Building2 />} tone="blue" label="Toà nhà" value={selected.buildingCount ?? 0} />
                            <Stat icon={<Layers />} tone="green" label="Tầng" value={selected.floorCount ?? 0} />
                            <Stat icon={<MapPin />} tone="amber" label="Điểm" value={(selected.locationCount ?? 0).toLocaleString("vi-VN")} />
                        </div>

                        {isOwnerLocked(selected) && selected.status !== "HIDDEN" && (
                            <Alert className="border-warning/30 [&>svg]:text-warning">
                                <TriangleAlert />
                                <AlertTitle>Chủ {selected.ownerName} đang bị khoá, địa điểm vẫn {selected.status === "PUBLISHED" ? "công khai" : "ở bản nháp"}</AlertTitle>
                                <AlertDescription>Không ai sửa được cho tới khi bạn chuyển chủ.</AlertDescription>
                            </Alert>
                        )}

                        {selected.status === "HIDDEN" && (
                            <Section title="Quyền của chủ khi bị ẩn">
                                <dl className="grid grid-cols-3 gap-4">
                                    {[["Xem", "Được"], ["Sửa nháp", "Được"], ["Xuất bản", "Không"]].map(([k, v]) => (
                                        <div key={k} className="space-y-1">
                                            <dt className="text-xs text-muted-foreground">{k}</dt>
                                            <dd className={`text-sm font-medium ${v === "Không" ? "text-destructive" : ""}`}>{v}</dd>
                                        </div>
                                    ))}
                                </dl>
                            </Section>
                        )}

                        <Section title="Lịch sử kiểm duyệt" actions={<NotAvailable />}>
                            <p className="text-sm text-muted-foreground">Cập nhật lần cuối {selected.updatedAt ? new Date(selected.updatedAt).toLocaleString("vi-VN") : "—"}</p>
                        </Section>

                        {selected.status !== "HIDDEN" && (
                            <div className="flex items-center justify-between gap-4 rounded-xl border border-destructive/30 px-6 py-4">
                                <div className="min-w-0">
                                    <p className="text-sm font-medium">{selected.status === "PUBLISHED" ? "Gỡ xuất bản hoặc ẩn địa điểm" : "Ẩn địa điểm"}</p>
                                    <p className="text-sm text-muted-foreground">Khách không mở được cho tới khi xuất bản hoặc hiện lại.</p>
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
                                    {selected.status === "PUBLISHED" && (
                                        <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" disabled={busy} onClick={() => void unpublish(selected)}>Gỡ xuất bản…</Button>
                                    )}
                                    <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDialog("hide")}><EyeOff />Ẩn địa điểm…</Button>
                                </div>
                            </div>
                        )}
                    </section>
                </div>
            )}

            <Dialog open={dialog === "hide" && !!selected} onOpenChange={close}>
                <DialogContent className="sm:max-w-md">
                    {dialog === "hide" && selected && (
                        <>
                            <DialogHeader>
                                <DialogTitle>Ẩn {selected.name}?</DialogTitle>
                                <DialogDescription>Hiện lại được bất cứ lúc nào.</DialogDescription>
                            </DialogHeader>
                            <ul className="list-disc space-y-1 pl-5 text-sm">
                                <li>Khách không mở được <span className="font-medium">/v/{selected.slug}</span> và các mã QR đã dán.</li>
                                <li>Chủ vẫn sửa nháp, nhưng không xuất bản được tới khi bạn hiện lại.</li>
                            </ul>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setDialog(null)}>Huỷ</Button>
                                <Button variant="destructive" disabled={busy} onClick={() => void setStatus(selected, "HIDDEN", "Đã ẩn địa điểm")}>Ẩn địa điểm</Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={dialog === "unhide" && !!selected} onOpenChange={close}>
                <DialogContent className="sm:max-w-md">
                    {dialog === "unhide" && selected && (
                        <>
                            <DialogHeader>
                                <DialogTitle>Hiện lại {selected.name}?</DialogTitle>
                                <DialogDescription>Địa điểm về Nháp, khách vẫn chưa thấy.</DialogDescription>
                            </DialogHeader>
                            <ul className="list-disc space-y-1 pl-5 text-sm">
                                <li>Chủ {selected.ownerName ?? ""} sửa rồi <span className="font-medium">tự xuất bản lại</span>.</li>
                            </ul>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setDialog(null)}>Huỷ</Button>
                                <Button disabled={busy} onClick={() => void setStatus(selected, "DRAFT", "Đã đưa về bản nháp")}>Hiện lại về Nháp</Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={dialog === "owner" && !!selected} onOpenChange={close}>
                <DialogContent className="sm:max-w-md">
                    {dialog === "owner" && selected && (
                        <form onSubmit={e => void saveOwner(e)} className="grid gap-4">
                            <DialogHeader>
                                <DialogTitle>Chuyển chủ {selected.name}?</DialogTitle>
                                <DialogDescription>Đường dẫn và mã QR giữ nguyên.</DialogDescription>
                            </DialogHeader>
                            <dl className="grid grid-cols-[1fr_auto] gap-x-4 rounded-lg border px-4 py-3 text-sm">
                                <dt className="text-muted-foreground">Chủ hiện tại</dt>
                                <dd className="text-right font-medium">
                                    {selected.ownerName ?? "—"}{owner?.status === "LOCKED" && <span className="text-destructive"> (bị khoá)</span>}
                                </dd>
                            </dl>
                            <div className="grid gap-2">
                                <Label htmlFor="own-new">Chủ mới</Label>
                                <Select value={ownerId === "" ? "" : String(ownerId)} onValueChange={v => setOwnerId(v ? Number(v) : "")}>
                                    <SelectTrigger id="own-new" className="w-full"><SelectValue placeholder="Chọn tài khoản đang hoạt động" /></SelectTrigger>
                                    <SelectContent>
                                        {users?.filter(u => u.status === "ACTIVE" && u.id !== selected.ownerId).map(u => (
                                            <SelectItem key={u.id} value={String(u.id)}>{u.fullName}, {u.email}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <ul className="list-disc space-y-1 pl-5 text-sm">
                                <li>Chủ mới sửa và xuất bản được ngay.</li>
                                <li>Chủ cũ mất quyền với địa điểm này.</li>
                            </ul>
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setDialog(null)}>Huỷ</Button>
                                <Button type="submit" disabled={!ownerId || busy}>Chuyển chủ</Button>
                            </DialogFooter>
                        </form>
                    )}
                </DialogContent>
            </Dialog>
        </Page>
    );
}

// ---------------------------------------------------------------- người dùng
type UserFilter = "ALL" | UserStatus;
const ROLE_LABEL = { VENUE_ADMIN: "Quản trị địa điểm", SYSTEM_ADMIN: "Quản trị hệ thống" } as const;

function UserBadge({ status }: { status: UserStatus }) {
    if (status === "PENDING") return <Badge className="gap-1.5 bg-warning/10 text-warning"><span className={`${DOT} bg-warning`} aria-hidden="true" />Chờ duyệt</Badge>;
    if (status === "LOCKED") return <Badge className="bg-destructive/10 text-destructive"><Lock />Bị khoá</Badge>;
    return <Badge className="gap-1.5 bg-success/10 text-success"><span className={`${DOT} bg-success`} aria-hidden="true" />Hoạt động</Badge>;
}

export function AdminUsers() {
    const { users, venues, error, reload, setUsers } = useAdminData();
    const { user: me } = useAuth();
    const { confirm } = useFeedback();
    const { busy, run } = useAction();
    const [filter, setFilter] = useState<UserFilter>("ALL");
    const [query, setQuery] = useState("");
    const [dialog, setDialog] = useState<{ kind: "reject" | "lock"; user: UserDto } | null>(null);

    const all = users ?? [];
    const q = query.trim().toLowerCase();
    const list = all.filter(u => (filter === "ALL" || u.status === filter) && (!q || `${u.fullName} ${u.email}`.toLowerCase().includes(q)));
    const activeAdmins = all.filter(u => u.role === "SYSTEM_ADMIN" && u.status === "ACTIVE").length;
    const ownedBy = (u: UserDto) => (venues ?? []).filter(v => v.ownerId === u.id);

    const setStatus = async (u: UserDto, status: UserStatus, message: string) => {
        const saved = await run(() => adminApi.setUserStatus(u.id, status), message);
        if (saved && users) {
            setUsers(users.map(x => (x.id === u.id ? saved : x)));
            setDialog(null);
        }
    };
    const unlock = async (u: UserDto) => {
        if (!(await confirm(`Mở khoá ${u.email}?`, { detail: "Người này đăng nhập lại được và tiếp tục quản lý địa điểm của mình.", okLabel: "Mở khoá" }))) return;
        await setStatus(u, "ACTIVE", `Đã mở khoá ${u.email}`);
    };

    const chips: [UserFilter, string, number | null][] = [
        ["ALL", "Tất cả", users ? all.length : null], ["PENDING", "Chờ duyệt", users ? all.filter(u => u.status === "PENDING").length : null],
        ["ACTIVE", "Hoạt động", users ? all.filter(u => u.status === "ACTIVE").length : null], ["LOCKED", "Bị khoá", users ? all.filter(u => u.status === "LOCKED").length : null]
    ];
    const dialogOwned = dialog ? ownedBy(dialog.user) : [];
    const close = (open: boolean) => !open && setDialog(null);

    return (
        <Page>
            <div className="flex items-center gap-2">
                <div className="relative w-full max-w-sm">
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm tên hoặc email" aria-label="Tìm tên hoặc email" className="pl-9" />
                </div>
                <FilterGroup label="Lọc theo trạng thái" items={chips} value={filter} onChange={setFilter} />
            </div>

            {error ? <ErrorState error={error} onRetry={reload} /> : (
                <div className="overflow-hidden rounded-xl border">
                    <Table aria-label="Danh sách người dùng" aria-busy={!users || undefined}>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead className="pl-4">Người dùng</TableHead>
                                <TableHead>Vai trò</TableHead>
                                <TableHead>Trạng thái</TableHead>
                                <TableHead>Địa điểm</TableHead>
                                <TableHead className="w-0"><span className="sr-only">Thao tác</span></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {!users ? [0, 1, 2, 3, 4].map(i => (
                                <TableRow key={i}>
                                    <TableCell className="pl-4"><Skeleton className="h-4 w-36" /><Skeleton className="mt-2 h-3 w-44" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                    <TableCell className="pr-4"><Skeleton className="ml-auto h-8 w-24" /></TableCell>
                                </TableRow>
                            )) : list.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                        {q ? `Không có người dùng khớp “${query.trim()}”.` : "Không có người dùng."}
                                        {(q || filter !== "ALL") && (
                                            <Button variant="link" size="sm" className="ml-1 h-auto px-0" onClick={() => { setQuery(""); setFilter("ALL"); }}>Xoá tìm kiếm</Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ) : list.map(u => {
                                const owned = ownedBy(u);
                                const isMe = u.id === me?.id;
                                const lastAdmin = u.role === "SYSTEM_ADMIN" && u.status === "ACTIVE" && activeAdmins <= 1;
                                const wait = u.status === "PENDING" ? since(u.createdAt) : null;
                                const lockReason = isMe ? "Không tự khoá tài khoản của mình" : lastAdmin ? "Không khoá được quản trị hệ thống cuối cùng" : undefined;
                                return (
                                    <TableRow key={u.id}>
                                        <TableCell className="pl-4">
                                            <p className="font-medium">{u.fullName}{isMe ? " (bạn)" : ""}</p>
                                            <p className="text-xs text-muted-foreground">{u.email}</p>
                                        </TableCell>
                                        <TableCell>{ROLE_LABEL[u.role]}</TableCell>
                                        <TableCell>
                                            <UserBadge status={u.status} />
                                            {u.status === "PENDING" && u.createdAt && (
                                                <p className={`mt-1 text-xs ${wait?.late ? "text-warning" : "text-muted-foreground"}`}>{wait?.late ? `Chờ ${wait.text}` : `Đăng ký ${dateTime(u.createdAt)}`}</p>
                                            )}
                                            {lastAdmin && <p className="mt-1 text-xs text-muted-foreground">Quản trị cuối cùng</p>}
                                        </TableCell>
                                        <TableCell className="whitespace-normal">
                                            {owned.length ? owned.map(v => v.name).join(", ") : <span className="text-muted-foreground">—</span>}
                                            {u.status === "LOCKED" && owned.length > 0 && (
                                                <Link to="/admin/review" className="mt-1 block text-xs font-medium text-primary underline-offset-4 hover:underline">Chuyển chủ ở Kiểm duyệt</Link>
                                            )}
                                        </TableCell>
                                        <TableCell className="pr-4">
                                            <div className="flex items-center justify-end gap-1">
                                                {u.status === "PENDING" ? (
                                                    <>
                                                        <Button variant="outline" size="sm" disabled={busy} onClick={() => void setStatus(u, "ACTIVE", `Đã duyệt ${u.email}`)}>Duyệt</Button>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="size-8" aria-label={`Thao tác khác với ${u.email}`}><MoreHorizontal /></Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="w-44">
                                                                <DropdownMenuItem variant="destructive" onSelect={() => setDialog({ kind: "reject", user: u })}><X />Từ chối đơn…</DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </>
                                                ) : (
                                                    <>
                                                        {u.status === "ACTIVE" ? (
                                                            <WithReason reason={lockReason}>
                                                                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" disabled={!!lockReason}
                                                                    onClick={() => setDialog({ kind: "lock", user: u })}><Lock />Khoá…</Button>
                                                            </WithReason>
                                                        ) : <Button variant="outline" size="sm" disabled={busy} onClick={() => void unlock(u)}>Mở khoá…</Button>}
                                                        <span className="size-8 shrink-0" aria-hidden="true" />
                                                    </>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            )}

            <Dialog open={dialog?.kind === "reject"} onOpenChange={close}>
                <DialogContent className="sm:max-w-md">
                    {dialog?.kind === "reject" && (
                        <>
                            <DialogHeader>
                                <DialogTitle>Từ chối đơn đăng ký?</DialogTitle>
                                <DialogDescription>Mở khoá được sau ở mục Bị khoá nếu cần.</DialogDescription>
                            </DialogHeader>
                            <Who user={dialog.user} />
                            <ul className="list-disc space-y-1 pl-5 text-sm">
                                <li>Tài khoản chuyển sang <span className="font-medium">Bị khoá</span>, không đăng nhập được.</li>
                            </ul>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setDialog(null)}>Huỷ</Button>
                                <Button variant="destructive" disabled={busy} onClick={() => void setStatus(dialog.user, "LOCKED", `Đã từ chối ${dialog.user.email}`)}>Từ chối đơn</Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={dialog?.kind === "lock"} onOpenChange={close}>
                <DialogContent className="sm:max-w-md">
                    {dialog?.kind === "lock" && (
                        <>
                            <DialogHeader>
                                <DialogTitle>Khoá tài khoản?</DialogTitle>
                                <DialogDescription>Không đăng nhập được cho tới khi được mở khoá.</DialogDescription>
                            </DialogHeader>
                            <Who user={dialog.user} extra={ROLE_LABEL[dialog.user.role].toLowerCase()} />
                            <ul className="list-disc space-y-1 pl-5 text-sm">
                                {dialogOwned.length > 0
                                    ? <li><span className="font-medium">{dialogOwned.length} địa điểm</span> ({dialogOwned.map(v => v.name).join(", ")}) giữ nguyên trạng thái; xử lý ở Kiểm duyệt.</li>
                                    : <li>Người này chưa sở hữu địa điểm nào.</li>}
                            </ul>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setDialog(null)}>Huỷ</Button>
                                <Button variant="destructive" disabled={busy} onClick={() => void setStatus(dialog.user, "LOCKED", `Đã khoá ${dialog.user.email}`)}>Khoá tài khoản</Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </Page>
    );
}

// ---------------------------------------------------------------- danh mục loại mẫu
const KINDS = ["all", "airport", "hospital", "school", "mall", "park", "office"];
const KIND_TAB: Record<string, string> = { all: "Chung", airport: "Sân bay", hospital: "Bệnh viện", school: "Trường học", mall: "TTTM", park: "Công viên", office: "Văn phòng" };
/** Màu mặc định của mẫu mới: lấy từ bảng màu chung (màu là dữ liệu lưu trong CSDL) */
const DEFAULT_COLOR = COLORS[1] ?? COLORS[0] ?? "";
const GROUPS = ["gate", "procedure", "food", "service", "restroom", "transport", "health", "study", "office", "leisure"];

export function AdminTemplates() {
    const [templates, setTemplates] = useState<LocationTypeDto[] | null>(null);
    const [error, setError] = useState<unknown>(null);
    const [tab, setTab] = useState<"types" | "workflows">("types");
    const [kind, setKind] = useState("airport");
    const [form, setForm] = useState<Partial<LocationTypeDto> | null>(null);
    const { confirm } = useFeedback();
    const { busy, run } = useAction();
    const load = useCallback(() => {
        adminApi.templates().then(list => {
            setTemplates(list);
            setError(null);
        }).catch(setError);
    }, []);
    useEffect(load, [load]);
    const list = useMemo(() => (templates ?? []).filter(t => t.kind === kind).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)), [templates, kind]);

    const formKind = form?.kind ?? kind;
    const code = form?.code?.trim() ?? "";
    const duplicate = code ? (templates ?? []).find(t => t.kind === formKind && t.code === code && t.id !== form?.id) : undefined;
    const canSave = !!form && !!form.name?.trim() && !!code && !duplicate;
    const color = form?.color ?? DEFAULT_COLOR;
    const colorChoices = color && !COLORS.includes(color.toLowerCase()) ? [...COLORS, color] : COLORS;

    const add = () => {
        setTab("types");
        setForm({ kind, code: "", name: "", icon: "bi-geo-alt", color: DEFAULT_COLOR, groupName: "service" });
    };
    const save = async (e: FormEvent) => {
        e.preventDefault();
        if (!form || !canSave) return;
        const body = { ...form, code, name: form.name?.trim(), kind: formKind, sortOrder: form.sortOrder ?? (list.length + 1) * 10 };
        const saved = await run(() => (form.id ? adminApi.updateTemplate(form.id, body) : adminApi.createTemplate(body)), "Đã lưu mẫu");
        if (saved) {
            setForm(saved);
            if (saved.kind && saved.kind !== kind) setKind(saved.kind);
            load();
        }
    };
    const remove = async () => {
        if (!form?.id) return;
        const id = form.id;
        if (!(await confirm(`Xoá mẫu “${form.name}”?`, { danger: true, okLabel: "Xoá", detail: "Địa điểm đã sao chép mẫu này giữ nguyên bản sao của mình." }))) return;
        if (await run(() => adminApi.removeTemplate(id), "Đã xoá mẫu") !== null) {
            setForm(null);
            load();
        }
    };

    return (
        <Page actions={<Button onClick={add}><Plus />Thêm mẫu</Button>}>
            <Tabs value={tab} onValueChange={v => setTab(v as "types" | "workflows")} className="gap-6">
                <TabsList>
                    <TabsTrigger value="types">Loại địa điểm mẫu</TabsTrigger>
                    <TabsTrigger value="workflows">Quy trình mẫu</TabsTrigger>
                </TabsList>

                <TabsContent value="workflows" className="flex flex-col gap-6">
                    <Alert>
                        <Clock />
                        <AlertTitle>Chưa khả dụng</AlertTitle>
                        <AlertDescription>Chưa có API lưu quy trình mẫu.</AlertDescription>
                    </Alert>
                    <EmptyState icon={<Workflow />} title="Chưa có quy trình mẫu" />
                </TabsContent>

                <TabsContent value="types" className="flex flex-col gap-6">
                    {error ? <ErrorState error={error} onRetry={load} /> : (
                        <>
                            <div className="flex items-center gap-2">
                                <FilterGroup label="Loại hình" value={kind} onChange={k => { setKind(k); setForm(null); }}
                                    items={KINDS.map(k => [k, KIND_TAB[k] ?? k, templates ? templates.filter(t => t.kind === k).length : null] as [string, string, number | null])} />
                            </div>
                            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
                                <Section title={KIND_TAB[kind]} flush actions={templates ? <span className="text-sm text-muted-foreground tabular-nums">{list.length} mẫu</span> : <Skeleton className="h-4 w-12" />}>
                                    <Table aria-busy={!templates || undefined}>
                                        <TableHeader className="bg-muted/50">
                                            <TableRow>
                                                <TableHead className="pl-6">Mẫu</TableHead>
                                                <TableHead>Mã</TableHead>
                                                <TableHead>Nhóm</TableHead>
                                                <TableHead className="w-0"><span className="sr-only">Thao tác</span></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {!templates ? [0, 1, 2, 3, 4].map(i => (
                                                <TableRow key={i}>
                                                    <TableCell className="pl-6"><div className="flex items-center gap-3"><Skeleton className="size-7 rounded-md" /><Skeleton className="h-4 w-32" /></div></TableCell>
                                                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                                                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                                    <TableCell className="pr-6"><Skeleton className="ml-auto h-8 w-12" /></TableCell>
                                                </TableRow>
                                            )) : list.length === 0 ? (
                                                <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">Chưa có mẫu cho loại hình này.</TableCell></TableRow>
                                            ) : list.map(t => (
                                                <TableRow key={t.id} data-state={form?.id === t.id ? "selected" : undefined}>
                                                    <TableCell className="pl-6">
                                                        <div className="flex items-center gap-3">
                                                            <span className="flex size-7 shrink-0 items-center justify-center rounded-md text-sm text-white" style={{ background: t.color }}>
                                                                <i className={`bi ${t.icon ?? "bi-geo-alt"}`} aria-hidden="true" />
                                                            </span>
                                                            <span className="font-medium">{t.name}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground">{t.code}</TableCell>
                                                    <TableCell>{groupLabel(t.groupName)}</TableCell>
                                                    <TableCell className="pr-6 text-right"><Button variant="outline" size="sm" onClick={() => setForm({ ...t })}>Sửa</Button></TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </Section>

                                {form ? (
                                    <Section flush title={form.id ? form.name || "Mẫu" : "Mẫu mới"} description={KIND_TAB[formKind] ?? formKind}
                                        actions={<Button variant="ghost" size="icon" className="size-8" aria-label="Đóng" onClick={() => setForm(null)}><X /></Button>}>
                                        <form onSubmit={e => void save(e)}>
                                            <div className="grid gap-4 p-6">
                                                <div className="grid gap-2">
                                                    <Label htmlFor="tp-name">Tên</Label>
                                                    <Input id="tp-name" required value={form.name ?? ""} onChange={e => setForm({ ...form, name: e.target.value })} />
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label htmlFor="tp-code">Mã</Label>
                                                    <Input id="tp-code" required value={form.code ?? ""} aria-invalid={duplicate ? true : undefined} aria-describedby="tp-code-h"
                                                        onChange={e => setForm({ ...form, code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })} />
                                                    {duplicate
                                                        ? <p id="tp-code-h" role="alert" className="flex items-center gap-1 text-xs font-medium text-destructive"><AlertCircle className="size-3.5" />Mã “{code}” đã dùng cho {duplicate.name}</p>
                                                        : code ? <p id="tp-code-h" className="flex items-center gap-1 text-xs text-success"><Check className="size-3.5" />Mã chưa trùng</p>
                                                            : <p id="tp-code-h" className="text-xs text-muted-foreground">Chữ thường, số, dấu gạch dưới</p>}
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="grid gap-2">
                                                        <Label htmlFor="tp-grp">Nhóm</Label>
                                                        <Select value={form.groupName ?? ""} onValueChange={v => setForm({ ...form, groupName: v })}>
                                                            <SelectTrigger id="tp-grp" className="w-full"><SelectValue /></SelectTrigger>
                                                            <SelectContent>{GROUPS.map(g => <SelectItem key={g} value={g}>{groupLabel(g)}</SelectItem>)}</SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="grid gap-2">
                                                        <Label htmlFor="tp-kind">Loại hình</Label>
                                                        <Select value={formKind} onValueChange={v => setForm({ ...form, kind: v })}>
                                                            <SelectTrigger id="tp-kind" className="w-full"><SelectValue /></SelectTrigger>
                                                            <SelectContent>{KINDS.map(k => <SelectItem key={k} value={k}>{KIND_TAB[k]}</SelectItem>)}</SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label>Màu mặc định</Label>
                                                    <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Màu mặc định">
                                                        {colorChoices.map(c => (
                                                            <button key={c} type="button" role="radio" aria-checked={color.toLowerCase() === c.toLowerCase()} aria-label={c}
                                                                className="size-6 rounded-md ring-offset-2 ring-offset-background aria-checked:ring-2 aria-checked:ring-ring" style={{ background: c }}
                                                                onClick={() => setForm({ ...form, color: c })} />
                                                        ))}
                                                        <input type="color" aria-label="Màu khác" value={color} onChange={e => setForm({ ...form, color: e.target.value })}
                                                            className="h-6 w-8 cursor-pointer rounded-md border bg-transparent p-0" />
                                                    </div>
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label>Biểu tượng</Label>
                                                    <div className="grid grid-cols-8 gap-1" role="radiogroup" aria-label="Biểu tượng">
                                                        {ICONS.map(icon => (
                                                            <button key={icon} type="button" role="radio" aria-checked={(form.icon ?? "bi-geo-alt") === icon} aria-label={icon}
                                                                className="flex size-8 items-center justify-center rounded-md border text-muted-foreground hover:bg-muted aria-checked:border-primary aria-checked:bg-primary/10 aria-checked:text-primary"
                                                                onClick={() => setForm({ ...form, icon })}>
                                                                <i className={`bi ${icon}`} aria-hidden="true" />
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                                <p className="text-xs text-muted-foreground">Địa điểm đã tạo giữ bản sao của mình, không bị sửa.</p>
                                            </div>
                                            <div className="flex items-center gap-2 border-t px-6 py-4">
                                                {form.id && (
                                                    <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => void remove()}><Trash2 />Xoá…</Button>
                                                )}
                                                <div className="ml-auto">
                                                    <WithReason reason={duplicate ? "Sửa mã trùng trước khi lưu" : undefined}>
                                                        <Button type="submit" size="sm" disabled={!canSave || busy}>Lưu mẫu</Button>
                                                    </WithReason>
                                                </div>
                                            </div>
                                        </form>
                                    </Section>
                                ) : (
                                    <div className="flex flex-col items-center gap-2 rounded-xl border bg-card px-6 py-12 text-center">
                                        <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground"><MousePointer2 className="size-5" /></span>
                                        <p className="text-sm font-medium">Chọn một mẫu để sửa</p>
                                        <p className="text-sm text-muted-foreground">Mẫu Chung được thêm cho mọi loại hình.</p>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </TabsContent>
            </Tabs>
        </Page>
    );
}

// ---------------------------------------------------------------- cấu hình (chỉ đọc) & nhật ký (chưa có API)
type CfgRow = [string, string, string];
function CfgSection({ title, rows, unavailable }: { title: string; rows: CfgRow[]; unavailable?: boolean }) {
    return (
        <Section title={title} actions={unavailable ? <NotAvailable /> : undefined}>
            <dl className="divide-y">
                {rows.map(([k, d, v]) => (
                    <div key={k} className="flex items-start justify-between gap-6 py-3 first:pt-0 last:pb-0">
                        <dt className="min-w-0">
                            <p className="text-sm font-medium">{k}</p>
                            <p className="text-xs text-muted-foreground">{d}</p>
                        </dt>
                        <dd className={`shrink-0 text-right text-sm ${unavailable ? "text-muted-foreground" : ""}`}>{v}</dd>
                    </div>
                ))}
            </dl>
        </Section>
    );
}

export function AdminSettings() {
    const apiBase = import.meta.env.VITE_API_BASE_URL || "Cùng địa chỉ website (/api)";
    const host = window.location.host;
    return (
        <Page width="narrow" actions={<WithReason reason="Chưa có API lưu cấu hình"><Button disabled>Lưu cấu hình</Button></WithReason>}>
            <Alert>
                <Lock />
                <AlertTitle>Chưa khả dụng</AlertTitle>
                <AlertDescription>Chưa có API lưu cấu hình, các giá trị dưới đây chỉ để xem.</AlertDescription>
            </Alert>
            <CfgSection title="Tài khoản và đăng nhập" rows={[
                ["Đăng ký quản trị địa điểm", "Tài khoản mới ở trạng thái Chờ duyệt.", "Mở, duyệt tay"],
                ["Khoá đăng nhập tạm", "Tính theo địa chỉ IP, tách khỏi khoá tài khoản.", "5 lần sai / 15 phút"],
                ["Hạn phiên đăng nhập", "Hết hạn thì phải đăng nhập lại.", "8 giờ"],
                ["Quản trị hệ thống đầu tiên", "Tạo từ biến môi trường khi chưa có người dùng.", "ADMIN_EMAIL"]
            ]} />
            <CfgSection title="Dữ liệu địa điểm" rows={[
                ["Tệp mặt bằng", "Gửi lên dạng ảnh hoặc SVG.", "≤ 8 MB, SVG, PNG, JPG"],
                ["Địa chỉ API", "Frontend gọi backend qua địa chỉ này.", apiBase]
            ]} />
            <CfgSection title="Chỉ đường" rows={[
                ["Tốc độ đi bộ", "Dùng cho thời gian ước tính.", "1,2 m/s"],
                ["Phạt chuyển tầng", "Tránh đổi tầng không cần thiết.", "30 m"],
                ["Bán kính nhập lối đi", "Điểm xa lối đi hơn mức này coi như không tới được.", "60 m"],
                ["Bán kính nhắc mốc", "Mốc gần lượt rẽ được nêu trong chỉ dẫn.", "14 m"]
            ]} />
            <CfgSection title="Bản đồ và đường dẫn" rows={[
                ["Bản đồ nền ngoài trời", "Dùng khi đặt vị trí địa điểm.", "OpenStreetMap (CARTO)"],
                ["Đường dẫn bản đồ", "Link khách mở từ trình duyệt.", `${host}/v/…`],
                ["Đường dẫn mã QR", "Đổi sẽ làm hỏng tem đã dán.", `${host}/q/…`]
            ]} />
            <CfgSection title="Chỉ đường bằng camera" unavailable rows={[["Cho phép chủ địa điểm bật", "Giai đoạn 2, chưa có cấu hình.", "Tắt"]]} />
            <CfgSection title="Email thông báo" unavailable rows={[["Gửi email cho người dùng", "Hệ thống chưa gửi email.", "Tắt"]]} />
        </Page>
    );
}

const LOG_NA = "Chưa có API nhật ký";
const LOG_FILTERS: [string, string[]][] = [
    ["Người", ["Mọi người", "Quản trị hệ thống", "Chủ địa điểm", "Hệ thống"]],
    ["Đối tượng", ["Mọi đối tượng", "Địa điểm", "Tài khoản", "Mẫu", "Cấu hình"]],
    ["Hành động", ["Mọi hành động", "Kiểm duyệt", "Bảo mật", "Dữ liệu"]],
    ["Thời gian", ["7 ngày qua", "24 giờ qua", "30 ngày qua"]]
];

export function AdminLogs() {
    return (
        <Page actions={<WithReason reason={LOG_NA}><Button variant="outline" disabled><Download />Xuất CSV</Button></WithReason>}>
            <Alert>
                <Clock />
                <AlertTitle>Chưa khả dụng</AlertTitle>
                <AlertDescription>Backend chưa lưu đăng nhập, duyệt tài khoản, xuất bản hay nhập dữ liệu.</AlertDescription>
            </Alert>
            <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-full max-w-sm">
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input type="search" disabled placeholder="Tìm email, đối tượng" aria-label="Tìm email, đối tượng" className="pl-9" />
                </div>
                {LOG_FILTERS.map(([label, opts]) => (
                    <Select key={label} disabled defaultValue={opts[0]}>
                        <SelectTrigger aria-label={label}><SelectValue /></SelectTrigger>
                        <SelectContent>{opts.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                    </Select>
                ))}
            </div>
            <div className="overflow-hidden rounded-xl border">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead className="pl-4">Thời gian</TableHead>
                            <TableHead>Người</TableHead>
                            <TableHead>Hành động</TableHead>
                            <TableHead>Đối tượng</TableHead>
                            <TableHead className="pr-4">Chi tiết</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Chưa ghi nhật ký.</TableCell></TableRow>
                    </TableBody>
                </Table>
            </div>
        </Page>
    );
}
