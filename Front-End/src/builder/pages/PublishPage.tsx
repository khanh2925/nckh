import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import QRCode from "qrcode";
import { analyzeVenue } from "@indoor-map/core";
import { Building2, CircleAlert, CircleCheck, Copy, Download, EyeOff, Info, Layers, MapPin, Spline, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { venueApi } from "../../console/api";
import { Page, Section, Stat } from "../../console/page";
import { useAction, useFeedback } from "../../console/ui";
import { useWorkspace } from "../Workspace";

type Level = "block" | "warn" | "ok";
interface Check {
    level: Level;
    title: string;
    detail: string;
    to: string;
}

function LevelBadge({ level }: { level: Level }) {
    if (level === "block") return <Badge className="gap-1 bg-destructive/10 text-destructive"><CircleAlert />Chặn</Badge>;
    if (level === "warn") return <Badge className="gap-1 bg-warning/10 text-warning"><TriangleAlert />Cảnh báo</Badge>;
    return <Badge className="gap-1 bg-success/10 text-success"><CircleCheck />Đạt</Badge>;
}

// Xuất bản: kiểm tra bản nháp (tính ngay trên trình duyệt), xuất bản, gỡ xuất bản, mã QR vào bản đồ.
export default function PublishPage() {
    const { venueId, data, model, patch } = useWorkspace();
    const { confirm, toast } = useFeedback();
    const { busy, run } = useAction();
    const report = useMemo(() => analyzeVenue(model), [model]);
    const [qr, setQr] = useState<string | null>(null);
    const url = `${window.location.origin}/v/${data.venue.slug}`;
    const status = data.venue.status;

    useEffect(() => {
        void QRCode.toString(url, { type: "svg", margin: 1 }).then(setQr);
    }, [url]);

    const total = model.locations.length;
    const unreachable = report.unreachable.length + report.isolated.length;
    const base = `/builder/v/${venueId}`;
    const checks: Check[] = [
        model.floors.length === 0
            ? { level: "block", title: "Chưa có tầng nào", detail: "Thêm toà nhà và tầng trước khi xuất bản", to: `${base}/buildings` }
            : report.floorsWithoutPlan.length
                ? { level: "warn", title: `${report.floorsWithoutPlan.length} tầng thiếu mặt bằng`, detail: "Khách thấy điểm trên nền trống ở các tầng đó", to: `${base}/plan?floor=${report.floorsWithoutPlan[0]}` }
                : { level: "ok", title: "Mặt bằng mỗi tầng", detail: "", to: `${base}/plan` },
        total === 0
            ? { level: "block", title: "Chưa có điểm quan tâm nào", detail: "Khách không tìm được gì", to: `${base}/editor` }
            : { level: "ok", title: "Có điểm để tìm", detail: "", to: `${base}/editor` },
        !report.nodes
            ? { level: "block", title: "Chưa có lối đi", detail: "Không chỉ đường được tới điểm nào", to: `${base}/walkways` }
            : unreachable
                ? { level: unreachable / Math.max(total, 1) > 0.1 ? "block" : "warn", title: `${unreachable} điểm không tới được`, detail: "Sẽ không được chỉ đường tới các điểm này", to: `${base}/walkways` }
                : { level: "ok", title: "Mọi điểm tới được", detail: "", to: `${base}/walkways` },
        report.looseConnectors.length
            ? { level: "warn", title: `${report.looseConnectors.length} thang chưa nối tầng`, detail: "Khách không đổi tầng được ở các thang này", to: `${base}/walkways` }
            : { level: "ok", title: "Thang nối tầng", detail: "", to: `${base}/walkways` },
        data.venue.description && data.venue.outline?.length
            ? { level: "ok", title: "Thông tin địa điểm", detail: "", to: `${base}/settings` }
            : { level: "warn", title: "Thiếu thông tin địa điểm", detail: `${data.venue.description ? "" : "Thiếu mô tả. "}${data.venue.outline?.length ? "" : "Thiếu vùng bao, bản đồ chọn địa điểm chỉ hiện một chấm."}`.trim(), to: `${base}/settings` }
    ];
    const blocks = checks.filter(c => c.level === "block");
    const warns = checks.filter(c => c.level === "warn");
    const oks = checks.filter(c => c.level === "ok");

    const publish = async (force = false) => {
        if (force && !(await confirm("Vẫn xuất bản khi còn mục chặn?", { detail: "Khách sẽ gặp chỗ không tìm được đường hoặc tầng trống.", okLabel: "Vẫn xuất bản" }))) return;
        const saved = await run(() => venueApi.publish(venueId), "Đã xuất bản, khách xem được ngay");
        if (saved) patch("venue", { ...data.venue, ...saved });
    };
    const unpublish = async () => {
        if (!(await confirm(`Gỡ xuất bản ${data.venue.name}?`, { danger: true, okLabel: "Gỡ xuất bản", detail: "Đường dẫn và mã QR đã in sẽ báo không tìm thấy cho tới khi xuất bản lại." }))) return;
        const saved = await run(() => venueApi.unpublish(venueId), "Đã gỡ xuất bản");
        if (saved) patch("venue", { ...data.venue, ...saved });
    };
    const downloadPng = async () => {
        const href = await QRCode.toDataURL(url, { margin: 2, width: 1024 });
        const a = document.createElement("a");
        a.href = href;
        a.download = `qr-${data.venue.slug}.png`;
        a.click();
    };
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(url);
            toast("Đã sao chép đường dẫn");
        } catch {
            toast("Không sao chép được, hãy chọn và sao chép tay", "err");
        }
    };

    const actions = (
        <>
            <Button asChild variant="outline"><Link to={`${base}/diff`}>Xem khác biệt</Link></Button>
            {status !== "PUBLISHED" && (
                <Button disabled={busy || status === "HIDDEN" || blocks.length > 0} title={blocks.length ? "Còn mục chặn" : undefined} onClick={() => void publish()}>Xuất bản</Button>
            )}
        </>
    );

    return (
        <Page actions={actions}>
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
                <div className="flex min-w-0 flex-col gap-6">
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                        <Stat icon={<Building2 />} tone="blue" label="Toà nhà" value={model.buildings.length} />
                        <Stat icon={<Layers />} tone="green" label="Tầng" value={model.floors.length} />
                        <Stat icon={<MapPin />} tone="amber" label="Điểm" value={total.toLocaleString("vi-VN")} />
                        <Stat icon={<Spline />} tone="violet" label="Lối đi" value={`${Math.round(report.meters).toLocaleString("vi-VN")} m`} />
                    </div>

                    {status === "HIDDEN" ? (
                        <Alert variant="destructive">
                            <EyeOff />
                            <AlertTitle>Địa điểm đang bị quản trị hệ thống ẩn</AlertTitle>
                            <AlertDescription>Khách không mở được bản đồ. Bạn vẫn sửa bản nháp được.</AlertDescription>
                        </Alert>
                    ) : status === "PUBLISHED" ? (
                        <div role="status" className="flex items-center gap-3 rounded-lg border border-success/30 bg-success/5 px-4 py-3 text-sm">
                            <CircleCheck className="size-4 shrink-0 text-success" />
                            <span className="flex-1">Đang công khai. Chỉnh sửa hiện cho khách ngay khi lưu.</span>
                        </div>
                    ) : (blocks.length ? (
                        <div role="status" className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
                            <CircleAlert className="size-4 shrink-0 text-destructive" />
                            <span className="flex-1">Còn {blocks.length} mục chặn, chưa xuất bản được.</span>
                            <Button variant="outline" size="sm" disabled={busy} onClick={() => void publish(true)}>Vẫn xuất bản…</Button>
                        </div>
                    ) : (
                        <div role="status" className="flex items-center gap-3 rounded-lg border border-success/30 bg-success/5 px-4 py-3 text-sm">
                            <CircleCheck className="size-4 shrink-0 text-success" />
                            <span className="flex-1">Sẵn sàng xuất bản.</span>
                        </div>
                    ))}

                    <Section title="Kiểm tra bản nháp" flush
                        description={[blocks.length && `${blocks.length} chặn`, warns.length && `${warns.length} cảnh báo`, `${oks.length} đạt`].filter(Boolean).join(", ")}>
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="pl-6">Mục</TableHead>
                                    <TableHead>Kết quả</TableHead>
                                    <TableHead className="w-0"><span className="sr-only">Thao tác</span></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {[...blocks, ...warns, ...oks].map(c => (
                                    <TableRow key={c.title}>
                                        <TableCell className="pl-6 whitespace-normal">
                                            <p className="font-medium">{c.title}</p>
                                            {c.detail && <p className="text-xs text-muted-foreground">{c.detail}</p>}
                                        </TableCell>
                                        <TableCell><LevelBadge level={c.level} /></TableCell>
                                        <TableCell className="pr-6 text-right">
                                            <Button asChild variant="outline" size="sm"><Link to={c.to}>{c.level === "ok" ? "Mở" : "Sửa"}</Link></Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Section>
                </div>

                <div className="flex flex-col gap-6">
                    <Section title="Bản công khai"
                        actions={status === "PUBLISHED" ? <Badge className="gap-1 bg-success/10 text-success"><CircleCheck />Công khai</Badge>
                            : status === "HIDDEN" ? <Badge className="gap-1 bg-destructive/10 text-destructive"><EyeOff />Bị ẩn</Badge>
                                : <Badge variant="outline">Chưa công khai</Badge>}>
                        {status === "HIDDEN" ? (
                            <p className="text-sm text-muted-foreground">Quản trị hệ thống đã ẩn địa điểm này. Khách không mở được bản đồ.</p>
                        ) : (
                            <div className="flex flex-col gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="size-24 shrink-0 rounded-lg border bg-background p-1.5 [&_svg]:block [&_svg]:size-full" aria-label="Mã QR vào bản đồ" role="img"
                                        dangerouslySetInnerHTML={qr ? { __html: qr } : undefined} />
                                    <div className="min-w-0">
                                        <p className="text-xs text-muted-foreground">Mã QR vào bản đồ</p>
                                        <p className="text-sm font-medium break-all">{url.replace(/^https?:\/\//, "")}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <Button variant="outline" size="sm" onClick={() => void downloadPng()}><Download />Tải PNG</Button>
                                    <Button variant="outline" size="sm" onClick={() => void copy()}><Copy />Sao chép</Button>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Mã định vị khách nằm ở <Link to={`${base}/qr`} className="font-medium text-primary underline-offset-4 hover:underline">Mã QR định vị</Link>.
                                </p>
                                {status === "PUBLISHED" && (
                                    <Button variant="ghost" size="sm" className="self-start text-destructive hover:text-destructive" disabled={busy} onClick={() => void unpublish()}>
                                        <EyeOff />Gỡ xuất bản…
                                    </Button>
                                )}
                            </div>
                        )}
                    </Section>

                    <Section title="Lịch sử phát hành">
                        <Alert>
                            <Info />
                            <AlertTitle>Chưa khả dụng</AlertTitle>
                            <AlertDescription>
                                Backend chưa lưu phiên bản.{data.venue.updatedAt ? ` Lần lưu gần nhất ${new Date(data.venue.updatedAt).toLocaleString("vi-VN")}.` : ""}
                            </AlertDescription>
                        </Alert>
                    </Section>
                </div>
            </div>
        </Page>
    );
}
