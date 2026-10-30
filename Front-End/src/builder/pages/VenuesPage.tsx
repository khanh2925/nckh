import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, ExternalLink, Lock, MoreHorizontal, Plus, QrCode, Route, Search, Settings } from "lucide-react";
import type { VenueDto } from "@indoor-map/core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { venueApi } from "../../console/api";
import { EmptyState, ErrorState, Page } from "../../console/page";

// eslint-disable-next-line react-refresh/only-export-components
export const KIND_LABEL: Record<string, string> = {
    airport: "Sân bay", hospital: "Bệnh viện", school: "Trường học", mall: "Trung tâm thương mại", park: "Công viên", office: "Văn phòng", other: "Khác"
};

function StatusBadge({ status }: { status?: string }) {
    if (status === "PUBLISHED") {
        return <Badge className="gap-1.5 bg-success/10 text-success"><span className="size-1.5 rounded-full bg-success" aria-hidden="true" />Công khai</Badge>;
    }
    if (status === "HIDDEN") return <Badge className="gap-1.5 bg-destructive/10 text-destructive"><span className="size-1.5 rounded-full bg-destructive" aria-hidden="true" />Bị ẩn</Badge>;
    return <Badge className="gap-1.5 bg-warning/10 text-warning"><span className="size-1.5 rounded-full bg-warning" aria-hidden="true" />Bản nháp</Badge>;
}

// Tiến độ dựng: chỉ các mục đọc được từ danh sách địa điểm (số toà nhà, tầng, điểm, trạng thái)
const STEPS: { label: string; done: (v: VenueDto) => boolean; path: string }[] = [
    { label: "Toà nhà", done: v => (v.buildingCount ?? 0) > 0, path: "buildings" },
    { label: "Tầng", done: v => (v.floorCount ?? 0) > 0, path: "buildings" },
    { label: "Điểm", done: v => (v.locationCount ?? 0) > 0, path: "editor" },
    { label: "Xuất bản", done: v => v.status === "PUBLISHED", path: "publish" }
];

function Progress({ venue }: { venue: VenueDto }) {
    const states = STEPS.map(s => s.done(venue));
    const done = states.filter(Boolean).length;
    const next = STEPS[states.indexOf(false)];
    return (
        <div className="flex items-center gap-3" title={next ? `Còn: ${next.label.toLowerCase()}` : "Đã xong các bước"}>
            <div className="flex gap-0.5" aria-hidden="true">
                {states.map((ok, i) => <span key={i} className={`h-1.5 w-5 rounded-full ${ok ? "bg-primary" : "bg-primary/15"}`} />)}
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">{done}/{STEPS.length}</span>
            <span className="sr-only">{STEPS.map((s, i) => `${s.label}: ${states[i] ? "xong" : "chưa xong"}`).join(", ")}</span>
        </div>
    );
}

function nextLink(v: VenueDto): string {
    const base = `/builder/v/${v.id}`;
    if (v.status === "HIDDEN") return `${base}/settings`;
    const next = STEPS.find(s => !s.done(v));
    return `${base}/${next?.path ?? "buildings"}`;
}

function RowMenu({ venue }: { venue: VenueDto }) {
    const base = `/builder/v/${venue.id}`;
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8" aria-label={`Thao tác khác với ${venue.name}`}><MoreHorizontal /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild><Link to={`${base}/test`}><Route />Thử chỉ đường</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link to={`${base}/qr`}><QrCode />Mã QR định vị</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link to={`${base}/settings`}><Settings />Cài đặt địa điểm</Link></DropdownMenuItem>
                {venue.status === "PUBLISHED" && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild><a href={`/v/${venue.slug}/map`} target="_blank" rel="noreferrer"><ExternalLink />Xem như khách</a></DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function LoadingRows() {
    return (
        <>
            {[0, 1, 2].map(i => (
                <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-48" /><Skeleton className="mt-2 h-3 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-2 w-28" /></TableCell>
                    <TableCell><Skeleton className="ml-auto h-4 w-6" /></TableCell>
                    <TableCell><Skeleton className="ml-auto h-4 w-6" /></TableCell>
                    <TableCell><Skeleton className="ml-auto h-4 w-8" /></TableCell>
                    <TableCell />
                </TableRow>
            ))}
        </>
    );
}

export default function VenuesPage() {
    const [venues, setVenues] = useState<VenueDto[] | null>(null);
    const [error, setError] = useState<unknown>(null);
    const [attempt, setAttempt] = useState(0);
    const [query, setQuery] = useState("");

    useEffect(() => {
        let alive = true;
        venueApi.mine().then(list => {
            if (!alive) return;
            setVenues(list);
            setError(null);
        }).catch(e => alive && setError(e));
        return () => {
            alive = false;
        };
    }, [attempt]);

    const shown = useMemo(() => {
        const q = query.trim().toLowerCase();
        return venues?.filter(v => !q || v.name.toLowerCase().includes(q) || v.slug.includes(q)) ?? null;
    }, [venues, query]);

    const create = <Button asChild><Link to="/builder/new"><Plus />Tạo địa điểm</Link></Button>;

    return (
        <Page actions={create}>
            {error ? <ErrorState error={error} onRetry={() => setAttempt(a => a + 1)} />
                : venues && venues.length === 0 ? (
                    <EmptyState icon={<Building2 />} title="Chưa có địa điểm nào" description="Bắt đầu bằng tên và phạm vi của địa điểm." action={create} />
                ) : (
                    <div className="flex flex-col gap-4">
                        <div className="relative w-full max-w-sm">
                            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm theo tên hoặc đường dẫn" aria-label="Tìm địa điểm" className="pl-9" />
                        </div>
                        <div className="overflow-hidden rounded-xl border">
                            <Table aria-busy={!venues || undefined}>
                                <TableHeader className="bg-muted/50">
                                    <TableRow>
                                        <TableHead className="pl-4">Địa điểm</TableHead>
                                        <TableHead>Trạng thái</TableHead>
                                        <TableHead>Tiến độ dựng</TableHead>
                                        <TableHead className="text-right">Toà nhà</TableHead>
                                        <TableHead className="text-right">Tầng</TableHead>
                                        <TableHead className="text-right">Điểm</TableHead>
                                        <TableHead className="w-0"><span className="sr-only">Thao tác</span></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {!shown ? <LoadingRows /> : shown.length === 0 ? (
                                        <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">Không có địa điểm khớp “{query}”.</TableCell></TableRow>
                                    ) : shown.map(v => (
                                        <TableRow key={v.id}>
                                            <TableCell className="pl-4">
                                                <Link to={`/builder/v/${v.id}/buildings`} className="font-medium hover:underline underline-offset-4">{v.name}</Link>
                                                <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                                                    <span>{KIND_LABEL[v.kind ?? "other"] ?? v.kind}</span>
                                                    <span aria-hidden="true">/</span>
                                                    <span>/v/{v.slug}</span>
                                                    {v.status === "PUBLISHED" && <Lock className="size-3" aria-label="Đường dẫn đã khoá sau lần xuất bản đầu" />}
                                                </div>
                                            </TableCell>
                                            <TableCell><StatusBadge status={v.status} /></TableCell>
                                            <TableCell><Progress venue={v} /></TableCell>
                                            <TableCell className="text-right tabular-nums">{v.buildingCount ?? 0}</TableCell>
                                            <TableCell className="text-right tabular-nums">{v.floorCount ?? 0}</TableCell>
                                            <TableCell className="text-right tabular-nums">{v.locationCount ?? 0}</TableCell>
                                            <TableCell className="pr-4">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button asChild variant="outline" size="sm"><Link to={nextLink(v)}>Mở</Link></Button>
                                                    <RowMenu venue={v} />
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                )}
        </Page>
    );
}
