import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
    Building2, Check, CircleAlert, CircleCheck, Clock, Eye, Layers, LoaderCircle, MapPin, Plus, QrCode, Route, RouteOff, Search
} from "lucide-react";
import { analyzeVenue, buildVenueModel, type VenueDto, type VenueMapDto } from "@indoor-map/core";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { authApi, catalogApi, locationApi, planApi, venueApi, walkwayApi } from "../../console/api";
import { useAuth } from "../../console/auth";
import { ApiError } from "../../console/http";
import { EmptyState, ErrorState, Page, Section, Stat } from "../../console/page";
import { HeaderStatus, SaveState } from "../../console/Shell";
import { useAction } from "../../console/ui";
import { useWorkspace } from "../Workspace";

function VenueBadge({ status }: { status?: string }) {
    if (status === "PUBLISHED") {
        return <Badge className="gap-1.5 bg-success/10 text-success"><span className="size-1.5 rounded-full bg-success" aria-hidden="true" />Công khai</Badge>;
    }
    if (status === "HIDDEN") return <Badge className="gap-1.5 bg-destructive/10 text-destructive"><span className="size-1.5 rounded-full bg-destructive" aria-hidden="true" />Bị ẩn</Badge>;
    return <Badge className="gap-1.5 bg-warning/10 text-warning"><span className="size-1.5 rounded-full bg-warning" aria-hidden="true" />Bản nháp</Badge>;
}

// ---------------------------------------------------------------- mốc camera (giai đoạn 2, chưa có API)
function planSrc(plan?: { svg?: string; imageUrl?: string }): string | null {
    if (plan?.svg) return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(plan.svg)}`;
    return plan?.imageUrl ?? null;
}

export function LandmarksPage() {
    const { model } = useWorkspace();
    const floors = model.buildings.flatMap(b => model.floorsOf(b.id));
    const [floorId, setFloorId] = useState<number | null>(null);
    const floor = floors.find(f => f.id === floorId) ?? floors.find(f => f.plan) ?? floors[0];
    const src = planSrc(floor?.plan);
    return (
        <Page>
            <Alert>
                <Clock />
                <AlertTitle>Chưa khả dụng</AlertTitle>
                <AlertDescription>Chỉ đường bằng camera mở ở giai đoạn 2. Hiện khách định vị bằng mã QR và bước chân.</AlertDescription>
            </Alert>
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
                <Section title="Mốc trên tầng" flush actions={(
                    <>
                        {floors.length > 0 && (
                            <Select value={floor ? String(floor.id) : undefined} onValueChange={v => setFloorId(Number(v))}>
                                <SelectTrigger size="sm" className="w-48" aria-label="Tầng"><SelectValue /></SelectTrigger>
                                <SelectContent>{floors.map(f => <SelectItem key={f.id} value={String(f.id)}>{f.buildingCode} {f.name}</SelectItem>)}</SelectContent>
                            </Select>
                        )}
                        <Button variant="outline" size="sm" disabled title="Chưa khả dụng"><Plus />Thêm mốc</Button>
                    </>
                )}>
                    <div className="relative flex aspect-4/3 items-center justify-center overflow-hidden rounded-b-xl bg-muted/40">
                        <Badge variant="outline" className="absolute top-3 left-3 bg-background">Chưa có mốc</Badge>
                        {src ? <img src={src} alt={`Mặt bằng ${floor?.buildingCode ?? ""} ${floor?.name ?? ""}`} className="size-full object-contain p-6" />
                            : <p className="text-sm text-muted-foreground">{floors.length ? "Tầng này chưa có mặt bằng." : "Địa điểm chưa có tầng."}</p>}
                    </div>
                </Section>
                <div className="flex flex-col gap-6">
                    <Section title="Cài đặt camera">
                        <div aria-disabled="true" className="grid gap-4">
                            <div className="flex items-center justify-between gap-4">
                                <Label htmlFor="lm-on" className="font-normal">Bật chỉ đường camera</Label>
                                <Switch id="lm-on" disabled />
                            </div>
                            <div className="flex items-center justify-between gap-4">
                                <Label htmlFor="lm-qr" className="font-normal">Bắt quét QR trước</Label>
                                <Switch id="lm-qr" disabled />
                            </div>
                            <div className="grid gap-3">
                                <div className="flex items-center justify-between gap-4">
                                    <Label htmlFor="lm-thr" className="font-normal">Ngưỡng khớp tối thiểu</Label>
                                    <span className="text-sm text-muted-foreground">—</span>
                                </div>
                                <Slider id="lm-thr" aria-label="Ngưỡng khớp tối thiểu" min={0.5} max={0.95} step={0.01} defaultValue={[0.8]} disabled />
                            </div>
                        </div>
                    </Section>
                    <Section title="Quyền ảnh và riêng tư">
                        <p className="text-sm text-muted-foreground">Chỉ chụp cảnh cố định khi địa điểm cho phép. Mặt người được làm mờ, ảnh không hiện cho khách.</p>
                    </Section>
                </div>
            </div>
        </Page>
    );
}

// ---------------------------------------------------------------- thống kê: dữ liệu bản đồ thật, lượt dùng chưa có API
async function loadBundle(venue: VenueDto): Promise<VenueMapDto> {
    const id = venue.id;
    const [buildings, floors, zones, types, facilities, locations, walkways] = await Promise.all([
        planApi.buildings(id), planApi.floors(id), planApi.zones(id), catalogApi.types(id), catalogApi.facilities(id), locationApi.list(id), walkwayApi.get(id)
    ]);
    return { venue, buildings, floors, zones, types, facilities, locations, walkways };
}

interface BuildingRow {
    id: number;
    code: string;
    name: string;
    floors: number;
    points: number;
    /** % điểm tới được; null khi chưa có điểm nào đặt được lên bản đồ */
    reach: number | null;
}

function useVenueStats(venue: VenueDto | undefined) {
    const [state, setState] = useState<{ id: number; bundle?: VenueMapDto; error?: unknown } | null>(null);
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
        if (!venue) return undefined;
        let alive = true;
        loadBundle(venue).then(bundle => alive && setState({ id: venue.id, bundle }))
            .catch(error => alive && setState({ id: venue.id, error }));
        return () => {
            alive = false;
        };
    }, [venue, attempt]);
    const current = state && venue && state.id === venue.id ? state : null;
    const summary = useMemo(() => {
        const bundle = current?.bundle;
        if (!bundle) return null;
        const model = buildVenueModel(bundle);
        const report = analyzeVenue(model);
        const blocked = new Set([...report.unreachable, ...report.isolated].map(p => p.id));
        const withPlan = bundle.floors.filter(f => f.plan).length;
        const rows: BuildingRow[] = model.buildings.map(b => {
            const floorIds = new Set(bundle.floors.filter(f => f.buildingId === b.id).map(f => f.id));
            const placed = model.locations.filter(p => floorIds.has(p.floorId));
            return {
                id: b.id, code: b.code, name: b.name, floors: floorIds.size,
                points: bundle.locations.filter(l => floorIds.has(l.floorId)).length,
                reach: placed.length ? Math.round((100 * placed.filter(p => !blocked.has(p.id)).length) / placed.length) : null
            };
        });
        return { bundle, rows, withPlan, blocked: blocked.size };
    }, [current?.bundle]);
    return { summary, error: current?.error, loading: !!venue && !current, retry: () => setAttempt(a => a + 1) };
}

function StatSkeleton() {
    return (
        <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
            <Skeleton className="size-9 rounded-lg" />
            <div className="space-y-2"><Skeleton className="h-3 w-20" /><Skeleton className="h-5 w-10" /></div>
        </div>
    );
}

const USAGE = [
    { label: "Lượt xem bản đồ", icon: Eye },
    { label: "Lượt chỉ đường", icon: Route },
    { label: "Từ khoá khách tìm", icon: Search },
    { label: "Tuyến không tìm được", icon: RouteOff }
];

export function StatsPage() {
    const [venues, setVenues] = useState<VenueDto[] | null>(null);
    const [listError, setListError] = useState<unknown>(null);
    const [listAttempt, setListAttempt] = useState(0);
    const [venueId, setVenueId] = useState<number | null>(null);
    useEffect(() => {
        let alive = true;
        venueApi.mine().then(list => {
            if (!alive) return;
            setVenues(list);
            setListError(null);
        }).catch(e => alive && setListError(e));
        return () => {
            alive = false;
        };
    }, [listAttempt]);
    const venue = venues?.find(v => v.id === venueId) ?? venues?.[0];
    const { summary, error, loading, retry } = useVenueStats(venue);

    if (listError) return <Page><ErrorState error={listError} onRetry={() => setListAttempt(a => a + 1)} /></Page>;
    if (venues && venues.length === 0) {
        return (
            <Page>
                <EmptyState icon={<Building2 />} title="Chưa có địa điểm nào" description="Số liệu bản đồ hiện khi bạn có địa điểm."
                    action={<Button asChild><Link to="/builder/new"><Plus />Tạo địa điểm</Link></Button>} />
            </Page>
        );
    }

    return (
        <Page>
            <div className="flex items-center gap-2">
                {venues ? (
                    <Select value={venue ? String(venue.id) : undefined} onValueChange={v => setVenueId(Number(v))}>
                        <SelectTrigger className="w-full max-w-sm" aria-label="Địa điểm"><SelectValue /></SelectTrigger>
                        <SelectContent>{venues.map(v => <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>)}</SelectContent>
                    </Select>
                ) : <Skeleton className="h-9 w-full max-w-sm" />}
                {venue && <VenueBadge status={venue.status} />}
            </div>

            {error ? <ErrorState error={error} onRetry={retry} /> : (
                <>
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4" aria-busy={loading || !venues || undefined}>
                        {summary ? (
                            <>
                                <Stat icon={<Building2 />} tone="blue" label="Toà nhà" value={summary.rows.length} hint={summary.rows.map(r => r.code).join(", ") || "Chưa có"} />
                                <Stat icon={<Layers />} tone="green" label="Tầng" value={summary.bundle.floors.length} hint={`${summary.withPlan}/${summary.bundle.floors.length} có mặt bằng`} />
                                <Stat icon={<MapPin />} tone="amber" label="Điểm quan tâm" value={summary.bundle.locations.length.toLocaleString("vi-VN")}
                                    hint={summary.blocked ? <span className="text-warning">{summary.blocked} điểm chưa tới được</span> : "Đều tới được"} />
                            </>
                        ) : [0, 1, 2].map(i => <StatSkeleton key={i} />)}
                        <Stat icon={<QrCode />} tone="violet" label="Mã QR định vị" value={<span className="text-muted-foreground" aria-label="Không có số liệu">—</span>} hint="Chưa khả dụng" />
                    </div>

                    <Section title="Theo toà nhà" flush>
                        <Table aria-busy={!summary || undefined}>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="pl-6">Toà nhà</TableHead>
                                    <TableHead className="text-right">Tầng</TableHead>
                                    <TableHead className="text-right">Điểm</TableHead>
                                    <TableHead className="w-64 pr-6">Điểm tới được</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {!summary ? [0, 1, 2].map(i => (
                                    <TableRow key={i}>
                                        <TableCell className="pl-6"><Skeleton className="h-4 w-40" /></TableCell>
                                        <TableCell><Skeleton className="ml-auto h-4 w-6" /></TableCell>
                                        <TableCell><Skeleton className="ml-auto h-4 w-8" /></TableCell>
                                        <TableCell className="pr-6"><Skeleton className="h-2 w-40" /></TableCell>
                                    </TableRow>
                                )) : summary.rows.length === 0 ? (
                                    <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">Chưa có toà nhà.</TableCell></TableRow>
                                ) : summary.rows.map(r => (
                                    <TableRow key={r.id}>
                                        <TableCell className="pl-6"><span className="mr-2 font-medium">{r.code}</span><span className="text-muted-foreground">{r.name}</span></TableCell>
                                        <TableCell className="text-right tabular-nums">{r.floors}</TableCell>
                                        <TableCell className="text-right tabular-nums">{r.points.toLocaleString("vi-VN")}</TableCell>
                                        <TableCell className="pr-6">
                                            {r.reach == null ? <span className="text-muted-foreground">Chưa có điểm trên bản đồ</span> : (
                                                <div className="flex items-center gap-3">
                                                    <Progress value={r.reach} className="h-1.5 w-32" aria-label={`${r.code}: ${r.reach}% điểm tới được`} />
                                                    <span className={`tabular-nums ${r.reach === 100 ? "" : "text-warning"}`}>{r.reach}%</span>
                                                </div>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Section>
                </>
            )}

            <Section title="Thống kê sử dụng">
                <div className="grid gap-6">
                    <Alert>
                        <Clock />
                        <AlertTitle>Chưa khả dụng</AlertTitle>
                        <AlertDescription>Cần hệ thống ghi nhận sự kiện ẩn danh của khách.</AlertDescription>
                    </Alert>
                    <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
                        {USAGE.map(({ label, icon: Icon }) => (
                            <div key={label} className="flex items-center gap-3">
                                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Icon className="size-4" /></span>
                                <div className="min-w-0">
                                    <dt className="text-xs text-muted-foreground">{label}</dt>
                                    <dd className="text-lg font-semibold text-muted-foreground" aria-label="Không có số liệu">—</dd>
                                </div>
                            </div>
                        ))}
                    </dl>
                </div>
            </Section>
        </Page>
    );
}

// ---------------------------------------------------------------- tài khoản
export function AccountTabs({ current }: { current: "profile" | "notifications" }) {
    return (
        <Tabs value={current}>
            <TabsList aria-label="Mục tài khoản">
                <TabsTrigger value="profile" asChild><Link to="/builder/account">Hồ sơ</Link></TabsTrigger>
                <TabsTrigger value="notifications" asChild><Link to="/builder/notifications">Thông báo</Link></TabsTrigger>
            </TabsList>
        </Tabs>
    );
}

function UserStatusBadge({ status }: { status?: string }) {
    if (status === "ACTIVE") return <Badge className="gap-1 bg-success/10 text-success"><CircleCheck />Hoạt động</Badge>;
    if (status === "PENDING") return <Badge className="gap-1 bg-warning/10 text-warning"><Clock />Chờ duyệt</Badge>;
    return <Badge className="bg-destructive/10 text-destructive">Bị khoá</Badge>;
}

export function AccountPage() {
    const { user, setUser } = useAuth();
    const { busy, run } = useAction();
    const [name, setName] = useState(user?.fullName ?? "");
    const [saved, setSaved] = useState(false);
    const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
    const [pwBusy, setPwBusy] = useState(false);
    const [pwError, setPwError] = useState<{ current?: string; form?: string } | null>(null);
    const [pwDone, setPwDone] = useState(false);
    const weak = pw.next.length > 0 && (pw.next.length < 8 || !/[a-zA-Z]/.test(pw.next) || !/\d/.test(pw.next));
    const mismatch = pw.confirm.length > 0 && pw.confirm !== pw.next;

    const saveName = async (e: FormEvent) => {
        e.preventDefault();
        const result = await run(() => authApi.updateProfile(name.trim()));
        if (result) {
            setUser(result);
            setSaved(true);
        }
    };
    const savePassword = async (e: FormEvent) => {
        e.preventDefault();
        if (weak || mismatch || !pw.next) return;
        setPwBusy(true);
        setPwError(null);
        setPwDone(false);
        try {
            await authApi.changePassword(pw.current, pw.next);
            setPw({ current: "", next: "", confirm: "" });
            setPwDone(true);
        } catch (err) {
            const message = (err as Error).message || "Có lỗi xảy ra";
            if (err instanceof ApiError && err.status === 400 && /hiện tại/i.test(message)) setPwError({ current: message });
            else setPwError({ form: message });
        } finally {
            setPwBusy(false);
        }
    };

    if (!user) return null;
    const dirty = name.trim() !== user.fullName;
    const role = user.role === "SYSTEM_ADMIN" ? "Quản trị hệ thống" : "Quản trị địa điểm";
    const since = user.createdAt ? `, từ ${new Date(user.createdAt).toLocaleDateString("vi-VN")}` : "";
    const saveButton = (
        <Button type="submit" form="pf-form" disabled={busy || !name.trim() || !dirty} aria-busy={busy || undefined}>
            {busy && <LoaderCircle className="animate-spin" aria-hidden="true" />}Lưu họ tên
        </Button>
    );

    return (
        <Page width="narrow" actions={saveButton}>
            {dirty ? <HeaderStatus><SaveState state="dirty" /></HeaderStatus> : saved && <HeaderStatus><SaveState state="saved" /></HeaderStatus>}
            <AccountTabs current="profile" />

            <Section title={user.fullName} description={`${role}${since}`} actions={<UserStatusBadge status={user.status} />}>
                <form id="pf-form" onSubmit={saveName} aria-label="Thông tin cá nhân" className="grid grid-cols-2 gap-4">
                    <div className="grid content-start gap-2">
                        <Label htmlFor="pf-name">Họ và tên</Label>
                        <Input id="pf-name" type="text" autoComplete="name" required value={name} onChange={e => { setName(e.target.value); setSaved(false); }} />
                    </div>
                    <div className="grid content-start gap-2">
                        <Label htmlFor="pf-email">Email đăng nhập</Label>
                        <Input id="pf-email" type="text" value={user.email} disabled aria-describedby="em-h" />
                        <p id="em-h" className="text-xs text-muted-foreground">Không đổi được.</p>
                    </div>
                </form>
            </Section>

            <Section title="Đổi mật khẩu">
                <form onSubmit={savePassword} aria-label="Đổi mật khẩu" className="grid gap-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid content-start gap-2">
                            <Label htmlFor="pw-cur">Mật khẩu hiện tại</Label>
                            <Input id="pw-cur" type="password" autoComplete="current-password" required value={pw.current}
                                aria-invalid={pwError?.current ? true : undefined} aria-describedby={pwError?.current ? "pw-err" : undefined}
                                onChange={e => { setPw(p => ({ ...p, current: e.target.value })); setPwError(null); }} />
                            {pwError?.current && <p id="pw-err" className="flex items-center gap-1.5 text-xs text-destructive"><CircleAlert className="size-3.5" aria-hidden="true" />{pwError.current}</p>}
                        </div>
                        <div className="col-start-1 grid content-start gap-2">
                            <Label htmlFor="pw-new">Mật khẩu mới</Label>
                            <Input id="pw-new" type="password" autoComplete="new-password" required value={pw.next} aria-invalid={weak || undefined} aria-describedby="pw-h"
                                onChange={e => { setPw(p => ({ ...p, next: e.target.value })); setPwDone(false); }} />
                            <p id="pw-h" className={`text-xs ${weak ? "text-destructive" : "text-muted-foreground"}`}>Ít nhất 8 ký tự, có chữ và số</p>
                        </div>
                        <div className="grid content-start gap-2">
                            <Label htmlFor="pw-rep">Nhập lại mật khẩu mới</Label>
                            <Input id="pw-rep" type="password" autoComplete="new-password" required value={pw.confirm} aria-invalid={mismatch || undefined}
                                aria-describedby={mismatch ? "pw-rep-err" : undefined} onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))} />
                            {mismatch && <p id="pw-rep-err" className="text-xs text-destructive">Chưa khớp</p>}
                        </div>
                    </div>
                    <div className="flex items-center justify-end gap-3">
                        {pwDone && <span role="status" className="flex items-center gap-1.5 text-xs text-success"><Check className="size-3.5" aria-hidden="true" />Đã đổi mật khẩu</span>}
                        {(pwError?.current || pwError?.form) && <span role="alert" className="text-xs font-medium text-destructive">{pwError.form ?? "Chưa đổi được mật khẩu"}</span>}
                        <Button type="submit" variant="outline" disabled={pwBusy || weak || mismatch || !pw.current || !pw.next || !pw.confirm} aria-busy={pwBusy || undefined}>
                            {pwBusy && <LoaderCircle className="animate-spin" aria-hidden="true" />}Đổi mật khẩu
                        </Button>
                    </div>
                </form>
            </Section>
        </Page>
    );
}
