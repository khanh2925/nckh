import { Fragment, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { normalizeText, type ImportResultDto, type LocationDto } from "@indoor-map/core";
import { Check, CircleAlert, CircleCheck, Download, FileText, ListChecks, TriangleAlert, Upload } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { catalogApi, locationApi } from "../../console/api";
import { Page, Section, Stat } from "../../console/page";
import { COLORS, useAction } from "../../console/ui";
import { floorLabel } from "../FloorList";
import { useWorkspace } from "../Workspace";

// Nhập hàng loạt địa điểm từ CSV hoặc GeoJSON vào một tầng. Kiểm tra trên trình duyệt trước, rồi gửi một lần.
const FIELDS = [
    ["name", "Tên"], ["type", "Loại"], ["x", "x (px)"], ["y", "y (px)"], ["lat", "Vĩ độ (lat)"], ["lng", "Kinh độ (lng)"],
    ["area", "Khu vực"], ["description", "Mô tả"], ["openingHours", "Giờ mở"], ["phone", "Điện thoại"], ["website", "Trang web"], ["facilities", "Tiện ích"]
] as const;
type FieldKey = (typeof FIELDS)[number][0];
const GUESS: Record<string, FieldKey> = {
    name: "name", ten: "name", "tên": "name", type: "type", loai: "type", "loại": "type", x: "x", y: "y", lat: "lat", latitude: "lat", "vĩ độ": "lat",
    lng: "lng", lon: "lng", longitude: "lng", "kinh độ": "lng", area: "area", khu_vuc: "area", "khu vực": "area", description: "description", mo_ta: "description",
    "mô tả": "description", openinghours: "openingHours", hours: "openingHours", gio_mo: "openingHours", phone: "phone", dien_thoai: "phone",
    website: "website", facilities: "facilities", tien_ich: "facilities", "tiện ích": "facilities"
};

/** CSV đơn giản: dấu phẩy hoặc chấm phẩy, có ngoặc kép */
function parseCsv(text: string): string[][] {
    const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
    const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = "";
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i]!;
        if (quoted) {
            if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
            else if (c === '"') quoted = false;
            else cell += c;
        } else if (c === '"') quoted = true;
        else if (c === sep) { row.push(cell); cell = ""; }
        else if (c === "\n" || c === "\r") {
            if (c === "\r" && text[i + 1] === "\n") i++;
            row.push(cell); rows.push(row); row = []; cell = "";
        } else cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(r => r.some(x => x.trim()));
}

interface Row {
    index: number;
    dto: Partial<LocationDto>;
    errors: string[];
    warnings: string[];
}


const NEED: [string, string, string][] = [
    ["ten", "Tên", "Bắt buộc"], ["loai", "Loại", "Tuỳ chọn"], ["x, y", "Vị trí (px)", "Bắt buộc, hoặc lat, lng"],
    ["mo_ta", "Mô tả", "Tuỳ chọn"], ["tien_ich", "Tiện ích, cách nhau bởi ;", "Tuỳ chọn"], ["gio_mo", "Giờ mở cửa", "Tuỳ chọn"]
];
const SAMPLE = "ten,loai,x,y,mo_ta,tien_ich,gio_mo\nQuầy thông tin,info,640,410,Hỏi đường,Wi-Fi;Ổ cắm sạc,05:00–22:00\n";

/** Tải xuống một tệp chữ tạo ngay trên trình duyệt */
function downloadText(name: string, text: string, type = "text/csv;charset=utf-8") {
    const url = URL.createObjectURL(new Blob(["\uFEFF" + text], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const csvCell = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export default function ImportPage() {
    const { venueId, data, model, reload } = useWorkspace();
    const { busy, run } = useAction();
    const [params] = useSearchParams();
    const [floorId, setFloorId] = useState<number>(Number(params.get("floor")) || model.defaultFloor?.id || model.floors[0]?.id || 0);
    const [fileName, setFileName] = useState<string | null>(null);
    const [reading, setReading] = useState(false);
    const [header, setHeader] = useState<string[]>([]);
    const [records, setRecords] = useState<Record<string, string>[]>([]);
    const [mapping, setMapping] = useState<Record<string, FieldKey | "">>({});
    const [createTypes, setCreateTypes] = useState(true);
    const [dupPolicy, setDupPolicy] = useState<"skip" | "keep">("skip");
    const [filter, setFilter] = useState<"all" | "review">("all");
    const [over, setOver] = useState(false);
    const [result, setResult] = useState<ImportResultDto | null>(null);
    const [error, setError] = useState<{ file: string; message: string } | null>(null);
    const fileInput = useRef<HTMLInputElement>(null);
    const floor = model.floorsById.get(floorId);
    const typeCodes = new Set(data.types.map(t => t.code));
    const typeByName = new Map(data.types.map(t => [t.name.toLowerCase(), t.code]));
    const base = `/builder/v/${venueId}`;

    const readFile = async (file: File) => {
        setResult(null);
        setError(null);
        setReading(true);
        try {
            const text = await file.text();
            if (/\.(geo)?json$/i.test(file.name)) {
                const json = JSON.parse(text) as { features?: { geometry?: { type: string; coordinates: number[] }; properties?: Record<string, unknown> }[] };
                const features = (json.features ?? []).filter(f => f.geometry?.type === "Point");
                if (!features.length) throw new Error("no points");
                const recs = features.map(f => ({
                    ...Object.fromEntries(Object.entries(f.properties ?? {}).map(([k, v]) => [k, Array.isArray(v) ? v.join(";") : String(v ?? "")])),
                    lng: String(f.geometry!.coordinates[0]), lat: String(f.geometry!.coordinates[1])
                }));
                const keys = [...new Set(recs.flatMap(r => Object.keys(r)))];
                setHeader(keys);
                setRecords(recs);
                setMapping(Object.fromEntries(keys.map(k => [k, GUESS[k.toLowerCase()] ?? ""])));
            } else if (/\.(csv|txt)$/i.test(file.name) || file.type === "text/csv") {
                const rows = parseCsv(text.replace(/^\uFEFF/, ""));
                const [head = [], ...body] = rows;
                if (!head.length || !body.length) throw new Error("empty");
                const keys = head.map(h => h.trim());
                setHeader(keys);
                setRecords(body.map(r => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()]))));
                setMapping(Object.fromEntries(keys.map(k => [k, GUESS[k.toLowerCase()] ?? ""])));
            } else {
                throw new Error("format");
            }
            setFileName(file.name);
        } catch {
            setHeader([]);
            setRecords([]);
            setFileName(null);
            setError({ file: file.name, message: "Chỉ nhận CSV (UTF-8, dòng đầu là tiêu đề) hoặc GeoJSON gồm các Point. Trong Excel, chọn Lưu thành, rồi chọn CSV UTF-8." });
        } finally {
            setReading(false);
        }
    };
    const onFile = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (file) void readFile(file);
    };
    const onDrop = (e: DragEvent) => {
        e.preventDefault();
        setOver(false);
        const file = e.dataTransfer.files[0];
        if (file) void readFile(file);
    };

    const existingNames = useMemo(() => new Set(model.locations.filter(l => l.floorId === floorId).map(l => normalizeText(l.name))), [model, floorId]);

    const rows: Row[] = useMemo(() => records.map((rec, index) => {
        const get = (key: FieldKey) => {
            const column = Object.entries(mapping).find(([, f]) => f === key)?.[0];
            return column ? rec[column]?.trim() ?? "" : "";
        };
        const errors: string[] = [];
        const warnings: string[] = [];
        const num = (v: string) => (v === "" ? undefined : Number(v.replace(",", ".")));
        let x = num(get("x"));
        let y = num(get("y"));
        let lat = num(get("lat"));
        let lng = num(get("lng"));
        const projection = floor?.projection;
        if (lat == null || lng == null) {
            if (x != null && y != null && projection) ({ lat, lng } = projection.toLatLng(x, y));
            else if (x != null && y != null) errors.push("tầng chưa căn chỉnh, không đổi được x, y");
            else errors.push("thiếu toạ độ");
        } else if (projection && (x == null || y == null)) {
            const xy = projection.toImage({ lat, lng });
            x = Math.round(xy.x * 10) / 10;
            y = Math.round(xy.y * 10) / 10;
        }
        if ([x, y, lat, lng].some(v => v != null && Number.isNaN(v))) errors.push("toạ độ không phải số");
        if (projection && x != null && y != null && floor?.plan?.width && floor.plan.height && (x < 0 || y < 0 || x > floor.plan.width || y > floor.plan.height)) {
            warnings.push("nằm ngoài mặt bằng");
        }
        const name = get("name");
        if (!name) errors.push("thiếu tên");
        else if (existingNames.has(normalizeText(name))) (dupPolicy === "skip" ? errors : warnings).push("trùng tên trên tầng");
        let type = get("type");
        if (type && !typeCodes.has(type)) {
            const byName = typeByName.get(type.toLowerCase());
            if (byName) type = byName;
            else warnings.push(createTypes ? `tạo loại mới “${type}”` : `loại “${type}” chưa có, sẽ thành Địa điểm khác`);
        }
        const facilities = get("facilities").split(/[;|]/).map(s => s.trim()).filter(Boolean);
        const dto: Partial<LocationDto> = {
            floorId, name, type: type || "other", x, y, lat, lng, area: get("area") || undefined, description: get("description") || undefined,
            openingHours: get("openingHours") || undefined, phone: get("phone") || undefined, website: get("website") || undefined,
            facilities: facilities.length ? [...new Set(facilities)] : undefined
        };
        return { index, dto, errors, warnings };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [records, mapping, floor, createTypes, data.types, existingNames, dupPolicy]);

    const valid = rows.filter(r => !r.errors.length);
    const newTypes = [...new Set(valid.map(r => r.dto.type!).filter(t => !typeCodes.has(t)))];
    const bad = rows.length - valid.length;
    const warned = valid.filter(r => r.warnings.length).length;
    const mappedFields = new Set(Object.values(mapping).filter(Boolean));
    const hasCoords = (mappedFields.has("x") && mappedFields.has("y")) || (mappedFields.has("lat") && mappedFields.has("lng"));
    const mappingOk = mappedFields.has("name") && hasCoords;
    const step = !fileName ? 0 : mappingOk ? 2 : 1;
    const shown = filter === "all" ? rows : rows.filter(r => r.errors.length || r.warnings.length);

    const submit = async () => {
        const done = await run(async () => {
            if (createTypes) {
                for (const code of newTypes) {
                    const clean = code.toLowerCase().replace(/[^a-z0-9_]/g, "_");
                    await catalogApi.createType(venueId, { code: clean, name: code, icon: "bi-geo-alt", color: COLORS[COLORS.length - 1], groupName: "service" });
                    valid.forEach(r => { if (r.dto.type === code) r.dto.type = clean; });
                }
            } else {
                valid.forEach(r => { if (!typeCodes.has(r.dto.type!)) r.dto.type = "other"; });
            }
            return locationApi.importMany(venueId, valid.map(r => r.dto));
        });
        if (done) {
            setResult(done);
            await reload("locations", "types", "facilities");
        }
    };

    const downloadErrors = () => {
        const lines = [["dong", ...header, "loi"].map(csvCell).join(",")];
        rows.filter(r => r.errors.length).forEach(r => lines.push([r.index + 2, ...header.map(h => records[r.index]?.[h] ?? ""), r.errors.join("; ")].map(csvCell).join(",")));
        downloadText(`${(fileName ?? "tep").replace(/\.[^.]+$/, "")}_loi.csv`, lines.join("\n"));
    };

    const typeLabel = (code?: string) => data.types.find(t => t.code === code)?.name ?? code ?? "";
    const reset = () => {
        setFileName(null);
        setHeader([]);
        setRecords([]);
        setResult(null);
        setError(null);
        fileInput.current?.click();
    };

    const floors = model.buildings.flatMap(b => model.floorsOf(b.id));
    const editorLink = `${base}/editor?floor=${floorId}`;

    let actions: ReactNode = <Button disabled>Nhập điểm</Button>;
    if (result) {
        actions = (
            <>
                <Button variant="outline" onClick={reset}><Upload />Nhập tệp khác</Button>
                <Button asChild><Link to={editorLink}>Xem trên mặt bằng</Link></Button>
            </>
        );
    } else if (fileName && !reading) {
        actions = (
            <>
                {bad > 0 && <Button variant="outline" onClick={downloadErrors}><Download />Tải dòng lỗi</Button>}
                <Button variant="outline" asChild><Link to={editorLink}>Huỷ</Link></Button>
                <Button disabled={!valid.length || !mappingOk || busy} onClick={() => void submit()}>Nhập {valid.length} dòng hợp lệ</Button>
            </>
        );
    }

    return (
        <Page width="wide" actions={actions}>
            <input ref={fileInput} type="file" accept=".csv,.txt,.json,.geojson,text/csv,application/json,application/geo+json" hidden onChange={onFile} />
            <div className="flex flex-wrap items-center gap-2">
                <Steps labels={["Chọn tệp", "Ghép cột", "Kiểm tra và nhập"]} current={result ? 3 : step} />
                <div className="ml-auto flex items-center gap-2">
                    <Label htmlFor="imp-floor" className="font-normal whitespace-nowrap text-muted-foreground">Nhập vào</Label>
                    <Select value={floorId ? String(floorId) : ""} onValueChange={v => setFloorId(Number(v))}>
                        <SelectTrigger id="imp-floor" className="w-56"><SelectValue placeholder="Chọn tầng" /></SelectTrigger>
                        <SelectContent>
                            {floors.map(f => <SelectItem key={f.id} value={String(f.id)}>{model.buildings.length > 1 ? `${f.buildingCode} ${f.name}` : f.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {!fileName && !reading ? (
                <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
                    <section aria-label="Chọn tệp" onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={onDrop}
                        className={`flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center transition-colors ${over ? "border-primary bg-primary/5" : error ? "border-destructive/40 bg-destructive/5" : ""}`}>
                        {error ? (
                            <>
                                <span className="flex size-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive"><CircleAlert className="size-5" /></span>
                                <div className="space-y-1">
                                    <p role="alert" className="text-sm font-medium">Không đọc được tệp {error.file}</p>
                                    <p className="max-w-md text-sm text-muted-foreground">{error.message}</p>
                                </div>
                                <Button onClick={() => fileInput.current?.click()}>Chọn tệp khác</Button>
                            </>
                        ) : (
                            <>
                                <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Upload className="size-5" /></span>
                                <div className="space-y-1">
                                    <p className="text-sm font-medium">Kéo tệp vào đây</p>
                                    <p className="text-sm text-muted-foreground">CSV (UTF-8) hoặc GeoJSON</p>
                                </div>
                                <Button onClick={() => fileInput.current?.click()}>Chọn tệp</Button>
                            </>
                        )}
                    </section>
                    <Section title="Cột trong tệp" flush actions={<Button variant="outline" size="sm" onClick={() => downloadText("mau_diem_quan_tam.csv", SAMPLE)}><Download />Tải tệp mẫu</Button>}>
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="pl-6">Cột</TableHead>
                                    <TableHead>Nội dung</TableHead>
                                    <TableHead className="pr-6">Yêu cầu</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {NEED.map(([a, b, c]) => (
                                    <TableRow key={a}>
                                        <TableCell className="pl-6 font-mono text-xs">{a}</TableCell>
                                        <TableCell className="whitespace-normal">{b}</TableCell>
                                        <TableCell className="pr-6 whitespace-normal text-muted-foreground">{c}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Section>
                </div>
            ) : (
                <div className="grid items-start gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
                    <div className="grid gap-6">
                        <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><FileText className="size-4" /></span>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium" title={fileName ?? ""}>{fileName ?? "Đang đọc tệp"}</p>
                                <p className="text-xs text-muted-foreground">{reading ? "Đang đọc…" : `${records.length} dòng`}</p>
                            </div>
                            {!reading && <Button variant="outline" size="sm" onClick={reset}>Đổi tệp</Button>}
                        </div>
                        {reading ? (
                            <div aria-hidden="true" className="grid gap-3 rounded-xl border p-6">
                                <Skeleton className="h-4 w-24" />
                                {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-8 w-full" />)}
                            </div>
                        ) : (
                            <>
                                <Section title="Ghép cột" flush actions={<Badge className={mappingOk ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}>{header.filter(h => mapping[h]).length}/{header.length}</Badge>}>
                                    <Table>
                                        <TableHeader className="bg-muted/50">
                                            <TableRow>
                                                <TableHead className="pl-4">Cột trong tệp</TableHead>
                                                <TableHead className="pr-4">Trường</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {header.map(h => (
                                                <TableRow key={h}>
                                                    <TableCell className="max-w-28 truncate pl-4 text-muted-foreground" title={h}>{h}</TableCell>
                                                    <TableCell className="pr-4">
                                                        <Select value={mapping[h] || "skip"} onValueChange={v => setMapping(m => ({ ...m, [h]: v === "skip" ? "" : (v as FieldKey) }))}>
                                                            <SelectTrigger size="sm" className="w-full" aria-label={`Trường cho cột ${h}`}><SelectValue /></SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="skip">Bỏ qua</SelectItem>
                                                                {FIELDS.map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                    {!mappingOk && <p className="border-t px-4 py-3 text-xs text-warning">Cần ghép cột Tên và toạ độ (x, y hoặc lat, lng).</p>}
                                </Section>
                                <Section title="Tuỳ chọn">
                                    <div className="grid gap-4">
                                        <div className="flex items-center gap-2">
                                            <Checkbox id="imp-types" checked={createTypes} onCheckedChange={v => setCreateTypes(v === true)} />
                                            <Label htmlFor="imp-types" className="font-normal">{newTypes.length ? `Tạo ${newTypes.length} loại mới` : "Tạo loại chưa có"}</Label>
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="dup">Trùng tên trên tầng</Label>
                                            <Select value={dupPolicy} onValueChange={v => setDupPolicy(v as "skip" | "keep")}>
                                                <SelectTrigger id="dup" className="w-full"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="skip">Bỏ qua dòng trùng</SelectItem>
                                                    <SelectItem value="keep">Vẫn nhập</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </Section>
                            </>
                        )}
                    </div>

                    <section aria-label="Kết quả kiểm tra" className="grid min-w-0 gap-6" role={reading ? "status" : undefined}>
                        {reading ? (
                            <>
                                <div aria-hidden="true" className="grid grid-cols-3 gap-4">
                                    {[0, 1, 2].map(i => <Skeleton key={i} className="h-18 rounded-xl" />)}
                                </div>
                                <div aria-hidden="true" className="grid gap-3 rounded-xl border p-6">
                                    {Array.from({ length: 7 }, (_, i) => <Skeleton key={i} className="h-6 w-full" />)}
                                </div>
                            </>
                        ) : result ? (
                            <Section title={`Đã nhập vào ${floorLabel(model, floor)}`}>
                                <div className="grid gap-4">
                                    <div className="grid grid-cols-3 gap-4">
                                        <Stat icon={<CircleCheck />} tone="green" label="Đã nhập" value={result.imported} />
                                        <Stat icon={<CircleAlert />} tone="amber" label="Máy chủ từ chối" value={result.skipped} />
                                        <Stat icon={<ListChecks />} tone="blue" label="Bỏ qua trước khi gửi" value={bad} />
                                    </div>
                                    {result.errors.length > 0 && (
                                        <Alert variant="destructive">
                                            <CircleAlert />
                                            <AlertTitle>Máy chủ báo lỗi</AlertTitle>
                                            <AlertDescription><ul className="list-disc pl-4">{result.errors.map(e => <li key={e}>{e}</li>)}</ul></AlertDescription>
                                        </Alert>
                                    )}
                                </div>
                            </Section>
                        ) : (
                            <>
                                <div className="grid grid-cols-3 gap-4">
                                    <Stat icon={<CircleCheck />} tone="green" label="Sẽ nhập" value={valid.length} hint={warned ? `${warned} có cảnh báo` : undefined} />
                                    <Stat icon={<CircleAlert />} tone="amber" label="Bị bỏ qua" value={bad} hint="dòng lỗi" />
                                    <Stat icon={<ListChecks />} tone="blue" label="Tổng" value={rows.length} hint="dòng trong tệp" />
                                </div>
                                <Section title="Kiểm tra từng dòng" flush actions={
                                    <Tabs value={filter} onValueChange={v => setFilter(v as "all" | "review")}>
                                        <TabsList aria-label="Lọc dòng">
                                            <TabsTrigger value="all">Tất cả {rows.length}</TabsTrigger>
                                            <TabsTrigger value="review">Cần xem {bad + warned}</TabsTrigger>
                                        </TabsList>
                                    </Tabs>
                                }>
                                    <Table>
                                        <TableHeader className="bg-muted/50">
                                            <TableRow>
                                                <TableHead className="w-16 pl-6">Dòng</TableHead>
                                                <TableHead>Tên</TableHead>
                                                <TableHead>Loại</TableHead>
                                                <TableHead>Vị trí</TableHead>
                                                <TableHead className="pr-6">Kiểm tra</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {shown.slice(0, 200).map(r => (
                                                <TableRow key={r.index}>
                                                    <TableCell className="pl-6 text-muted-foreground tabular-nums">{r.index + 2}</TableCell>
                                                    <TableCell className="font-medium">{r.dto.name || <span className="text-destructive">(trống)</span>}</TableCell>
                                                    <TableCell>{typeLabel(r.dto.type)}</TableCell>
                                                    <TableCell className="text-muted-foreground tabular-nums">
                                                        {r.dto.x != null ? `${Math.round(r.dto.x)}, ${Math.round(r.dto.y ?? 0)}` : r.dto.lat != null ? `${r.dto.lat.toFixed(5)}, ${r.dto.lng?.toFixed(5)}` : "—"}
                                                    </TableCell>
                                                    <TableCell className="pr-6">
                                                        {r.errors.length ? <Badge className="h-auto bg-destructive/10 text-left whitespace-normal text-destructive"><CircleAlert />Bỏ qua: {r.errors.join(", ")}</Badge>
                                                            : r.warnings.length ? <Badge className="h-auto bg-warning/10 text-left whitespace-normal text-warning"><TriangleAlert />{r.warnings.join(", ").replace(/^./, c => c.toUpperCase())}</Badge>
                                                                : <span className="inline-flex items-center gap-1 text-muted-foreground"><Check className="size-3.5" />Hợp lệ</span>}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            {!shown.length && <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Không có dòng nào cần xem.</TableCell></TableRow>}
                                        </TableBody>
                                    </Table>
                                    {shown.length > 200 && <p className="border-t px-6 py-3 text-xs text-muted-foreground">Hiện 200 trên {shown.length} dòng.</p>}
                                </Section>
                            </>
                        )}
                    </section>
                </div>
            )}
        </Page>
    );
}

/** Thanh bước 1, 2, 3 (xong = tick tròn xanh, đang làm = số trên nền chính) */
function Steps({ labels, current }: { labels: string[]; current: number }) {
    return (
        <ol aria-label="Các bước" className="flex flex-wrap items-center gap-2 text-sm">
            {labels.map((t, i) => (
                <Fragment key={t}>
                    {i > 0 && <li aria-hidden="true" className="h-px w-6 bg-border" />}
                    <li aria-current={i === current ? "step" : undefined} className="flex items-center gap-2">
                        <span className={`flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-medium ${i < current ? "bg-success text-white" : i === current ? "bg-primary text-primary-foreground" : "border text-muted-foreground"}`}>
                            {i < current ? <Check className="size-3" strokeWidth={3} /> : i + 1}
                        </span>
                        <span className={i === current ? "font-medium" : "text-muted-foreground"}>{t}</span>
                        {i < current && <span className="sr-only">(xong)</span>}
                    </li>
                </Fragment>
            ))}
        </ol>
    );
}
