import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowUp, Building2, CircleCheck, Layers, Map as MapIcon, MapPin, MoreHorizontal, Pencil, Plus, Spline, Trash2, TriangleAlert } from "lucide-react";
import { floorWord, type BuildingDto, type FloorDto } from "@indoor-map/core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { planApi } from "../../console/api";
import { EmptyState, Page, Section, Stat } from "../../console/page";
import { useAction } from "../../console/ui";
import { useWorkspace } from "../Workspace";

type Modal =
    | { kind: "building"; id?: number; code: string; name: string }
    | { kind: "floor"; id?: number; level: string; name: string }
    | { kind: "deleteBuilding"; typed: string }
    | { kind: "deleteFloor"; floor: FloorDto }
    | null;

/** Số mã QR đã chọn (lưu tạm trên trình duyệt, xem QrPage) */
function qrIds(venueId: number): string[] {
    try {
        return (JSON.parse(localStorage.getItem(`indoor-map.qr.${venueId}`) || "{}") as { selected?: string[] }).selected ?? [];
    } catch {
        return [];
    }
}

function PlanBadge({ floor }: { floor: FloorDto }) {
    if (!floor.plan) return <Badge className="gap-1 bg-warning/10 text-warning"><TriangleAlert />Chưa có mặt bằng</Badge>;
    if (!floor.plan.anchor) return <Badge className="gap-1 bg-warning/10 text-warning"><TriangleAlert />Chưa chấm mốc</Badge>;
    return <Badge className="gap-1 bg-success/10 text-success"><CircleCheck />Đã căn chỉnh</Badge>;
}

// Toà nhà và tầng: danh sách toà (sắp thứ tự), lối nối giữa toà, số liệu và bảng tầng của toà đang chọn.
export default function BuildingsPage() {
    const { venueId, data, model, reload } = useWorkspace();
    const { busy, run } = useAction();
    const buildings = useMemo(() => [...data.buildings].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id - b.id), [data.buildings]);
    const [selectedId, setSelectedId] = useState<number | null>(buildings[0]?.id ?? null);
    const building = buildings.find(b => b.id === selectedId) ?? buildings[0];
    const floors = building ? data.floors.filter(f => f.buildingId === building.id).sort((a, b) => b.level - a.level) : [];
    const [modal, setModal] = useState<Modal>(null);
    const [qr] = useState(() => new Set(qrIds(venueId)));
    const base = `/builder/v/${venueId}`;

    const floorIds = new Set(floors.map(f => f.id));
    const buildingNodes = data.walkways.nodes.filter(n => floorIds.has(n.floorId));
    const buildingPlaces = floors.reduce((s, f) => s + (model.locationCount.get(f.id) ?? 0), 0);
    const buildingQr = buildingNodes.filter(n => qr.has(n.id)).length;

    // Lối nối giữa toà: cạnh lối đi có hai đầu ở hai toà khác nhau
    const links = useMemo(() => {
        const buildingOf = new Map(data.floors.map(f => [f.id, f.buildingId]));
        const nodeBuilding = new Map(data.walkways.nodes.map(n => [n.id, buildingOf.get(n.floorId)]));
        const count = new Map<string, number>();
        for (const e of data.walkways.edges) {
            const a = nodeBuilding.get(e.from);
            const b = nodeBuilding.get(e.to);
            if (a == null || b == null || a === b) continue;
            const key = a < b ? `${a}|${b}` : `${b}|${a}`;
            count.set(key, (count.get(key) ?? 0) + 1);
        }
        const pairs: { a: BuildingDto; b: BuildingDto; n: number }[] = [];
        const seen = new Set<string>();
        for (const [key, n] of count) {
            const [x, y] = key.split("|").map(Number) as [number, number];
            const a = buildings.find(b => b.id === x);
            const b = buildings.find(c => c.id === y);
            if (a && b) pairs.push({ a, b, n });
            seen.add(key);
        }
        for (let i = 1; i < buildings.length; i++) {
            const a = buildings[i - 1]!;
            const b = buildings[i]!;
            const key = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
            if (!seen.has(key)) pairs.push({ a, b, n: 0 });
        }
        return pairs;
    }, [data.floors, data.walkways, buildings]);

    const move = async (index: number, dir: -1 | 1) => {
        const order = [...buildings];
        const other = order[index + dir];
        const current = order[index];
        if (!other || !current) return;
        order[index] = other;
        order[index + dir] = current;
        const done = await run(async () => {
            for (const [i, b] of order.entries()) if ((b.sortOrder ?? 0) !== i + 1) await planApi.updateBuilding(venueId, b.id, { ...b, sortOrder: i + 1 });
            return true;
        });
        if (done) await reload("buildings", "floors");
    };

    const saveBuilding = async (e: FormEvent) => {
        e.preventDefault();
        if (modal?.kind !== "building") return;
        const dto = { code: modal.code.trim(), name: modal.name.trim() };
        const target = modal.id ? buildings.find(b => b.id === modal.id) : undefined;
        const saved = await run(() => (target ? planApi.updateBuilding(venueId, target.id, { ...target, ...dto }) : planApi.createBuilding(venueId, { ...dto, sortOrder: buildings.length + 1 })),
            target ? "Đã lưu toà nhà" : "Đã thêm toà nhà");
        if (saved) {
            setModal(null);
            await reload("buildings", "floors", "venue");
            setSelectedId(saved.id);
        }
    };

    const saveFloor = async (e: FormEvent) => {
        e.preventDefault();
        if (modal?.kind !== "floor" || !building) return;
        const level = Number(modal.level);
        const name = modal.name.trim() || floorWord(level);
        const target = modal.id ? floors.find(f => f.id === modal.id) : undefined;
        const saved = await run(() => (target
            ? planApi.updateFloor(venueId, target.id, { buildingId: target.buildingId, level, name })
            : planApi.createFloor(venueId, { buildingId: building.id, level, name })), target ? "Đã lưu tầng" : "Đã thêm tầng");
        if (saved) {
            setModal(null);
            await reload("floors", "venue");
        }
    };

    const removeFloor = async (floor: FloorDto) => {
        if (await run(() => planApi.removeFloor(venueId, floor.id), "Đã xoá tầng") !== null) {
            setModal(null);
            await reload("floors", "locations", "zones", "walkways", "venue");
        }
    };

    const removeBuilding = async () => {
        if (!building) return;
        if (await run(() => planApi.removeBuilding(venueId, building.id), "Đã xoá toà nhà") !== null) {
            setModal(null);
            setSelectedId(null);
            await reload();
        }
    };

    const addBuilding = <Button onClick={() => setModal({ kind: "building", code: "", name: "" })}><Plus />Thêm toà nhà</Button>;
    const close = (open: boolean) => !open && setModal(null);

    return (
        <Page actions={addBuilding}>
            {!building ? (
                <EmptyState icon={<Building2 />} title="Chưa có toà nhà" description="Mỗi địa điểm gồm một hoặc nhiều toà nhà, mỗi toà có các tầng." action={addBuilding} />
            ) : (
                <div className="grid items-start gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
                    <div className="flex flex-col gap-4">
                        <nav aria-label="Toà nhà" className="rounded-xl border bg-card p-1">
                            {buildings.map((b, i) => {
                                const cur = b.id === building.id;
                                return (
                                    <div key={b.id} className={`group flex items-center rounded-lg ${cur ? "bg-primary/10 text-primary" : "hover:bg-muted/60"}`}>
                                        <button type="button" aria-current={cur} onClick={() => setSelectedId(b.id)}
                                            className="flex h-9 min-w-0 flex-1 items-center gap-2 px-2 text-left text-sm">
                                            <span className={`w-7 shrink-0 text-xs font-medium ${cur ? "" : "text-muted-foreground"}`}>{b.code}</span>
                                            <span className={`truncate ${cur ? "font-medium" : ""}`}>{b.name}</span>
                                        </button>
                                        <div className={`flex pr-1 ${cur ? "" : "opacity-0 group-hover:opacity-100 focus-within:opacity-100"}`}>
                                            <Button variant="ghost" size="icon" className="size-7" aria-label={`Đưa ${b.code} lên`} disabled={i === 0 || busy} onClick={() => void move(i, -1)}><ArrowUp /></Button>
                                            <Button variant="ghost" size="icon" className="size-7" aria-label={`Đưa ${b.code} xuống`} disabled={i === buildings.length - 1 || busy} onClick={() => void move(i, 1)}><ArrowDown /></Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </nav>
                        {buildings.length > 1 && (
                            <div className="rounded-xl border bg-card">
                                <div className="flex items-center justify-between border-b px-4 py-3">
                                    <h2 className="text-sm font-medium">Lối nối giữa toà</h2>
                                    <Button asChild variant="link" size="sm" className="h-auto px-0"><Link to={`${base}/walkways`}>Sửa</Link></Button>
                                </div>
                                <ul className="divide-y text-sm">
                                    {links.map(({ a, b, n }) => (
                                        <li key={`${a.id}-${b.id}`} className="flex items-center justify-between px-4 py-2">
                                            <span>{a.code} – {b.code}</span>
                                            {n ? <span className="text-muted-foreground tabular-nums">{n} lối</span>
                                                : <span className="inline-flex items-center gap-1 text-warning"><TriangleAlert className="size-3.5" />Chưa nối</span>}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>

                    <div className="flex min-w-0 flex-col gap-6">
                        <div className="flex items-center justify-between gap-4">
                            <h2 className="truncate text-lg font-semibold"><span className="mr-2 text-muted-foreground">{building.code}</span>{building.name}</h2>
                            <Button variant="outline" size="sm" onClick={() => setModal({ kind: "building", id: building.id, code: building.code, name: building.name })}><Pencil />Sửa tên</Button>
                        </div>
                        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                            <Stat icon={<Layers />} tone="blue" label="Tầng" value={floors.length} />
                            <Stat icon={<MapIcon />} tone="green" label="Có mặt bằng" value={`${floors.filter(f => f.plan?.anchor).length}/${floors.length}`} />
                            <Stat icon={<MapPin />} tone="amber" label="Điểm quan tâm" value={buildingPlaces.toLocaleString("vi-VN")} />
                            <Stat icon={<Spline />} tone="violet" label="Nút lối đi" value={buildingNodes.length.toLocaleString("vi-VN")} />
                        </div>

                        <Section title="Tầng" flush actions={<Button variant="outline" size="sm" onClick={() => setModal({ kind: "floor", level: "", name: "" })}><Plus />Thêm tầng</Button>}>
                            {floors.length ? (
                                <Table>
                                    <TableHeader className="bg-muted/50">
                                        <TableRow>
                                            <TableHead className="w-16 pl-6">Mức</TableHead>
                                            <TableHead>Tên tầng</TableHead>
                                            <TableHead>Mặt bằng</TableHead>
                                            <TableHead className="text-right">Điểm</TableHead>
                                            <TableHead className="text-right">Nút lối đi</TableHead>
                                            <TableHead className="w-0"><span className="sr-only">Thao tác</span></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {floors.map(f => (
                                            <TableRow key={f.id}>
                                                <TableCell className="pl-6 text-muted-foreground tabular-nums">{f.level > 0 ? `+${f.level}` : f.level}</TableCell>
                                                <TableCell className="font-medium">{f.name}</TableCell>
                                                <TableCell><PlanBadge floor={f} /></TableCell>
                                                <TableCell className="text-right tabular-nums">{model.locationCount.get(f.id) ?? 0}</TableCell>
                                                <TableCell className="text-right tabular-nums">{data.walkways.nodes.filter(n => n.floorId === f.id).length}</TableCell>
                                                <TableCell className="pr-6">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Button asChild variant="outline" size="sm"><Link to={`${base}/plan?floor=${f.id}`}>{f.plan ? "Căn chỉnh" : "Tải bản vẽ"}</Link></Button>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="size-8" aria-label={`Thao tác khác với ${f.name}`}><MoreHorizontal /></Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="w-52">
                                                                <DropdownMenuItem asChild><Link to={`${base}/editor?floor=${f.id}`}><MapPin />Sửa điểm và vùng</Link></DropdownMenuItem>
                                                                <DropdownMenuItem asChild><Link to={`${base}/walkways?floor=${f.id}`}><Spline />Sửa lối đi</Link></DropdownMenuItem>
                                                                <DropdownMenuItem onSelect={() => setModal({ kind: "floor", id: f.id, level: String(f.level), name: f.name })}><Layers />Đổi tên, mức tầng</DropdownMenuItem>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem variant="destructive" onSelect={() => setModal({ kind: "deleteFloor", floor: f })}><Trash2 />Xoá tầng…</DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            ) : (
                                <p className="px-6 py-10 text-center text-sm text-muted-foreground">{building.code} chưa có tầng. Thêm tầng rồi tải bản vẽ mặt bằng cho từng tầng.</p>
                            )}
                        </Section>

                        <div className="flex items-center justify-between gap-4 rounded-xl border border-destructive/30 px-6 py-4">
                            <div className="min-w-0">
                                <p className="text-sm font-medium">Xoá toà nhà {building.code}</p>
                                <p className="text-sm text-muted-foreground">Xoá cùng {floors.length} tầng, {buildingPlaces} điểm{buildingQr ? `, ${buildingQr} mã QR` : ""}.</p>
                            </div>
                            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setModal({ kind: "deleteBuilding", typed: "" })}><Trash2 />Xoá toà nhà…</Button>
                        </div>
                    </div>
                </div>
            )}

            <Dialog open={modal?.kind === "building"} onOpenChange={close}>
                <DialogContent className="sm:max-w-md">
                    {modal?.kind === "building" && (
                        <form onSubmit={e => void saveBuilding(e)} className="grid gap-4">
                            <DialogHeader>
                                <DialogTitle>{modal.id ? "Sửa toà nhà" : "Thêm toà nhà"}</DialogTitle>
                                <DialogDescription>Mã ngắn hiện trên bản đồ và chỉ dẫn, ví dụ T1.</DialogDescription>
                            </DialogHeader>
                            <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3">
                                <div className="grid gap-2"><Label htmlFor="bld-code">Mã</Label><Input id="bld-code" maxLength={20} required placeholder="T1" value={modal.code} onChange={e => setModal({ ...modal, code: e.target.value.toUpperCase() })} /></div>
                                <div className="grid gap-2"><Label htmlFor="bld-name">Tên toà nhà</Label><Input id="bld-name" required placeholder="Ga nội địa" value={modal.name} onChange={e => setModal({ ...modal, name: e.target.value })} /></div>
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setModal(null)}>Huỷ</Button>
                                <Button type="submit" disabled={busy || !modal.code.trim() || !modal.name.trim()}>{modal.id ? "Lưu" : "Thêm toà nhà"}</Button>
                            </DialogFooter>
                        </form>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={modal?.kind === "floor"} onOpenChange={close}>
                <DialogContent className="sm:max-w-md">
                    {modal?.kind === "floor" && building && (
                        <form onSubmit={e => void saveFloor(e)} className="grid gap-4">
                            <DialogHeader>
                                <DialogTitle>{modal.id ? "Đổi tên, mức tầng" : `Thêm tầng vào ${building.code}`}</DialogTitle>
                                <DialogDescription>Trệt là 0, hầm là −1. Mức dùng để biết lên hay xuống khi đổi tầng.</DialogDescription>
                            </DialogHeader>
                            <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3">
                                <div className="grid gap-2"><Label htmlFor="fl-level">Mức</Label><Input id="fl-level" inputMode="numeric" required placeholder="1" value={modal.level} onChange={e => setModal({ ...modal, level: e.target.value.replace("+", "") })} /></div>
                                <div className="grid gap-2"><Label htmlFor="fl-name">Tên tầng</Label><Input id="fl-name" placeholder={modal.level !== "" && !Number.isNaN(Number(modal.level)) ? floorWord(Number(modal.level)) : "Tầng 1"} value={modal.name} onChange={e => setModal({ ...modal, name: e.target.value })} /></div>
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setModal(null)}>Huỷ</Button>
                                <Button type="submit" disabled={busy || modal.level === "" || Number.isNaN(Number(modal.level))}>{modal.id ? "Lưu" : "Thêm tầng"}</Button>
                            </DialogFooter>
                        </form>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={modal?.kind === "deleteFloor"} onOpenChange={close}>
                <DialogContent className="sm:max-w-md">
                    {modal?.kind === "deleteFloor" && (
                        <>
                            <DialogHeader>
                                <DialogTitle>Xoá {modal.floor.name}?</DialogTitle>
                                <DialogDescription>Không hoàn tác được. {model.locationCount.get(modal.floor.id) ?? 0} điểm, các vùng và lối đi của tầng này cũng bị xoá.</DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setModal(null)}>Huỷ</Button>
                                <Button variant="destructive" disabled={busy} onClick={() => void removeFloor(modal.floor)}>Xoá tầng</Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={modal?.kind === "deleteBuilding"} onOpenChange={close}>
                <DialogContent className="sm:max-w-md">
                    {modal?.kind === "deleteBuilding" && building && (
                        <>
                            <DialogHeader>
                                <DialogTitle>Xoá toà nhà {building.code}?</DialogTitle>
                                <DialogDescription>Không hoàn tác được. Toàn bộ dữ liệu bên trong toà bị xoá.</DialogDescription>
                            </DialogHeader>
                            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 rounded-lg border px-4 py-3 text-sm">
                                <dt className="text-muted-foreground">Tầng (kèm mặt bằng)</dt><dd className="text-right font-medium tabular-nums">{floors.length}</dd>
                                <dt className="text-muted-foreground">Điểm quan tâm (kèm vùng)</dt><dd className="text-right font-medium tabular-nums">{buildingPlaces}</dd>
                                <dt className="text-muted-foreground">Nút lối đi</dt><dd className="text-right font-medium tabular-nums">{buildingNodes.length}</dd>
                                {buildingQr > 0 && <><dt className="text-destructive">Mã QR hết hiệu lực</dt><dd className="text-right font-medium text-destructive tabular-nums">{buildingQr}</dd></>}
                            </dl>
                            <div className="grid gap-2">
                                <Label htmlFor="del-confirm">Gõ <span className="font-semibold">{building.code}</span> để xác nhận</Label>
                                <Input id="del-confirm" autoComplete="off" spellCheck={false} placeholder={building.code} value={modal.typed} onChange={e => setModal({ ...modal, typed: e.target.value })} />
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setModal(null)}>Huỷ</Button>
                                <Button variant="destructive" disabled={busy || modal.typed.trim() !== building.code} onClick={() => void removeBuilding()}>Xoá vĩnh viễn</Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </Page>
    );
}
