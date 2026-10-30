import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type * as Leaflet from "leaflet";
import { anchorsFromTwoPoints, controlDistance, createProjection, describeProjection, svgPixelsPerMeter, withMeasuredDistance, type ControlPoint, type FloorDto, type PlanDto } from "@indoor-map/core";
import { Check, CircleCheck, Layers, Minus, Plus, RotateCcw, Trash2, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import L from "../../lib/leaflet";
import { api } from "../../lib/data";
import { buildPlanOverlay, parsePlanSvg, rasterAsSvg } from "../../lib/planSvg";
import { planApi } from "../../console/api";
import { EmptyState } from "../../console/page";
import { HeaderActions, HeaderStatus, SaveState } from "../../console/Shell";
import { useAction, useFeedback } from "../../console/ui";
import { mapColors, signIcon } from "../layers";
import { useWorkspace } from "../Workspace";

// Tải bản vẽ mặt bằng và chấm 2 cặp điểm mốc: bấm trên bản vẽ (pixel), rồi bấm điểm tương ứng trên bản đồ (lat/lng).
type Pick = "a-img" | "a-map" | "b-img" | "b-map" | null;
interface Source {
    svg?: string;
    imageUrl?: string;
    width: number;
    height: number;
    fileName?: string;
}
interface Mark {
    image?: [number, number];
    latlng?: [number, number];
}

const MAX_BYTES = 8 * 1024 * 1024;
const STEPS = ["Tải bản vẽ", "Chấm 2 cặp mốc", "Đo và lưu"];

function sourceFromPlan(plan?: PlanDto): Source | null {
    if (!plan?.width || !plan.height || (!plan.svg && !plan.imageUrl)) return null;
    return { svg: plan.svg, imageUrl: plan.imageUrl, width: plan.width, height: plan.height };
}

/** URL dùng được trong <img>/L.imageOverlay cho bản vẽ */
function sourceUrl(source: Source, svgText: string | null): string | null {
    if (source.svg ?? svgText) return `data:image/svg+xml;charset=utf-8,${encodeURIComponent((source.svg ?? svgText)!)}`;
    return source.imageUrl ?? null;
}

async function readFile(file: File): Promise<Source> {
    if (file.size > MAX_BYTES) throw new Error("Tệp lớn hơn 8 MB. Hãy nén ảnh hoặc xuất SVG gọn hơn.");
    if (file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg")) {
        const text = await file.text();
        const doc = new DOMParser().parseFromString(text, "image/svg+xml").documentElement;
        if (!doc || doc.nodeName.toLowerCase() !== "svg") throw new Error("Tệp SVG không hợp lệ.");
        const vb = doc.getAttribute("viewBox")?.trim().split(/[\s,]+/).map(Number);
        const width = vb?.[2] || parseFloat(doc.getAttribute("width") || "0");
        const height = vb?.[3] || parseFloat(doc.getAttribute("height") || "0");
        if (!width || !height) throw new Error("SVG thiếu viewBox hoặc width/height.");
        return { svg: text, width, height, fileName: file.name };
    }
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error("Chỉ nhận SVG, PNG, JPG hoặc WebP. PDF: hãy xuất sang SVG/PNG trước.");
    const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Không đọc được tệp"));
        reader.readAsDataURL(file);
    });
    const size = await new Promise<{ w: number; h: number }>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => reject(new Error("Ảnh hỏng"));
        img.src = dataUrl;
    });
    return { imageUrl: dataUrl, width: size.w, height: size.h, fileName: file.name };
}

export default function CalibratePage() {
    const { venueId, data, model, reload } = useWorkspace();
    const { toast, confirm } = useFeedback();
    const { busy, run } = useAction();
    const [params, setParams] = useSearchParams();
    const floors = useMemo(() => [...data.floors].sort((a, b) => a.buildingId - b.buildingId || b.level - a.level), [data.floors]);
    const floorId = Number(params.get("floor")) || floors[0]?.id || null;
    const floor = floors.find(f => f.id === floorId);

    if (!floor) {
        return (
            <div className="mx-auto w-full max-w-3xl px-6 py-6">
                <EmptyState icon={<Layers />} title="Chưa có tầng" description="Thêm toà nhà và tầng trước, rồi tải bản vẽ cho từng tầng."
                    action={<Button asChild><Link to={`/builder/v/${venueId}/buildings`}>Thêm toà nhà và tầng</Link></Button>} />
            </div>
        );
    }
    return <Calibrator key={floor.id} floor={floor} floors={floors} onFloor={id => setParams({ floor: String(id) })}
        busy={busy} model={model} save={async plan => {
            const saved = await run(() => planApi.setPlan(venueId, floor.id, plan), plan ? "Đã lưu mặt bằng và điểm mốc" : "Đã gỡ mặt bằng");
            if (saved) await reload("floors");
            return Boolean(saved);
        }} toast={toast} confirm={confirm} buildingCode={id => data.buildings.find(b => b.id === id)?.code ?? ""}
        multiBuilding={data.buildings.length > 1} />;
}

interface CalibratorProps {
    floor: FloorDto;
    floors: FloorDto[];
    onFloor(id: number): void;
    busy: boolean;
    model: ReturnType<typeof useWorkspace>["model"];
    save(plan: PlanDto | null): Promise<boolean>;
    toast(text: string, kind?: "ok" | "err"): void;
    confirm: ReturnType<typeof useFeedback>["confirm"];
    buildingCode(id: number): string;
    multiBuilding: boolean;
}

function Calibrator({ floor, floors, onFloor, busy, model, save, toast, confirm, buildingCode, multiBuilding }: CalibratorProps) {
    const [source, setSource] = useState<Source | null>(() => sourceFromPlan(floor.plan));
    const [svgText, setSvgText] = useState<string | null>(null);
    const [a, setA] = useState<Mark>(() => (floor.plan?.anchor ? { image: floor.plan.anchor.image, latlng: floor.plan.anchor.latlng } : {}));
    const [b, setB] = useState<Mark>(() => (floor.plan?.end ? { image: floor.plan.end.image, latlng: floor.plan.end.latlng } : {}));
    const [depthScale, setDepthScale] = useState(floor.plan?.depthScale ?? 1);
    const [pick, setPick] = useState<Pick>(() => (floor.plan?.anchor ? null : "a-img"));
    const [opacity, setOpacity] = useState(0.6);
    const [dirty, setDirty] = useState(false);
    // Khoảng cách thật giữa 2 mốc (m), người dùng gõ; trống = tự lấy từ tỉ lệ khai trong SVG, hoặc theo bản đồ
    const [measured, setMeasured] = useState("");
    const fileInput = useRef<HTMLInputElement>(null);

    // Bản vẽ dạng tệp (/plans/...svg): tải chữ SVG để vẽ lớp chồng
    useEffect(() => {
        if (!source || source.svg || !source.imageUrl || source.imageUrl.startsWith("data:")) return;
        let alive = true;
        void api.fetchPlanSvg({ imageUrl: source.imageUrl }).then(text => alive && setSvgText(text));
        return () => {
            alive = false;
        };
    }, [source]);

    const pxPerMeter = useMemo(() => svgPixelsPerMeter(source?.svg ?? svgText ?? ""), [source, svgText]);
    const pixelGap = a.image && b.image ? Math.hypot(b.image[0] - a.image[0], b.image[1] - a.image[1]) : null;
    const typed = Number(measured.replace(",", "."));
    const autoMeters = pxPerMeter && pixelGap ? pixelGap / pxPerMeter : null;
    const meters = typed > 0 ? typed : autoMeters;
    const ctrlA = a.image && a.latlng ? ({ image: a.image, latlng: a.latlng } as ControlPoint) : null;
    const ctrlB = b.image && b.latlng ? ({ image: b.image, latlng: b.latlng } as ControlPoint) : null;
    const mapMeters = ctrlA && ctrlB ? controlDistance(ctrlA, ctrlB) : null;
    // Có số đo: B trên bản đồ được kéo dọc hướng A→B tới đúng khoảng cách đó
    const fixedB = ctrlA && ctrlB && meters ? withMeasuredDistance(ctrlA, ctrlB, meters) : ctrlB;
    const anchors = ctrlA && fixedB ? anchorsFromTwoPoints(ctrlA, fixedB) : null;
    const draft: PlanDto | null = source && anchors ? { ...source, anchor: anchors.anchor, end: anchors.end, depthScale } : null;
    const projection = useMemo(() => (draft ? createProjection(draft) : null), [draft?.anchor?.latlng[0], draft?.anchor?.latlng[1], draft?.end?.latlng[0], draft?.end?.latlng[1], depthScale, source]); // eslint-disable-line react-hooks/exhaustive-deps
    const info = draft ? describeProjection(draft) : null;
    const overlay = useMemo(() => (projection && draft ? { projection, plan: draft, svgText: source?.svg ?? svgText, opacity } : null),
        [projection, svgText, opacity, source]); // eslint-disable-line react-hooks/exhaustive-deps

    const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        try {
            const next = await readFile(file);
            setSource(next);
            setSvgText(null);
            setA({});
            setB({});
            setDepthScale(1);
            setMeasured("");
            setPick("a-img");
            setDirty(true);
            toast(`Đã tải ${file.name}, ${Math.round(next.width)}×${Math.round(next.height)}. Chấm 2 cặp mốc.`);
        } catch (err) {
            toast((err as Error).message, "err");
        }
    };

    const doSave = async () => {
        if (!source) return;
        const plan: PlanDto = { width: source.width, height: source.height, ...(source.svg ? { svg: source.svg } : { imageUrl: source.imageUrl }) };
        if (anchors) Object.assign(plan, { anchor: anchors.anchor, end: anchors.end, depthScale });
        if (await save(plan)) setDirty(false);
    };

    const removePlan = async () => {
        if (!(await confirm(`Gỡ mặt bằng của ${floor.name}?`, { danger: true, okLabel: "Gỡ mặt bằng", detail: "Địa điểm và lối đi vẫn giữ nguyên (theo lat/lng)." }))) return;
        if (await save(null)) {
            setSource(null);
            setA({});
            setB({});
        }
    };

    const hasA = Boolean(a.image && a.latlng);
    const hasB = Boolean(b.image && b.latlng);
    const pairs = Number(hasA) + Number(hasB);
    const step = !source ? 0 : pairs < 2 ? 1 : 2;
    const mpp = info ? (info.metersPerPixel < 0.1 ? `${(info.metersPerPixel * 100).toFixed(2).replace(".", ",")} cm/px` : `${info.metersPerPixel.toFixed(3).replace(".", ",")} m/px`) : "—";
    const gap = typed > 0 && mapMeters != null ? Math.abs(mapMeters - typed) : null;
    const canSave = Boolean(source) && (dirty || !floor.plan);
    const pickImage = pick === "a-img" || pick === "b-img";
    const pickMap = pick === "a-map" || pick === "b-map";
    const pickFile = () => fileInput.current?.click();
    const resetMarks = () => {
        setA({});
        setB({});
        setPick("a-img");
        setDirty(true);
    };

    return (
        <div className="flex min-h-0 flex-1">
            <HeaderStatus><SaveState state={busy ? "saving" : dirty ? "dirty" : "saved"} /></HeaderStatus>
            <HeaderActions>
                <Button disabled={!canSave || busy} title={source && pairs < 2 ? `Cần thêm ${2 - pairs} cặp mốc để căn chỉnh` : undefined} onClick={() => void doSave()}>
                    {anchors || !source ? "Lưu căn chỉnh" : "Lưu bản vẽ"}
                </Button>
            </HeaderActions>
            <input ref={fileInput} type="file" accept=".svg,image/svg+xml,image/png,image/jpeg,image/webp" hidden onChange={e => void onFile(e)} />

            {/* Trái: các bước, chọn tầng, tệp bản vẽ */}
            <aside aria-label="Tầng" className="flex w-64 shrink-0 flex-col border-r bg-background">
                <div className="border-b p-3">
                    <ol aria-label="Các bước" className="space-y-2">
                        {STEPS.map((label, i) => (
                            <li key={label} aria-current={i === step ? "step" : undefined} className="flex items-center gap-2 text-sm">
                                <span className={`flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-medium ${i < step ? "bg-success text-white" : i === step ? "bg-primary text-primary-foreground" : "border text-muted-foreground"}`}>
                                    {i < step ? <Check className="size-3" strokeWidth={3} /> : i + 1}
                                </span>
                                <span className={i === step ? "font-medium" : "text-muted-foreground"}>{label}</span>
                                {i < step && <span className="sr-only">(xong)</span>}
                            </li>
                        ))}
                    </ol>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-2">
                    <p className="px-2 pt-1 pb-2 text-xs font-medium text-muted-foreground">Tầng</p>
                    {floors.map(f => {
                        const active = f.id === floor.id;
                        return (
                            <button key={f.id} type="button" aria-current={active ? "true" : undefined} onClick={() => onFloor(f.id)}
                                className={`flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm ${active ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted"}`}>
                                {multiBuilding && <span className={`shrink-0 text-xs ${active ? "" : "text-muted-foreground"}`}>{buildingCode(f.buildingId)}</span>}
                                <span className="min-w-0 flex-1 truncate">{f.name}</span>
                                {f.plan?.anchor && <CircleCheck className="size-4 shrink-0 text-success" aria-label="Đã căn chỉnh" />}
                            </button>
                        );
                    })}
                </div>
                {source && (
                    <div className="border-t p-3">
                        <p className="truncate text-sm font-medium" title={source.fileName}>{source.fileName ?? "Bản vẽ đã lưu"}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">{Math.round(source.width)} × {Math.round(source.height)} px</p>
                    </div>
                )}
            </aside>

            {/* Giữa: bản vẽ (pixel) và bản đồ nền (lat/lng) cạnh nhau */}
            {!source ? (
                <section aria-label="Bản vẽ mặt bằng" className="relative flex min-w-0 flex-1 items-center justify-center bg-muted/40 p-6">
                    <div className="w-80 rounded-xl border bg-background p-5 shadow-lg">
                        <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Upload className="size-5" /></span>
                        <p className="mt-3 text-sm font-medium">{floor.name} chưa có bản vẽ</p>
                        <p className="mt-1 text-sm text-muted-foreground">SVG, PNG, JPG hoặc WebP, tối đa 8 MB. Không cần đúng hướng bắc.</p>
                        <Button size="sm" className="mt-4" onClick={pickFile}><Upload />Chọn tệp bản vẽ</Button>
                    </div>
                </section>
            ) : (
                <section aria-label="Căn chỉnh" className="grid min-w-0 flex-1 grid-cols-2 bg-muted/40">
                    <div role="region" aria-label="Bản vẽ mặt bằng" className="relative min-w-0 overflow-hidden">
                        <ImagePane source={source} url={sourceUrl(source, svgText)} a={a.image} b={b.image} picking={pickImage}
                            onPick={xy => {
                                setDirty(true);
                                if (pick === "a-img") { setA(m => ({ ...m, image: xy })); setPick("a-map"); }
                                else if (pick === "b-img") { setB(m => ({ ...m, image: xy })); setPick("b-map"); }
                            }} />
                        <PaneTag title="Bản vẽ" unit="pixel" />
                        {pickImage && <Hint onCancel={() => setPick(null)}>Bấm mốc {pick === "a-img" ? "A" : "B"} trên bản vẽ, ví dụ góc tường hoặc cột</Hint>}
                        <div role="toolbar" aria-label="Điểm mốc" className="absolute bottom-4 left-1/2 z-[800] flex -translate-x-1/2 items-center gap-1 rounded-lg border bg-background p-1 shadow-md">
                            <ToolButton label="Chấm lại mốc A" pressed={pick === "a-img" || pick === "a-map"} onClick={() => setPick("a-img")}><span className="text-sm font-semibold">A</span></ToolButton>
                            <ToolButton label="Chấm lại mốc B" pressed={pick === "b-img" || pick === "b-map"} onClick={() => setPick("b-img")}><span className="text-sm font-semibold">B</span></ToolButton>
                            <ToolButton label="Xoá cả hai mốc, chấm lại" onClick={resetMarks}><RotateCcw /></ToolButton>
                            <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-5" />
                            <ToolButton label="Thay bản vẽ" onClick={pickFile}><Upload /></ToolButton>
                        </div>
                    </div>
                    <div role="region" aria-label="Bản đồ nền" className="relative min-w-0 overflow-hidden border-l">
                        <WorldPane model={model} floor={floor} a={a.latlng} b={fixedB?.latlng ?? b.latlng} picking={pickMap} overlay={overlay}
                            onPick={ll => {
                                setDirty(true);
                                if (pick === "a-map") { setA(m => ({ ...m, latlng: ll })); setPick(b.image && b.latlng ? null : "b-img"); }
                                else if (pick === "b-map") { setB(m => ({ ...m, latlng: ll })); setPick(null); }
                            }} />
                        <PaneTag title="Bản đồ nền" unit="lat/lng" />
                        {pickMap && <Hint onCancel={() => setPick(null)}>Bấm vị trí {pick === "a-map" ? "A" : "B"} trên bản đồ</Hint>}
                    </div>
                </section>
            )}

            {/* Phải: kết quả căn chỉnh */}
            <aside aria-label="Kết quả" className="flex w-80 shrink-0 flex-col border-l bg-background">
                <div className="border-b p-4">
                    <h2 className="text-base font-semibold">Kết quả</h2>
                    <p className="mt-1 text-xs text-muted-foreground">{multiBuilding ? `${buildingCode(floor.buildingId)}, ` : ""}{floor.name}</p>
                </div>
                {source ? (
                    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
                        <dl className="grid grid-cols-[5rem_1fr] items-center gap-y-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
                            <dt className="text-xs text-muted-foreground">Cặp mốc</dt>
                            <dd><Badge className={pairs === 2 ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}>{pairs}/2</Badge></dd>
                            <dt className="text-xs text-muted-foreground">Góc xoay</dt>
                            <dd className="font-medium tabular-nums">{info ? `${String(info.rotation).replace(".", ",").replace("-", "−")}°` : "—"}</dd>
                            <dt className="text-xs text-muted-foreground">Tỉ lệ</dt>
                            <dd className="font-medium tabular-nums">{mpp}</dd>
                        </dl>
                        <div className="grid gap-2">
                            <Label htmlFor="measured">Khoảng cách thật A–B</Label>
                            <div className="relative">
                                <Input id="measured" inputMode="decimal" autoComplete="off" className="h-8 pr-8"
                                    placeholder={autoMeters ? autoMeters.toFixed(2).replace(".", ",") : "vd. 22,3"} value={measured}
                                    onChange={e => { setMeasured(e.target.value.replace(/[^\d.,]/g, "")); setDirty(true); }} />
                                <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">m</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {typed > 0
                                    ? "Tỉ lệ theo số đo, bản đồ chỉ quyết định vị trí và hướng."
                                    : autoMeters
                                        ? `Bản vẽ khai ${pxPerMeter} px = 1 m, đã tự áp dụng.`
                                        : "Để trống thì tỉ lệ ước theo bản đồ."}
                            </p>
                        </div>
                        <div role="status" className="flex items-center gap-2 rounded-lg border px-3 py-2">
                            <div className="min-w-0 flex-1">
                                <p className="text-xs text-muted-foreground">Chênh với bản đồ</p>
                                {gap != null
                                    ? <p className="text-lg font-semibold tabular-nums">{gap.toFixed(1).replace(".", ",")} m</p>
                                    : <p className="text-sm text-muted-foreground">{pairs < 2 ? "Cần đủ 2 cặp mốc" : "Nhập khoảng cách thật để so"}</p>}
                            </div>
                            {measured && <Button type="button" variant="ghost" size="sm" onClick={() => { setMeasured(""); setDirty(true); }}>Xoá số đo</Button>}
                        </div>
                        <div className="grid gap-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="depth">Co giãn chiều sâu</Label>
                                <span className="text-xs text-muted-foreground tabular-nums">{depthScale.toFixed(2).replace(".", ",")}</span>
                            </div>
                            <Slider id="depth" min={0.3} max={1.6} step={0.01} value={[depthScale]} onValueChange={([v]) => { setDepthScale(v ?? 1); setDirty(true); }} />
                        </div>
                        <div className="grid gap-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="op">Độ trong lớp chồng</Label>
                                <span className="text-xs text-muted-foreground tabular-nums">{Math.round(opacity * 100)}%</span>
                            </div>
                            <Slider id="op" min={0} max={1} step={0.05} value={[opacity]} onValueChange={([v]) => setOpacity(v ?? 0)} />
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-1 flex-col items-center gap-2 p-4 pt-14 text-center">
                        <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Upload className="size-5" /></span>
                        <p className="text-sm font-medium">Chưa có bản vẽ</p>
                        <p className="text-sm text-muted-foreground">Tải bản vẽ rồi chấm 2 cặp mốc.</p>
                    </div>
                )}
                {(source || floor.plan) && (
                    <div className="flex items-center gap-2 border-t p-3">
                        {floor.plan && <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => void removePlan()}><Trash2 />Gỡ mặt bằng</Button>}
                        {source && (pairs === 2
                            ? <span className="ml-auto text-xs text-muted-foreground">2/2 cặp mốc{info ? `, ${mpp}` : ""}</span>
                            : <span className="ml-auto text-xs text-warning">Cần thêm {2 - pairs} cặp mốc</span>)}
                    </div>
                )}
            </aside>
        </div>
    );
}

function PaneTag({ title, unit }: { title: string; unit: string }) {
    return (
        <div className="absolute top-3 left-3 z-[800] flex items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs shadow-sm">
            <span className="font-medium">{title}</span><span className="text-muted-foreground">{unit}</span>
        </div>
    );
}

function Hint({ children, onCancel }: { children: ReactNode; onCancel(): void }) {
    return (
        <div className="absolute top-16 left-1/2 z-[800] flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-3 rounded-full bg-primary px-4 py-1.5 text-sm text-primary-foreground shadow-md">
            <span className="min-w-0">{children}</span>
            <Button size="sm" variant="ghost" className="h-6 shrink-0 rounded-full px-2 hover:bg-white/10 hover:text-primary-foreground" onClick={onCancel}>Huỷ</Button>
        </div>
    );
}

function ToolButton({ label, pressed, onClick, children }: { label: string; pressed?: boolean; onClick(): void; children: ReactNode }) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button type="button" variant={pressed ? "default" : "ghost"} size="icon" className="size-8" aria-label={label} aria-pressed={pressed} onClick={onClick}>{children}</Button>
            </TooltipTrigger>
            <TooltipContent side="top">{label}</TooltipContent>
        </Tooltip>
    );
}

/** Nút phóng to, thu nhỏ nổi ở góc phải dưới của mỗi khung bản đồ */
function ZoomControls({ onZoom }: { onZoom(delta: 1 | -1): void }) {
    return (
        <div className="absolute right-3 bottom-4 z-[800] flex flex-col gap-1 rounded-lg border bg-background p-1 shadow-sm">
            <Button type="button" variant="ghost" size="icon" className="size-8" aria-label="Phóng to" onClick={() => onZoom(1)}><Plus /></Button>
            <Button type="button" variant="ghost" size="icon" className="size-8" aria-label="Thu nhỏ" onClick={() => onZoom(-1)}><Minus /></Button>
        </div>
    );
}

/** Lớp chứa Leaflet phủ kín khung; đang chấm mốc thì con trỏ hình chữ thập */
const paneClass = (picking: boolean) =>
    `absolute inset-0 [&.leaflet-container]:bg-transparent${picking ? " [&.leaflet-container]:cursor-crosshair [&_.leaflet-interactive]:cursor-crosshair" : ""}`;

/** Mốc A ô than chì, mốc B ô vàng (như bản thiết kế), nhãn ghi toạ độ của khung đó */
function anchorIcon(label: "A" | "B", coords: string) {
    const c = mapColors();
    return signIcon({ inner: label, label: `${label} (${coords})`, color: label === "A" ? c.graphite : c.signal, ink: label === "A" ? c.surface : c.graphite, showLabel: true });
}

/** Bản vẽ trong hệ toạ độ phẳng: pixel (x, y) <-> L.latLng(−y, x) */
function ImagePane({ source, url, a, b, picking, onPick }: { source: Source; url: string | null; a?: [number, number]; b?: [number, number]; picking: boolean; onPick(xy: [number, number]): void }) {
    const box = useRef<HTMLDivElement>(null);
    const mapRef = useRef<Leaflet.Map | null>(null);
    const marks = useRef<Leaflet.LayerGroup | null>(null);
    const pickRef = useRef({ picking, onPick });
    useEffect(() => {
        pickRef.current = { picking, onPick };
    }, [picking, onPick]);

    useEffect(() => {
        if (!box.current || !url) return undefined;
        const bounds = L.latLngBounds([-source.height, 0], [0, source.width]);
        const map = L.map(box.current, { crs: L.CRS.Simple, minZoom: -12, maxZoom: 6, zoomSnap: 0.25, zoomControl: false, attributionControl: false, rotateControl: false, doubleClickZoom: false });
        L.imageOverlay(url, bounds).addTo(map);
        map.fitBounds(bounds, { padding: [20, 20] });
        marks.current = L.layerGroup().addTo(map);
        map.on("click", e => {
            if (!pickRef.current.picking) return;
            const x = Math.round(e.latlng.lng * 10) / 10;
            const y = Math.round(-e.latlng.lat * 10) / 10;
            if (x < 0 || y < 0 || x > source.width || y > source.height) return;
            pickRef.current.onPick([x, y]);
        });
        mapRef.current = map;
        return () => {
            map.stop();
            map.remove();
        };
    }, [url, source.width, source.height]);

    useEffect(() => {
        const group = marks.current;
        if (!group) return;
        group.clearLayers();
        if (a) group.addLayer(L.marker([-a[1], a[0]], { icon: anchorIcon("A", `${Math.round(a[0])}, ${Math.round(a[1])}`), interactive: false }));
        if (b) group.addLayer(L.marker([-b[1], b[0]], { icon: anchorIcon("B", `${Math.round(b[0])}, ${Math.round(b[1])}`), interactive: false }));
    }, [a, b, url]);

    return (
        <>
            <div ref={box} className={paneClass(picking)} />
            <ZoomControls onZoom={d => (d > 0 ? mapRef.current?.zoomIn() : mapRef.current?.zoomOut())} />
        </>
    );
}

interface Overlay {
    projection: NonNullable<ReturnType<typeof createProjection>>;
    plan: PlanDto;
    svgText: string | null;
    opacity: number;
}

function WorldPane({ model, floor, a, b, picking, overlay, onPick }: {
    model: ReturnType<typeof useWorkspace>["model"]; floor: FloorDto; a?: [number, number]; b?: [number, number]; picking: boolean; overlay: Overlay | null; onPick(ll: [number, number]): void;
}) {
    const box = useRef<HTMLDivElement>(null);
    const mapRef = useRef<Leaflet.Map | null>(null);
    const marks = useRef<Leaflet.LayerGroup | null>(null);
    const over = useRef<Leaflet.LayerGroup | null>(null);
    const pickRef = useRef({ picking, onPick });
    useEffect(() => {
        pickRef.current = { picking, onPick };
    }, [picking, onPick]);

    useEffect(() => {
        if (!box.current) return undefined;
        const building = model.buildingsById.get(floor.buildingId);
        const center: [number, number] = a ?? (building?.centerLat != null && building.centerLng != null ? [building.centerLat, building.centerLng] : [model.venue.centerLat ?? 10.8, model.venue.centerLng ?? 106.66]);
        const map = L.map(box.current, { center, zoom: 18, maxZoom: 22, zoomSnap: 0.25, zoomControl: false, rotateControl: false, doubleClickZoom: false });
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 22, maxNativeZoom: 19, attribution: "&copy; OpenStreetMap" }).addTo(map);
        over.current = L.layerGroup().addTo(map);
        marks.current = L.layerGroup().addTo(map);
        map.on("click", e => pickRef.current.picking && pickRef.current.onPick([Math.round(e.latlng.lat * 1e7) / 1e7, Math.round(e.latlng.lng * 1e7) / 1e7]));
        mapRef.current = map;
        if (overlay) map.fitBounds(L.latLngBounds(overlay.projection.bounds.map(p => L.latLng(p.lat, p.lng))), { animate: false });
        return () => {
            map.stop();
            map.remove();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const group = marks.current;
        if (!group) return;
        group.clearLayers();
        if (a) group.addLayer(L.marker(a, { icon: anchorIcon("A", `${a[0].toFixed(6)}, ${a[1].toFixed(6)}`), interactive: false, zIndexOffset: 1000 }));
        if (b) group.addLayer(L.marker(b, { icon: anchorIcon("B", `${b[0].toFixed(6)}, ${b[1].toFixed(6)}`), interactive: false, zIndexOffset: 1000 }));
    }, [a, b]);

    useEffect(() => {
        const group = over.current;
        if (!group) return;
        group.clearLayers();
        if (!overlay) return;
        const bounds = L.latLngBounds(overlay.projection.bounds.map(p => L.latLng(p.lat, p.lng)));
        const svg = overlay.svgText ? parsePlanSvg(overlay.svgText) : overlay.plan.imageUrl ? rasterAsSvg(overlay.plan.imageUrl, overlay.plan.width ?? 1, overlay.plan.height ?? 1) : null;
        if (!svg) return;
        const layer = L.svgOverlay(buildPlanOverlay(svg, overlay.plan, overlay.projection), bounds, { interactive: false, opacity: overlay.opacity });
        group.addLayer(layer);
    }, [overlay]);

    return (
        <>
            <div ref={box} className={paneClass(picking)} />
            <ZoomControls onZoom={d => (d > 0 ? mapRef.current?.zoomIn() : mapRef.current?.zoomOut())} />
        </>
    );
}
