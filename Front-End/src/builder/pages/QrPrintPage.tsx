import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useSearchParams } from "react-router-dom";
import QRCode from "qrcode";
import { qrUrl, type WalkwayNodeDto } from "@indoor-map/core";
import { ChevronLeft, ChevronRight, Printer, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { EmptyState, Page } from "../../console/page";
import { floorLabel } from "../FloorList";
import { useWorkspace } from "../Workspace";
import { QR_STATUS_LABEL, qrPlaceText, qrStatus, readQrState, withQrStatus, writeQrState, type QrState } from "./qrLayer";

const PER_PAGE = [2, 4, 8] as const;
type PerPage = (typeof PER_PAGE)[number];
const TEM_SIZE: Record<PerPage, string> = { 2: "A5, 148 × 210 mm", 4: "A6, 105 × 148 mm", 8: "A7, 74 × 105 mm" };
const SHEET_GRID: Record<PerPage, string> = { 2: "grid-cols-1 grid-rows-2", 4: "grid-cols-2 grid-rows-2", 8: "grid-cols-2 grid-rows-4" };

// Bản in: khung app cao 100dvh, ẩn tràn, nên bản in gắn thẳng vào body (portal) và chỉ hiện khi in.
// Kích thước theo mm chỉ có ở @media print, nên giữ ở đây thay vì lớp tiện ích.
const PRINT_CSS = `
.qr-print-root { display: none; }
@media print {
    @page { size: A4; margin: 0; }
    body * { visibility: hidden !important; }
    .qr-print-root, .qr-print-root * { visibility: visible !important; }
    .qr-print-root { display: block !important; position: absolute; left: 0; top: 0; width: 210mm; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .qr-print-root .qr-sheet { width: 210mm; height: 297mm; aspect-ratio: auto; box-shadow: none; border: 0; padding: 6mm; break-after: page; }
    .qr-print-root .qr-code { width: 40mm; height: 40mm; }
    .qr-print-root .qr-sheet[data-per="2"] .qr-code { width: 60mm; height: 60mm; }
    .qr-print-root .qr-sheet[data-per="8"] .qr-code { width: 24mm; height: 24mm; }
}`;

// In tem mã QR: mã lấy từ ?codes= (chọn ở màn Mã QR), mặc định mọi mã đã tạo. Xem trước theo trang A4, in bằng trình duyệt.
export default function QrPrintPage() {
    const { venueId, data, model } = useWorkspace();
    const [params] = useSearchParams();
    const [state, setState] = useState<QrState>(() => readQrState(venueId));
    const [per, setPer] = useState<PerPage>(4);
    const [opts, setOpts] = useState({ guide: true, english: true, place: true, cut: true });
    const [page, setPage] = useState(0);
    const [svgs, setSvgs] = useState<Record<string, string>>({});
    const [afterPrint, setAfterPrint] = useState<Set<string> | null>(null);
    const origin = window.location.origin;

    const nodes = useMemo(() => {
        const asked = params.get("codes")?.split(",").filter(Boolean);
        const ids = asked?.length ? asked : state.selected;
        return ids.map(id => model.nodesById.get(id)).filter((n): n is WalkwayNodeDto => Boolean(n));
    }, [params, state.selected, model.nodesById]);
    const pages = Math.max(1, Math.ceil(nodes.length / per));
    const shownPage = Math.min(page, pages - 1);

    useEffect(() => writeQrState(venueId, state), [state, venueId]);

    useEffect(() => {
        let alive = true;
        const missing = nodes.filter(n => !svgs[n.id]);
        if (!missing.length) return undefined;
        void Promise.all(missing.map(async n => [n.id, await QRCode.toString(qrUrl(origin, data.venue.slug, n.id), { type: "svg", margin: 1, errorCorrectionLevel: "M" })] as const))
            .then(pairs => alive && setSvgs(s => ({ ...s, ...Object.fromEntries(pairs) })));
        return () => {
            alive = false;
        };
    }, [nodes, svgs, origin, data.venue.slug]);

    const print = () => {
        window.print();
        setAfterPrint(new Set(nodes.map(n => n.id)));
    };
    const markPrinted = () => {
        if (afterPrint?.size) setState(s => withQrStatus(s, [...afterPrint].filter(id => qrStatus(s, id) === "created"), "printed", Date.now()));
        setAfterPrint(null);
    };

    const small = per === 8;
    const tem = (n: WalkwayNodeDto) => (
        <div key={n.id} className={`flex min-h-0 min-w-0 flex-col items-center overflow-hidden text-center text-foreground ${small ? "p-2" : "p-4"} ${opts.cut ? "border border-dashed" : ""}`}>
            {opts.guide && (
                <div className={`flex shrink-0 items-center justify-center self-stretch rounded bg-foreground text-xs font-medium text-background ${small ? "h-6" : "h-8"}`}>Quét để biết bạn đang ở đâu</div>
            )}
            <div className={`qr-code shrink-0 [&_svg]:block [&_svg]:size-full ${small ? "mt-1 size-16" : "mt-3 size-31"}`}
                dangerouslySetInnerHTML={svgs[n.id] ? { __html: svgs[n.id]! } : undefined} />
            <p className={`mt-2 font-semibold ${small ? "text-base" : "text-lg"}`}>{n.id}</p>
            {opts.english && <p className="text-xs text-muted-foreground">Scan to see where you are</p>}
            {opts.place && <p className={`text-xs ${small ? "mt-1" : "mt-2"}`}>{qrPlaceText(model, n)}</p>}
            <p className="mt-auto text-xs text-muted-foreground">{data.venue.name}<br />{floorLabel(model, model.floorsById.get(n.floorId))}</p>
        </div>
    );
    const sheetClass = `qr-sheet grid aspect-[210/297] shrink-0 bg-background p-3 ${SHEET_GRID[per]}`;
    const sheets = Array.from({ length: pages }, (_, i) => nodes.slice(i * per, i * per + per));

    const printButton = <Button disabled={!nodes.length} onClick={print}><Printer />{nodes.length ? `In ${nodes.length} tem` : "In tem"}</Button>;

    return (
        <Page actions={printButton}>
            <style>{PRINT_CSS}</style>

            {!nodes.length ? (
                <EmptyState icon={<QrCode />} title="Chưa có mã nào để in" description="Tạo mã ở màn Mã QR định vị, chọn các mã cần in rồi quay lại đây."
                    action={<Button asChild variant="outline" size="sm"><Link to={`/builder/v/${venueId}/qr`}>Mở Mã QR định vị</Link></Button>} />
            ) : (
                <div className="grid items-start gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
                    <aside aria-label="Tuỳ chọn in" className="flex flex-col overflow-hidden rounded-xl border bg-card">
                        <div className="space-y-4 p-4">
                            <div className="grid gap-2">
                                <Label htmlFor="paper">Khổ giấy</Label>
                                <Select defaultValue="a4">
                                    <SelectTrigger id="paper" className="w-full"><SelectValue /></SelectTrigger>
                                    <SelectContent><SelectItem value="a4">A4, 210 × 297 mm</SelectItem></SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label id="per-l">Số tem mỗi trang</Label>
                                <ToggleGroup type="single" variant="outline" size="sm" value={String(per)} aria-labelledby="per-l" className="w-full"
                                    onValueChange={v => { if (v) { setPer(Number(v) as PerPage); setPage(0); } }}>
                                    {PER_PAGE.map(n => (
                                        <ToggleGroupItem key={n} value={String(n)} className="flex-1 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">{n}</ToggleGroupItem>
                                    ))}
                                </ToggleGroup>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground">Cỡ tem</span><span>{TEM_SIZE[per]}</span>
                                </div>
                            </div>
                            <div className="grid gap-3">
                                <p className="text-sm leading-none font-medium">Nội dung tem</p>
                                {([["guide", "Hướng dẫn quét"], ["english", "Tiếng Anh"], ["place", "Mô tả vị trí dán"], ["cut", "Đường cắt"]] as const).map(([k, label]) => (
                                    <div key={k} className="flex items-center gap-2">
                                        <Checkbox id={`opt-${k}`} checked={opts[k]} onCheckedChange={v => setOpts(o => ({ ...o, [k]: v === true }))} />
                                        <Label htmlFor={`opt-${k}`} className="font-normal">{label}</Label>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between px-4 pt-3 pb-1">
                            <span className="text-xs font-medium text-muted-foreground">{nodes.length} tem, {pages} trang</span>
                            <Button asChild variant="link" size="sm" className="h-auto px-0"><Link to={`/builder/v/${venueId}/qr`}>Đổi danh sách</Link></Button>
                        </div>
                        <div className="max-h-72 overflow-y-auto">
                            <Table>
                                <TableBody>
                                    {nodes.map(n => (
                                        <TableRow key={n.id}>
                                            <TableCell className="w-0 pl-4 font-medium">{n.id}</TableCell>
                                            <TableCell className="max-w-36 truncate text-muted-foreground">{qrPlaceText(model, n)}</TableCell>
                                            <TableCell className="pr-4 text-right text-xs text-muted-foreground">{QR_STATUS_LABEL[qrStatus(state, n.id)]}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </aside>

                    <section aria-label="Xem trước trang in" className="flex min-w-0 flex-col items-center gap-4 overflow-x-auto rounded-xl border bg-muted/40 p-6">
                        <div className={`${sheetClass} w-116 rounded-sm shadow-md`} data-per={per} role="img" aria-label={`Trang ${shownPage + 1}: ${sheets[shownPage]?.length ?? 0} tem mã QR trên giấy A4`}>
                            {sheets[shownPage]?.map(tem)}
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            <Button variant="outline" size="icon" className="size-8" aria-label="Trang trước" title="Trang trước" disabled={shownPage === 0} onClick={() => setPage(shownPage - 1)}><ChevronLeft /></Button>
                            <span className="tabular-nums">Trang {shownPage + 1} / {pages}</span>
                            <Button variant="outline" size="icon" className="size-8" aria-label="Trang sau" title="Trang sau" disabled={shownPage >= pages - 1} onClick={() => setPage(shownPage + 1)}><ChevronRight /></Button>
                        </div>
                    </section>
                </div>
            )}

            {/* Bản in gắn thẳng vào body: khung app cao 100dvh, ẩn tràn, sẽ cắt mất trang 2 trở đi */}
            {createPortal(
                <div className="qr-print-root" aria-hidden="true">
                    {sheets.map((list, i) => <div key={i} className={sheetClass} data-per={per}>{list.map(tem)}</div>)}
                </div>,
                document.body
            )}

            <Dialog open={afterPrint !== null} onOpenChange={open => !open && setAfterPrint(null)}>
                <DialogContent className="sm:max-w-md">
                    {afterPrint && (
                        <>
                            <DialogHeader>
                                <DialogTitle>Đánh dấu {afterPrint.size} tem là Đã in?</DialogTitle>
                                <DialogDescription>Bỏ chọn tem in hỏng để in lại.</DialogDescription>
                            </DialogHeader>
                            <fieldset className="grid max-h-72 grid-cols-2 gap-x-4 gap-y-2 overflow-y-auto">
                                <legend className="sr-only">Tem đã in</legend>
                                {nodes.map(n => (
                                    <div key={n.id} className="flex items-center gap-2">
                                        <Checkbox id={`printed-${n.id}`} checked={afterPrint.has(n.id)}
                                            onCheckedChange={() => setAfterPrint(s => { const next = new Set(s); if (next.has(n.id)) next.delete(n.id); else next.add(n.id); return next; })} />
                                        <Label htmlFor={`printed-${n.id}`} className="font-normal">{n.id}</Label>
                                    </div>
                                ))}
                            </fieldset>
                            {nodes.some(n => qrStatus(state, n.id) === "pasted") && <p className="text-xs text-muted-foreground">Có tem đang dán: gỡ tem cũ khi dán tem mới.</p>}
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setAfterPrint(null)}>Để sau</Button>
                                <Button disabled={!afterPrint.size} onClick={markPrinted}>Đánh dấu Đã in</Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </Page>
    );
}
