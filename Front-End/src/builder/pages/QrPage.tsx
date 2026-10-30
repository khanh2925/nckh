import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import QRCode from "qrcode";
import { distance, qrUrl, type WalkwayNodeDto } from "@indoor-map/core";
import { ChevronDown, CircleCheck, Layers, Printer, QrCode, Sparkles, Spline, Trash2, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { EmptyState, Page } from "../../console/page";
import { useFeedback } from "../../console/ui";
import EditorMap from "../EditorMap";
import { floorLabel } from "../FloorList";
import { useWorkspace } from "../Workspace";
import { QR_MARK_CLASS, QR_STATUS_LABEL, QrNodesLayer, qrPlaceText, qrStatus, readQrState, withQrStatus, writeQrState, type QrState, type QrStatus } from "./qrLayer";

type Filter = "all" | QrStatus | "issue";

/** Gợi ý: nút thang + giao lộ (≥ 3 nhánh), bỏ bớt cho các mã cách nhau ít nhất 30 m */
function suggest(nodes: WalkwayNodeDto[], degree: Map<string, number>): string[] {
    const candidates = nodes.filter(n => n.connector || (degree.get(n.id) ?? 0) >= 3).sort((a, b) => Number(Boolean(b.connector)) - Number(Boolean(a.connector)));
    const picked: WalkwayNodeDto[] = [];
    for (const c of candidates) if (!picked.some(p => p.floorId === c.floorId && distance(p, c) < 30)) picked.push(c);
    return picked.map(n => n.id);
}
const day = (t?: number) => (t ? new Date(t).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }) : null);

function StatusBadge({ status, lost }: { status: QrStatus; lost?: boolean }) {
    if (lost) return <Badge className="gap-1 bg-destructive/10 text-destructive"><TriangleAlert />Nút đã xoá</Badge>;
    if (status === "pasted") return <Badge className="gap-1 bg-success/10 text-success"><CircleCheck />{QR_STATUS_LABEL.pasted}</Badge>;
    if (status === "printed") return <Badge variant="secondary">{QR_STATUS_LABEL.printed}</Badge>;
    return <Badge variant="outline">{QR_STATUS_LABEL.created}</Badge>;
}

// Mã QR định vị: mỗi mã = một nút lối đi; khách quét biết vị trí trong khoảng 1 m.
// Danh sách mã và trạng thái tem lưu tạm trên trình duyệt này (backend chưa có bảng mã QR).
export default function QrPage() {
    const { venueId, data, model } = useWorkspace();
    const { confirm } = useFeedback();
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const floorId = Number(params.get("floor")) || model.defaultFloor?.id || model.floors[0]?.id || null;
    const floor = floorId ? model.floorsById.get(floorId) : undefined;
    const [state, setState] = useState<QrState>(() => readQrState(venueId));
    const [current, setCurrent] = useState<string | null>(null);
    const [checked, setChecked] = useState<Set<string>>(() => new Set());
    const [filter, setFilter] = useState<Filter>("all");
    const [svg, setSvg] = useState<{ id: string; svg: string } | null>(null);
    const origin = window.location.origin;

    useEffect(() => writeQrState(venueId, state), [state, venueId]);

    const degree = useMemo(() => {
        const map = new Map<string, number>();
        data.walkways.edges.forEach(e => {
            map.set(e.from, (map.get(e.from) ?? 0) + 1);
            map.set(e.to, (map.get(e.to) ?? 0) + 1);
        });
        return map;
    }, [data.walkways]);
    const nodesById = model.nodesById;
    const floorNodes = useMemo(() => model.walkways.nodes.filter(n => n.floorId === floorId), [model, floorId]);
    // Mã của tầng này + mã mất nút (nút đã bị xoá khỏi lối đi: tem đã dán không còn định vị được)
    const lost = state.selected.filter(id => !nodesById.has(id));
    const floorCodes = state.selected.filter(id => nodesById.get(id)?.floorId === floorId);
    const listed = [...floorCodes, ...lost];
    const countBy = (s: QrStatus) => floorCodes.filter(id => qrStatus(state, id) === s).length;
    const shown = listed.filter(id => filter === "all" || (filter === "issue" ? !nodesById.has(id) : nodesById.has(id) && qrStatus(state, id) === filter));
    const currentId = current && state.selected.includes(current) ? current : shown[0] ?? null;
    const currentNode = currentId ? nodesById.get(currentId) : undefined;

    // Khoảng cách xa nhất từ một điểm quan tâm tới mã gần nhất cùng tầng
    const coverage = useMemo(() => {
        const pts = state.selected.map(id => nodesById.get(id)).filter((n): n is WalkwayNodeDto => n?.floorId === floorId);
        const places = model.locations.filter(l => l.floorId === floorId);
        if (!pts.length || !places.length) return null;
        let worst = 0;
        for (const p of places) worst = Math.max(worst, Math.min(...pts.map(q => distance(p, q))));
        return worst;
    }, [state.selected, nodesById, model, floorId]);

    useEffect(() => {
        if (!currentId) return undefined;
        let alive = true;
        void QRCode.toString(qrUrl(origin, data.venue.slug, currentId), { type: "svg", margin: 1, errorCorrectionLevel: "M" }).then(text => alive && setSvg({ id: currentId, svg: text }));
        return () => {
            alive = false;
        };
    }, [currentId, origin, data.venue.slug]);

    const pick = (id: string) => {
        if (state.selected.includes(id)) return setCurrent(id);
        const at = Date.now();
        setState(s => ({ ...s, selected: [...s.selected, id], times: { ...s.times, [id]: { created: at } } }));
        setCurrent(id);
    };
    const addSuggested = () => {
        const at = Date.now();
        setState(s => {
            const add = suggest(floorNodes, degree).filter(id => !s.selected.includes(id));
            return { ...s, selected: [...s.selected, ...add], times: { ...s.times, ...Object.fromEntries(add.map(id => [id, { created: at }])) } };
        });
    };
    const setStatus = (ids: string[], status: QrStatus) => setState(s => withQrStatus(s, ids, status, Date.now()));
    const revoke = async (ids: string[]) => {
        if (!ids.length) return;
        const pasted = ids.filter(id => state.posted.includes(id)).length;
        if (!(await confirm(ids.length === 1 ? `Thu hồi mã ${ids[0]}?` : `Thu hồi ${ids.length} mã?`, {
            danger: true, okLabel: "Thu hồi", detail: pasted ? `${pasted} tem đã dán cần gỡ khỏi tường. Nút lối đi vẫn giữ nguyên.` : "Nút lối đi vẫn giữ nguyên, có thể tạo mã lại."
        }))) return;
        const set = new Set(ids);
        setState(s => ({ ...s, selected: s.selected.filter(x => !set.has(x)), posted: s.posted.filter(x => !set.has(x)), printed: s.printed.filter(x => !set.has(x)) }));
        setChecked(c => new Set([...c].filter(x => !set.has(x))));
    };
    const toggleCheck = (id: string) => setChecked(c => {
        const next = new Set(c);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
    });
    const selectFloor = (id: number) => {
        setParams({ floor: String(id) });
        setCurrent(null);
        setChecked(new Set());
    };
    const checkedHere = shown.filter(id => checked.has(id));
    const allChecked = shown.length > 0 && checkedHere.length === shown.length;
    const printable = checkedHere.filter(id => nodesById.has(id));
    const status = currentId && currentNode ? qrStatus(state, currentId) : null;
    const t = currentId ? state.times[currentId] : undefined;
    const hasCodes = floorNodes.length > 0 || listed.length > 0;
    const base = `/builder/v/${venueId}`;

    const suggestButton = (
        <Button variant="outline" disabled={!floorNodes.length} title={floorNodes.length ? "Chân thang và giao lộ, cách nhau ít nhất 30 m" : "Tầng chưa có lối đi"} onClick={addSuggested}>
            <Sparkles />Gợi ý vị trí mã
        </Button>
    );

    if (!floor || !floorId) {
        return (
            <Page>
                <EmptyState icon={<Layers />} title="Chưa có tầng" description="Thêm tầng và vẽ lối đi trước, mỗi mã QR gắn với một nút lối đi."
                    action={<Button asChild><Link to={`${base}/buildings`}>Thêm toà nhà và tầng</Link></Button>} />
            </Page>
        );
    }

    const building = model.buildings.find(b => b.id === floor.buildingId);
    const filters: [Filter, string, number][] = [
        ["all", "Tất cả", listed.length], ["created", QR_STATUS_LABEL.created, countBy("created")],
        ["printed", QR_STATUS_LABEL.printed, countBy("printed")], ["pasted", QR_STATUS_LABEL.pasted, countBy("pasted")]
    ];
    if (lost.length) filters.push(["issue", "Cần xử lý", lost.length]);

    return (
        <Page actions={suggestButton}>
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
                <div className="flex min-w-0 flex-col gap-6">
                    {/* Mặt bằng: bấm nút lối đi để tạo mã */}
                    <section aria-label="Vị trí mã trên mặt bằng"
                        className="relative h-80 overflow-hidden rounded-xl border bg-muted/40 [&_.cb-map]:absolute [&_.cb-map]:inset-0 [&_.cb-map]:min-h-0">
                        <EditorMap model={model} floorId={floorId}>
                            {map => <QrNodesLayer map={map} nodes={floorNodes} state={state} current={currentId} onPick={pick} />}
                        </EditorMap>

                        <div className="absolute top-3 left-3 z-[800] flex max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-lg border bg-background p-1 shadow-sm">
                            {model.buildings.length > 1 && (
                                <Select value={String(floor.buildingId)} onValueChange={v => { const first = model.floorsOf(Number(v))[0]; if (first) selectFloor(first.id); }}>
                                    <SelectTrigger size="sm" className="border-0 shadow-none" aria-label="Toà nhà"><SelectValue /></SelectTrigger>
                                    <SelectContent>{model.buildings.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.code} {b.name}</SelectItem>)}</SelectContent>
                                </Select>
                            )}
                            <ToggleGroup type="single" size="sm" value={String(floorId)} onValueChange={v => v && selectFloor(Number(v))} aria-label="Tầng" className="overflow-x-auto">
                                {building && model.floorsOf(building.id).map(f => (
                                    <ToggleGroupItem key={f.id} value={String(f.id)} className="px-2.5 whitespace-nowrap data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">{f.name}</ToggleGroupItem>
                                ))}
                            </ToggleGroup>
                        </div>

                        {hasCodes && (
                            <ul aria-label="Chú giải" className="absolute top-3 right-3 z-[800] flex flex-col gap-1 rounded-lg border bg-background p-2 text-xs shadow-sm">
                                {(["pasted", "printed", "created"] as QrStatus[]).map(s => (
                                    <li key={s} className="flex items-center gap-2"><span aria-hidden="true" className={`size-3.5 rounded-sm ${QR_MARK_CLASS[s]}`} />{QR_STATUS_LABEL[s]}</li>
                                ))}
                                <li className="flex items-center gap-2"><span aria-hidden="true" className={`size-3.5 rounded-sm ${QR_MARK_CLASS.lost}`} />Mất nút</li>
                            </ul>
                        )}

                        {!hasCodes && (
                            <div className="absolute top-1/2 left-1/2 z-[800] w-80 -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-5 shadow-lg">
                                <p className="text-sm font-medium">{floorLabel(model, floor)} chưa có lối đi</p>
                                <p className="mt-1 text-sm text-muted-foreground">Mỗi mã QR là một nút lối đi. Vẽ lối đi trước.</p>
                                <Button asChild size="sm" className="mt-4"><Link to={`${base}/walkways?floor=${floorId}`}><Spline />Mở Lối đi</Link></Button>
                            </div>
                        )}
                    </section>

                    {hasCodes && (
                        <section aria-label="Danh sách mã" className="overflow-hidden rounded-xl border bg-card">
                            <div className="flex items-center gap-2 border-b px-4 py-3">
                                <ToggleGroup type="single" size="sm" variant="outline" value={filter} onValueChange={v => v && setFilter(v as Filter)} aria-label="Lọc theo trạng thái">
                                    {filters.map(([value, label, n]) => (
                                        <ToggleGroupItem key={value} value={value} className={`gap-1.5 px-2.5 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground ${value === "issue" ? "text-destructive" : ""}`}>
                                            {label}<span className="tabular-nums opacity-70">{n}</span>
                                        </ToggleGroupItem>
                                    ))}
                                </ToggleGroup>
                                {coverage != null && (
                                    <span className={`ml-auto text-xs ${coverage > 60 ? "text-warning" : "text-muted-foreground"}`}>Điểm xa mã nhất {Math.round(coverage)} m</span>
                                )}
                            </div>
                            <div role="region" aria-label="Thao tác hàng loạt" className="flex items-center gap-3 border-b px-4 py-2">
                                <Checkbox aria-label="Chọn tất cả" checked={allChecked} disabled={!shown.length}
                                    onCheckedChange={() => setChecked(c => (allChecked ? new Set([...c].filter(x => !shown.includes(x))) : new Set([...c, ...shown])))} />
                                <span className="text-sm text-muted-foreground tabular-nums">{checkedHere.length} / {shown.length} đã chọn</span>
                                <div className="ml-auto flex items-center gap-2">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline" size="sm" disabled={!printable.length} aria-label="Đổi trạng thái các mã đã chọn">Đổi trạng thái<ChevronDown /></Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-44">
                                            {(["created", "printed", "pasted"] as QrStatus[]).map(s => <DropdownMenuItem key={s} onSelect={() => setStatus(printable, s)}>{QR_STATUS_LABEL[s]}</DropdownMenuItem>)}
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem variant="destructive" onSelect={() => void revoke(checkedHere)}><Trash2 />Thu hồi mã…</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                    <Button size="sm" disabled={!printable.length} onClick={() => navigate(`${base}/qr-print?codes=${encodeURIComponent(printable.join(","))}`)}>
                                        <Printer />{printable.length ? `In ${printable.length} tem` : "In tem"}
                                    </Button>
                                </div>
                            </div>
                            <Table>
                                <TableHeader className="bg-muted/50">
                                    <TableRow>
                                        <TableHead className="w-0 pl-4"><span className="sr-only">Chọn</span></TableHead>
                                        <TableHead>Mã</TableHead>
                                        <TableHead>Vị trí in trên thẻ</TableHead>
                                        <TableHead>Trạng thái</TableHead>
                                        <TableHead className="pr-4 text-right">Cập nhật</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {shown.map(id => {
                                        const n = nodesById.get(id);
                                        const tm = state.times[id];
                                        return (
                                            <TableRow key={id} tabIndex={0} aria-selected={id === currentId} data-state={id === currentId ? "selected" : undefined} className="cursor-pointer"
                                                onClick={() => setCurrent(id)} onKeyDown={e => e.key === "Enter" && setCurrent(id)}>
                                                <TableCell className="pl-4" onClick={e => e.stopPropagation()}>
                                                    <Checkbox aria-label={`Chọn ${id}`} checked={checked.has(id)} onCheckedChange={() => toggleCheck(id)} />
                                                </TableCell>
                                                <TableCell className="font-medium">{id}</TableCell>
                                                <TableCell className={n ? undefined : "text-muted-foreground"}>{n ? qrPlaceText(model, n) : "Không còn nút"}</TableCell>
                                                <TableCell><StatusBadge status={qrStatus(state, id)} lost={!n} /></TableCell>
                                                <TableCell className="pr-4 text-right text-muted-foreground tabular-nums">{day(tm?.posted ?? tm?.printed ?? tm?.created) ?? "—"}</TableCell>
                                            </TableRow>
                                        );
                                    })}
                                    {!shown.length && (
                                        <TableRow>
                                            <TableCell colSpan={5} className="h-24 text-center whitespace-normal text-muted-foreground">
                                                {listed.length ? "Không có mã nào ở trạng thái này." : "Chưa có mã nào. Bấm Gợi ý vị trí mã, hoặc bấm một nút lối đi trên bản đồ."}
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </section>
                    )}
                </div>

                {/* Phải: chi tiết mã */}
                <aside aria-label={currentId ? `Mã ${currentId}` : "Chi tiết mã"} className="flex flex-col overflow-hidden rounded-xl border bg-card">
                    {currentId ? (
                        <>
                            <div className="border-b p-4">
                                <div className="flex items-center gap-2">
                                    <h2 className="min-w-0 truncate text-base font-semibold">{currentId}</h2>
                                    {status && <StatusBadge status={status} />}
                                </div>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                    {currentNode ? `${floorLabel(model, model.floorsById.get(currentNode.floorId))}, ${qrPlaceText(model, currentNode).toLowerCase()}` : "Nút lối đi đã bị xoá"}
                                </p>
                            </div>
                            <div className="space-y-4 p-4">
                                {!currentNode && (
                                    <Alert variant="destructive">
                                        <TriangleAlert />
                                        <AlertTitle>Nút đã bị xoá khỏi lối đi</AlertTitle>
                                        <AlertDescription>Khách quét tem này sẽ không định vị được. Thu hồi mã và gỡ tem.</AlertDescription>
                                    </Alert>
                                )}
                                {currentNode && (
                                    <figure className="mx-auto w-48 overflow-hidden rounded-xl border bg-background text-center">
                                        <div className="flex h-7 items-center justify-center bg-foreground text-xs font-medium text-background">Quét để xem bản đồ</div>
                                        <div className="mx-auto mt-3 mb-1 size-28 [&_svg]:block [&_svg]:size-full" dangerouslySetInnerHTML={svg?.id === currentId ? { __html: svg.svg } : undefined} />
                                        <figcaption className="px-3 pb-3">
                                            <p className="text-base font-semibold">{currentId}</p>
                                            <p className="text-xs text-muted-foreground">{qrPlaceText(model, currentNode)}</p>
                                        </figcaption>
                                    </figure>
                                )}
                                <div className="grid gap-2">
                                    <p className="text-xs font-medium text-muted-foreground">Vòng đời tem</p>
                                    <dl className="grid grid-cols-2 gap-y-1 rounded-lg bg-muted/50 px-3 py-2 text-sm">
                                        <dt className={status === "created" ? "font-medium" : "text-muted-foreground"}>Tạo</dt><dd className="text-right tabular-nums">{day(t?.created) ?? "—"}</dd>
                                        <dt className={status === "printed" ? "font-medium" : "text-muted-foreground"}>Đã in</dt><dd className="text-right tabular-nums">{day(t?.printed) ?? (status === "printed" || status === "pasted" ? "có" : "chưa")}</dd>
                                        <dt className={status === "pasted" ? "font-medium" : "text-muted-foreground"}>Đã dán</dt><dd className="text-right tabular-nums">{day(t?.posted) ?? (status === "pasted" ? "có" : "chưa")}</dd>
                                    </dl>
                                    <p className="text-xs text-muted-foreground">Lưu trên trình duyệt này.</p>
                                </div>
                                {currentNode && (
                                    <Button asChild variant="link" size="sm" className="h-auto px-0"><Link to={`${base}/walkways?floor=${currentNode.floorId}`}>Xem nút trong Lối đi</Link></Button>
                                )}
                            </div>
                            <div className="flex items-center gap-2 border-t p-3">
                                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => void revoke([currentId])}><Trash2 />Thu hồi</Button>
                                {currentNode && (
                                    <Button size="sm" variant={status === "pasted" ? "outline" : "default"} className="ml-auto" onClick={() => setStatus([currentId], status === "pasted" ? "printed" : "pasted")}>
                                        {status === "pasted" ? "Bỏ đánh dấu đã dán" : "Đánh dấu đã dán"}
                                    </Button>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
                            <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground"><QrCode className="size-5" /></span>
                            <p className="text-sm text-muted-foreground">Bấm một nút lối đi trên bản đồ để tạo mã.</p>
                        </div>
                    )}
                </aside>
            </div>
        </Page>
    );
}
