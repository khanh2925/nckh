import { useMemo, useState, type FormEvent } from "react";
import { groupLabel, type FacilityDto, type LocationTypeDto } from "@indoor-map/core";
import { Copy, MoreHorizontal, MousePointer2, Pencil, Plus, Trash2, TriangleAlert } from "lucide-react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { catalogApi, locationApi } from "../../console/api";
import { Page } from "../../console/page";
import { COLORS, ICONS, useAction, useFeedback } from "../../console/ui";
import { useWorkspace } from "../Workspace";

const GROUPS = ["gate", "procedure", "food", "service", "restroom", "transport", "health", "study", "office", "leisure"];
/** Tên các màu marker (màu dữ liệu, cùng thứ tự với COLORS trong console/ui) */
const COLOR_NAMES = ["Đỏ gạch", "Xanh lam", "Tím", "Cam đất", "Hồng đậm", "Xanh két", "Xanh lá", "Nâu", "Xám xanh", "Xám than", "Tím nhạt", "Xám"];
const EMPTY: Partial<LocationTypeDto> = { code: "", name: "", icon: "bi-geo-alt", color: COLORS[1], groupName: "service" };
const colorName = (c?: string) => {
    const i = COLORS.indexOf((c ?? "").toLowerCase());
    return i >= 0 ? COLOR_NAMES[i] ?? c ?? "" : c ?? "";
};

function TypeTile({ color, icon }: { color?: string; icon?: string }) {
    return (
        <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-md text-xs text-white" style={{ background: color || "var(--muted-foreground)" }}>
            <i className={`bi ${icon || "bi-geo-alt"}`} />
        </span>
    );
}

function Idle({ text }: { text: string }) {
    return (
        <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
            <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground"><MousePointer2 className="size-5" /></span>
            <p className="text-sm text-muted-foreground">{text}</p>
        </div>
    );
}

// Loại điểm (màu, biểu tượng, nhóm lọc) và tiện ích của địa điểm
export default function TypesPage() {
    const { venueId, data, model, reload } = useWorkspace();
    const { confirm } = useFeedback();
    const { busy, run } = useAction();
    const [tab, setTab] = useState<"types" | "facilities">("types");
    const [form, setForm] = useState<Partial<LocationTypeDto> | null>(null);
    const [facilityName, setFacilityName] = useState("");
    const [editingFacility, setEditingFacility] = useState<FacilityDto | null>(null);
    const [removing, setRemoving] = useState<{ type: LocationTypeDto; to: string } | null>(null);
    const counts = useMemo(() => {
        const map = new Map<string, number>();
        model.locations.forEach(l => map.set(l.type ?? "other", (map.get(l.type ?? "other") ?? 0) + 1));
        return map;
    }, [model]);
    const types = [...data.types].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const facilityUse = useMemo(() => {
        const map = new Map<string, number>();
        data.locations.forEach(l => l.facilities?.forEach(f => map.set(f, (map.get(f) ?? 0) + 1)));
        return map;
    }, [data.locations]);

    const saveType = async (e: FormEvent) => {
        e.preventDefault();
        if (!form) return;
        const body = { ...form, code: form.code?.trim(), name: form.name?.trim(), sortOrder: form.sortOrder ?? types.length * 10 };
        const saved = await run(() => (form.id ? catalogApi.updateType(venueId, form.id, body) : catalogApi.createType(venueId, body)), form.id ? "Đã lưu loại" : "Đã thêm loại");
        if (saved) {
            setForm(saved);
            await reload("types");
        }
    };

    const askRemove = async (t: LocationTypeDto) => {
        if ((counts.get(t.code) ?? 0) > 0) return setRemoving({ type: t, to: "" });
        if (!(await confirm(`Xoá loại “${t.name}”?`, { danger: true, okLabel: "Xoá loại" }))) return;
        if (t.id && await run(() => catalogApi.removeType(venueId, t.id!), "Đã xoá loại") !== null) {
            setForm(null);
            await reload("types");
        }
    };
    // Loại còn điểm: chuyển các điểm sang loại thay thế rồi mới xoá
    const moveAndRemove = async () => {
        if (!removing?.to || !removing.type.id) return;
        const { type, to } = removing;
        const done = await run(async () => {
            for (const loc of data.locations.filter(l => (l.type ?? "other") === type.code)) await locationApi.update(venueId, loc.id, { ...loc, type: to });
            await catalogApi.removeType(venueId, type.id!);
            return true;
        }, "Đã chuyển điểm và xoá loại");
        if (done) {
            setRemoving(null);
            setForm(null);
        }
        await reload("types", "locations");
    };

    const copyTemplates = async () => {
        if (await run(() => catalogApi.copyTemplates(venueId), "Đã thêm các loại mẫu còn thiếu")) await reload("types");
    };
    const saveFacility = async (e: FormEvent) => {
        e.preventDefault();
        const name = (editingFacility?.name ?? facilityName).trim();
        if (!name) return;
        const saved = await run(() => (editingFacility ? catalogApi.updateFacility(venueId, editingFacility.id, name) : catalogApi.createFacility(venueId, name)), "Đã lưu tiện ích");
        if (saved) {
            setFacilityName("");
            setEditingFacility(null);
            await reload("facilities");
        }
    };
    const removeFacility = async (f: FacilityDto) => {
        if (!(await confirm(`Xoá tiện ích “${f.name}”?`, { danger: true, okLabel: "Xoá tiện ích", detail: "Tiện ích sẽ bị gỡ khỏi các điểm đang có." }))) return;
        if (await run(() => catalogApi.removeFacility(venueId, f.id), "Đã xoá tiện ích") !== null) await reload("facilities", "locations");
    };

    const colorChoices = form?.color && !COLORS.includes(form.color.toLowerCase()) ? [...COLORS, form.color] : COLORS;
    const removingCount = removing ? counts.get(removing.type.code) ?? 0 : 0;

    const actions = (
        <>
            <Button variant="outline" disabled={busy && !form} onClick={() => void copyTemplates()}><Copy />Thêm từ mẫu</Button>
            <Button onClick={() => { setTab("types"); setForm({ ...EMPTY }); }}><Plus />Thêm loại</Button>
        </>
    );

    return (
        <Page actions={actions}>
            <Tabs value={tab} onValueChange={v => setTab(v as "types" | "facilities")} className="gap-6">
                <TabsList>
                    <TabsTrigger value="types">Loại điểm<span className="text-muted-foreground tabular-nums">{types.length}</span></TabsTrigger>
                    <TabsTrigger value="facilities">Tiện ích<span className="text-muted-foreground tabular-nums">{data.facilities.length}</span></TabsTrigger>
                </TabsList>

                <TabsContent value="types" className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
                    <div className="overflow-hidden rounded-xl border">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="pl-4">Loại</TableHead>
                                    <TableHead>Mã</TableHead>
                                    <TableHead>Nhóm</TableHead>
                                    <TableHead className="text-right">Số điểm</TableHead>
                                    <TableHead className="pr-4">Màu</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {types.map(t => {
                                    const selected = form?.id != null && form.id === t.id;
                                    return (
                                        <TableRow key={t.code} tabIndex={0} aria-selected={selected} data-state={selected ? "selected" : undefined} className="cursor-pointer"
                                            onClick={() => setForm({ ...t })} onKeyDown={e => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setForm({ ...t }))}>
                                            <TableCell className="pl-4">
                                                <span className="flex items-center gap-2 font-medium"><TypeTile color={t.color} icon={t.icon} />{t.name}</span>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">{t.code}</TableCell>
                                            <TableCell>{groupLabel(t.groupName)}</TableCell>
                                            <TableCell className="text-right tabular-nums">{counts.get(t.code) ?? 0}</TableCell>
                                            <TableCell className="pr-4">
                                                <span className="flex items-center gap-2">
                                                    <span aria-hidden="true" className="size-3 rounded-sm" style={{ background: t.color || "var(--muted-foreground)" }} />
                                                    {colorName(t.color)}
                                                </span>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                                {!types.length && (
                                    <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Chưa có loại nào. Bấm Thêm từ mẫu để lấy danh mục mẫu.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    <aside aria-label={form ? `Sửa loại ${form.name ?? ""}` : "Sửa loại"} className="flex flex-col overflow-hidden rounded-xl border bg-card">
                        {form ? (
                            <form className="flex flex-col" onSubmit={e => void saveType(e)}>
                                <div className="flex items-center gap-3 border-b p-4">
                                    <TypeTile color={form.color} icon={form.icon} />
                                    <div className="min-w-0">
                                        <h2 className="truncate text-base font-semibold">{form.id ? form.name : "Loại mới"}</h2>
                                        {form.id && <p className="text-xs text-muted-foreground">{counts.get(form.code ?? "") ?? 0} điểm</p>}
                                    </div>
                                </div>
                                <div className="space-y-4 p-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="t-name">Tên</Label>
                                        <Input id="t-name" required value={form.name ?? ""} onChange={e => setForm({ ...form, name: e.target.value })} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="grid gap-2">
                                            <Label htmlFor="t-code">Mã</Label>
                                            <Input id="t-code" required pattern="[a-z0-9_]+" disabled={Boolean(form.id)} title={form.id ? "Không đổi được khi đã có dữ liệu" : "Chữ thường, số, _"}
                                                value={form.code ?? ""} onChange={e => setForm({ ...form, code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })} />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="t-grp">Nhóm</Label>
                                            <Select value={form.groupName ?? ""} onValueChange={v => setForm({ ...form, groupName: v })}>
                                                <SelectTrigger id="t-grp" className="w-full"><SelectValue placeholder="Chọn nhóm" /></SelectTrigger>
                                                <SelectContent>{GROUPS.map(g => <SelectItem key={g} value={g}>{groupLabel(g)}</SelectItem>)}</SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="grid gap-2">
                                        <div className="flex items-center justify-between">
                                            <Label id="t-color">Màu marker</Label>
                                            <span className="text-xs text-muted-foreground">{colorName(form.color)}</span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-labelledby="t-color">
                                            {colorChoices.map(c => (
                                                <button key={c} type="button" role="radio" aria-checked={(form.color ?? "").toLowerCase() === c.toLowerCase()} aria-label={colorName(c)} title={colorName(c)}
                                                    className="size-6 rounded-md ring-offset-2 ring-offset-background aria-checked:ring-2 aria-checked:ring-ring" style={{ background: c }}
                                                    onClick={() => setForm({ ...form, color: c })} />
                                            ))}
                                            <input type="color" aria-label="Màu khác" title="Màu khác" value={form.color ?? COLORS[1]} onChange={e => setForm({ ...form, color: e.target.value })}
                                                className="size-6 cursor-pointer rounded-md border bg-transparent p-0" />
                                        </div>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label id="t-icon">Biểu tượng</Label>
                                        <div className="grid grid-cols-8 gap-1" role="radiogroup" aria-labelledby="t-icon">
                                            {ICONS.map(icon => (
                                                <button key={icon} type="button" role="radio" aria-checked={form.icon === icon} aria-label={icon}
                                                    className="flex size-8 items-center justify-center rounded-md text-sm text-muted-foreground hover:bg-muted aria-checked:bg-primary aria-checked:text-primary-foreground"
                                                    onClick={() => setForm({ ...form, icon })}>
                                                    <i className={`bi ${icon}`} aria-hidden="true" />
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 border-t p-3">
                                    {form.id
                                        ? <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => void askRemove(form as LocationTypeDto)}><Trash2 />Xoá</Button>
                                        : <Button type="button" variant="ghost" size="sm" onClick={() => setForm(null)}>Huỷ</Button>}
                                    <Button type="submit" size="sm" className="ml-auto" disabled={busy || !form.name?.trim() || !form.code?.trim()}>{form.id ? "Lưu loại" : "Thêm loại"}</Button>
                                </div>
                            </form>
                        ) : <Idle text="Chọn một loại để sửa tên, màu và biểu tượng." />}
                    </aside>
                </TabsContent>

                <TabsContent value="facilities" className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
                    <div className="overflow-hidden rounded-xl border">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="pl-4">Tiện ích</TableHead>
                                    <TableHead className="text-right">Số điểm có</TableHead>
                                    <TableHead className="w-0"><span className="sr-only">Thao tác</span></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.facilities.map(f => (
                                    <TableRow key={f.id} data-state={editingFacility?.id === f.id ? "selected" : undefined}>
                                        <TableCell className="pl-4 font-medium">{f.name}</TableCell>
                                        <TableCell className="text-right tabular-nums">{facilityUse.get(f.name) ?? 0}</TableCell>
                                        <TableCell className="pr-4">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button variant="outline" size="sm" onClick={() => setEditingFacility({ ...f })}><Pencil />Đổi tên</Button>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="size-8" aria-label={`Thao tác khác với ${f.name}`}><MoreHorizontal /></Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-44">
                                                        <DropdownMenuItem variant="destructive" onSelect={() => void removeFacility(f)}><Trash2 />Xoá tiện ích…</DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {!data.facilities.length && (
                                    <TableRow><TableCell colSpan={3} className="h-24 text-center text-muted-foreground">Chưa có tiện ích.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    <aside className="overflow-hidden rounded-xl border bg-card">
                        <form onSubmit={e => void saveFacility(e)}>
                            <div className="border-b p-4"><h2 className="text-base font-semibold">{editingFacility ? "Đổi tên tiện ích" : "Thêm tiện ích"}</h2></div>
                            <div className="grid gap-2 p-4">
                                <Label htmlFor="fac-name">Tên</Label>
                                <Input id="fac-name" required placeholder="Wi-Fi miễn phí" value={editingFacility?.name ?? facilityName}
                                    onChange={e => (editingFacility ? setEditingFacility({ ...editingFacility, name: e.target.value }) : setFacilityName(e.target.value))} />
                            </div>
                            <div className="flex items-center gap-2 border-t p-3">
                                {editingFacility && <Button type="button" variant="ghost" size="sm" onClick={() => setEditingFacility(null)}>Huỷ</Button>}
                                <Button type="submit" size="sm" className="ml-auto" disabled={busy}>{editingFacility ? "Lưu" : "Thêm tiện ích"}</Button>
                            </div>
                        </form>
                    </aside>
                </TabsContent>
            </Tabs>

            <Dialog open={removing !== null} onOpenChange={open => !open && setRemoving(null)}>
                <DialogContent className="sm:max-w-md">
                    {removing && (
                        <>
                            <DialogHeader>
                                <DialogTitle>Xoá loại “{removing.type.name}”?</DialogTitle>
                                <DialogDescription className="flex items-center gap-2"><TriangleAlert className="size-4 text-warning" />{removingCount} điểm đang thuộc loại này.</DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-2">
                                <Label htmlFor="del-to">Chuyển {removingCount} điểm sang</Label>
                                <Select value={removing.to} onValueChange={v => setRemoving({ ...removing, to: v })}>
                                    <SelectTrigger id="del-to" className="w-full" aria-describedby="del-help"><SelectValue placeholder="Chọn loại thay thế" /></SelectTrigger>
                                    <SelectContent>
                                        {types.filter(t => t.code !== removing.type.code).map(t => <SelectItem key={t.code} value={t.code}>{t.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <p id="del-help" className="text-xs text-muted-foreground">Bắt buộc, để điểm không mất loại.</p>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setRemoving(null)}>Huỷ</Button>
                                <Button variant="destructive" disabled={busy || !removing.to} onClick={() => void moveAndRemove()}>Chuyển và xoá loại</Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </Page>
    );
}
