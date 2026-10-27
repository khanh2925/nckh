import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useSearchParams } from "react-router-dom";
import type * as Leaflet from "leaflet";
import { anchorsFromTwoPoints, controlDistance, createProjection, describeProjection, svgPixelsPerMeter, withMeasuredDistance, type ControlPoint, type FloorDto, type PlanDto } from "@indoor-map/core";
import L from "../../lib/leaflet";
import { api } from "../../lib/data";
import { buildPlanOverlay, parsePlanSvg, rasterAsSvg } from "../../lib/planSvg";
import { planApi } from "../../console/api";
import { Button, Status, useAction, useFeedback } from "../../console/ui";
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
        return <div className="cb-main"><div className="cb-empty"><div className="cb-h3">Chưa có tầng</div><p className="cb-muted">Thêm toà nhà và tầng trước.</p><Button to={`/builder/v/${venueId}/buildings`} variant="primary">Toà nhà & tầng →</Button></div></div>;
    }
    return <Calibrator key={floor.id} floor={floor} floors={floors} onFloor={id => setParams({ floor: String(id) })}
        busy={busy} model={model} save={async plan => {
            const saved = await run(() => planApi.setPlan(venueId, floor.id, plan), plan ? "Đã lưu mặt bằng và điểm mốc" : "Đã gỡ mặt bằng");
            if (saved) await reload("floors");
            return Boolean(saved);
        }} toast={toast} confirm={confirm} buildingCode={id => data.buildings.find(b => b.id === id)?.code ?? ""} />;
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
}

function Calibrator({ floor, floors, onFloor, busy, model, save, toast, confirm, buildingCode }: CalibratorProps) {
    const [source, setSource] = useState<Source | null>(() => sourceFromPlan(floor.plan));
    const [svgText, setSvgText] = useState<string | null>(null);
    const [a, setA] = useState<Mark>(() => (floor.plan?.anchor ? { image: floor.plan.anchor.image, latlng: floor.plan.anchor.latlng } : {}));
    const [b, setB] = useState<Mark>(() => (floor.plan?.end ? { image: floor.plan.end.image, latlng: floor.plan.end.latlng } : {}));
    const [depthScale, setDepthScale] = useState(floor.plan?.depthScale ?? 1);
    const [pick, setPick] = useState<Pick>(() => (floor.plan?.anchor ? null : "a-img"));
    const [opacity, setOpacity] = useState(0.6);
    const [dirty, setDirty] = useState(false);
    const [panelOpen, setPanelOpen] = useState(true);
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
            toast(`Đã tải ${file.name} · ${Math.round(next.width)}×${Math.round(next.height)}. Chấm 2 điểm mốc.`);
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

    const stepState = (done: boolean, active: boolean) => (done ? "is-done" : active ? "is-active" : "");
    const hasA = Boolean(a.image && a.latlng);
    const hasB = Boolean(b.image && b.latlng);

    return (
        <div style={{ display: "flex", flexDirection: "column", minHeight: "calc(100dvh - 56px)" }}>
            <div className="cb-calib-steps">
                <select className="cb-input" style={{ width: 260 }} aria-label="Tầng" value={floor.id} onChange={e => onFloor(Number(e.target.value))}>
                    {floors.map(f => <option key={f.id} value={f.id}>{buildingCode(f.buildingId)} · {f.name}{f.plan?.anchor ? " ✓" : ""}</option>)}
                </select>
                <span className={`cb-step ${stepState(Boolean(source), !source)}`}><b>1</b>Tải bản vẽ (SVG/PNG/JPG){source && <span className="cb-mono"> · {source.fileName ?? "đã có"} · {Math.round(source.width)}×{Math.round(source.height)}</span>}</span>
                <span className={`cb-step ${stepState(hasA && hasB, Boolean(source) && !(hasA && hasB))}`}><b>2</b>Chấm 2 cặp điểm mốc</span>
                <span className={`cb-step ${stepState(!dirty && Boolean(floor.plan?.anchor), hasA && hasB)}`}><b>3</b>Kiểm tra lớp chồng, lưu</span>
                <div className="cb-actions" style={{ marginLeft: "auto" }}>
                    <input ref={fileInput} type="file" accept=".svg,image/svg+xml,image/png,image/jpeg,image/webp" hidden onChange={e => void onFile(e)} />
                    <Button icon="bi-upload" onClick={() => fileInput.current?.click()}>{source ? "Thay bản vẽ" : "Tải bản vẽ"}</Button>
                    {floor.plan && <Button variant="danger" onClick={() => void removePlan()}>Gỡ mặt bằng</Button>}
                    <Button variant="primary" busy={busy} disabled={!source || (!dirty && Boolean(floor.plan))} onClick={() => void doSave()}>{anchors ? "Lưu căn chỉnh" : "Lưu bản vẽ (chưa chấm mốc)"}</Button>
                </div>
            </div>

            {!source ? (
                <div className="cb-main"><div className="cb-empty">
                    <div className="cb-h3">Tầng này chưa có bản vẽ</div>
                    <p className="cb-muted">Tải bản vẽ mặt bằng (SVG từ AutoCAD/CorelDRAW/Illustrator, hoặc ảnh PNG/JPG chụp thẳng). Tối đa 8 MB. Bản vẽ không cần đúng hướng Bắc — hệ thống tự xoay theo 2 điểm mốc.</p>
                    <Button variant="primary" icon="bi-upload" onClick={() => fileInput.current?.click()}>Chọn tệp bản vẽ</Button>
                </div></div>
            ) : (
                <div className="cb-calib">
                    <section className="cb-calib-pane" aria-label="Bản vẽ mặt bằng">
                        <div className="cb-pane-label">Bản vẽ · pixel</div>
                        <ImagePane source={source} url={sourceUrl(source, svgText)} a={a.image} b={b.image}
                            picking={pick === "a-img" || pick === "b-img"}
                            onPick={xy => {
                                setDirty(true);
                                if (pick === "a-img") { setA(m => ({ ...m, image: xy })); setPick("a-map"); }
                                else if (pick === "b-img") { setB(m => ({ ...m, image: xy })); setPick("b-map"); }
                            }} />
                        {(pick === "a-img" || pick === "b-img") && <div className="cb-hint">Bấm điểm mốc {pick === "a-img" ? "A" : "B"} trên bản vẽ (góc tường, cột, cửa dễ nhận ra)</div>}
                    </section>
                    <section className="cb-calib-pane" aria-label="Bản đồ nền">
                        <div className="cb-pane-label">Bản đồ nền · lat/lng</div>
                        <WorldPane model={model} floor={floor} a={a.latlng} b={fixedB?.latlng ?? b.latlng} picking={pick === "a-map" || pick === "b-map"}
                            overlay={overlay}
                            onPick={ll => {
                                setDirty(true);
                                if (pick === "a-map") { setA(m => ({ ...m, latlng: ll })); setPick(b.image && b.latlng ? null : "b-img"); }
                                else if (pick === "b-map") { setB(m => ({ ...m, latlng: ll })); setPick(null); }
                            }} />
                        {(pick === "a-map" || pick === "b-map") && <div className="cb-hint">Bấm đúng điểm {pick === "a-map" ? "A" : "B"} đó trên bản đồ thật</div>}
                        <div className={`cb-calib-panel${panelOpen ? "" : " is-collapsed"}`}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div className="cb-h3">Tham số chiếu</div>
                                <button type="button" className="cb-btn cb-btn-ghost is-small" aria-expanded={panelOpen} onClick={() => setPanelOpen(o => !o)}>{panelOpen ? "Thu gọn" : "Mở"}</button>
                            </div>
                            <div className="cb-kv">
                                <span>Mốc A</span>{hasA ? <Status kind="ok">đã chấm</Status> : <Status kind="warn">{pick?.startsWith("a") ? "đang chấm" : "chưa"}</Status>}
                                <span>Mốc B</span>{hasB ? <Status kind="ok">đã chấm</Status> : <Status kind="warn">{pick?.startsWith("b") ? "đang chấm" : "chưa"}</Status>}
                                <span>Góc xoay</span><b className="cb-mono">{info ? `${info.rotation}°` : "—"}</b>
                                <span>Tỉ lệ</span><b className="cb-mono">{info ? (info.metersPerPixel < 0.1 ? `${(info.metersPerPixel * 100).toFixed(2)} cm/px` : `${info.metersPerPixel.toFixed(3)} m/px`) : "—"}</b>
                            </div>
                            <div className="cb-field" style={{ gap: 4 }}>
                                <label className="cb-label" htmlFor="measured">Khoảng cách thật A–B</label>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <input id="measured" className="cb-input" inputMode="decimal" style={{ width: 110, fontFamily: "var(--mono)" }}
                                        placeholder={autoMeters ? autoMeters.toFixed(2) : "vd. 22,3"} value={measured}
                                        onChange={e => { setMeasured(e.target.value.replace(/[^\d.,]/g, "")); setDirty(true); }} />
                                    <span className="cb-muted">m</span>
                                    {measured && <button type="button" className="cb-btn cb-btn-ghost is-small" onClick={() => { setMeasured(""); setDirty(true); }}>Xoá</button>}
                                </div>
                                <div className="cb-field-help" style={{ fontSize: 12 }}>
                                    {typed > 0
                                        ? <>Tỉ lệ theo số đo. {mapMeters != null && <>Bạn chấm trên bản đồ: <b className="cb-mono">{mapMeters.toFixed(1)} m</b> → B đã được kéo về đúng {typed} m.</>}</>
                                        : autoMeters
                                            ? <>Bản vẽ khai tỉ lệ <b className="cb-mono">{pxPerMeter} px = 1 m</b> → A–B = <b className="cb-mono">{autoMeters.toFixed(2)} m</b>, đã tự áp dụng.</>
                                            : <>Đo bằng thước dây, máy laser hoặc app Đo trên iPhone. Để trống thì tỉ lệ lấy theo bản đồ (chỉ ước lượng{mapMeters != null ? `, hiện ${mapMeters.toFixed(1)} m` : ""}).</>}
                                </div>
                            </div>
                            <label className="cb-label" htmlFor="depth" style={{ display: "flex", justifyContent: "space-between" }}>Co giãn chiều sâu <span className="cb-mono">{depthScale.toFixed(2)}</span></label>
                            <input id="depth" type="range" min={0.3} max={1.6} step={0.01} value={depthScale} onChange={e => { setDepthScale(Number(e.target.value)); setDirty(true); }} />
                            <label className="cb-label" htmlFor="op" style={{ display: "flex", justifyContent: "space-between" }}>Độ trong lớp chồng <span className="cb-mono">{Math.round(opacity * 100)}%</span></label>
                            <input id="op" type="range" min={0} max={1} step={0.05} value={opacity} onChange={e => setOpacity(Number(e.target.value))} />
                            <div className="cb-actions">
                                <Button small onClick={() => setPick("a-img")}>Chấm lại A</Button>
                                <Button small onClick={() => setPick("b-img")}>Chấm lại B</Button>
                            </div>
                            <p className="cb-muted" style={{ fontSize: 12 }}>Chọn 2 mốc càng xa nhau càng chính xác. Có số đo thật thì bản đồ chỉ còn quyết định vị trí và hướng. Bản vẽ bị kéo giãn theo chiều sâu thì chỉnh “co giãn” tới khi tường khớp đường phố.</p>
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
}

function anchorIcon(label: "A" | "B") {
    return L.divIcon({ className: "", html: `<span class="cb-anchor is-${label.toLowerCase()}"><span>${label}</span></span>`, iconSize: [26, 26], iconAnchor: [13, 13] });
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
        const map = L.map(box.current, { crs: L.CRS.Simple, minZoom: -12, maxZoom: 6, zoomSnap: 0.25, attributionControl: false, rotateControl: false, doubleClickZoom: false });
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
        if (a) group.addLayer(L.marker([-a[1], a[0]], { icon: anchorIcon("A"), interactive: false }));
        if (b) group.addLayer(L.marker([-b[1], b[0]], { icon: anchorIcon("B"), interactive: false }));
    }, [a, b, url]);

    return <div ref={box} className={`cb-map${picking ? " is-picking" : ""}`} />;
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
        const map = L.map(box.current, { center, zoom: 18, maxZoom: 22, zoomSnap: 0.25, rotateControl: false, doubleClickZoom: false });
        L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", { subdomains: "abcd", maxZoom: 22, maxNativeZoom: 20, attribution: "&copy; OpenStreetMap &copy; CARTO" }).addTo(map);
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
        if (a) group.addLayer(L.marker(a, { icon: anchorIcon("A"), interactive: false, zIndexOffset: 1000 }));
        if (b) group.addLayer(L.marker(b, { icon: anchorIcon("B"), interactive: false, zIndexOffset: 1000 }));
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

    return <div ref={box} className={`cb-map${picking ? " is-picking" : ""}`} />;
}
