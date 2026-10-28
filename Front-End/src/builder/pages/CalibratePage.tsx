import { Fragment, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useSearchParams } from "react-router-dom";
import type * as Leaflet from "leaflet";
import { anchorsFromTwoPoints, controlDistance, createProjection, describeProjection, svgPixelsPerMeter, withMeasuredDistance, type ControlPoint, type FloorDto, type PlanDto, type VenueDto } from "@indoor-map/core";
import L from "../../lib/leaflet";
import { api } from "../../lib/data";
import { buildPlanOverlay, parsePlanSvg, rasterAsSvg } from "../../lib/planSvg";
import { planApi } from "../../console/api";
import { HeaderActions, HeaderStatus, SaveState } from "../../console/Shell";
import { Button, useAction, useFeedback } from "../../console/ui";
import Lc from "../../design/Lc";
import { GuestLink } from "../FloorList";
import { mapColors, signIcon } from "../layers";
import { useWorkspace } from "../Workspace";
import "./workspace.css";

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
        return (
            <div className="k-page">
                <HeaderActions><GuestLink venue={data.venue} /></HeaderActions>
                <h1 className="k24">Căn chỉnh mặt bằng</h1>
                <section className="k-card ws-empty">
                    <h2 className="k16">Chưa có tầng</h2>
                    <p className="k14 k-m">Thêm toà nhà và tầng trước, rồi tải bản vẽ cho từng tầng.</p>
                    <div className="ws-mt8"><Button to={`/builder/v/${venueId}/buildings`} variant="primary">Thêm toà nhà và tầng</Button></div>
                </section>
            </div>
        );
    }
    return <Calibrator key={floor.id} floor={floor} floors={floors} onFloor={id => setParams({ floor: String(id) })}
        busy={busy} model={model} venue={data.venue} venueId={venueId} save={async plan => {
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
    venue: VenueDto;
    venueId: number;
    save(plan: PlanDto | null): Promise<boolean>;
    toast(text: string, kind?: "ok" | "err"): void;
    confirm: ReturnType<typeof useFeedback>["confirm"];
    buildingCode(id: number): string;
}

function Calibrator({ floor, floors, onFloor, busy, model, venue, venueId, save, toast, confirm, buildingCode }: CalibratorProps) {
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

    return (
        <div className="ws-col" style={{ height: "100%" }}>
            <HeaderStatus><SaveState state={busy ? "saving" : dirty ? "dirty" : "saved"} /></HeaderStatus>
            <HeaderActions><GuestLink venue={venue} /></HeaderActions>
            <input ref={fileInput} type="file" accept=".svg,image/svg+xml,image/png,image/jpeg,image/webp" hidden onChange={e => void onFile(e)} />
            <div className="k-page ws-fill">
                <div className="k-title">
                    <h1 className="k24">Căn chỉnh mặt bằng</h1>
                    <div className="k-acts">
                        <label htmlFor="cal-floor" className="sr-only">Toà và tầng</label>
                        <select id="cal-floor" className="k-input" style={{ width: 240 }} value={floor.id} onChange={e => onFloor(Number(e.target.value))}>
                            {floors.map(f => <option key={f.id} value={f.id}>{buildingCode(f.buildingId)} – {f.name}{f.plan?.anchor ? " ✓" : ""}</option>)}
                        </select>
                    </div>
                </div>
                <Steps labels={["Tải bản vẽ", "Chấm 2 cặp mốc", "Đo và lưu"]} current={step} />

                {!source ? (
                    <section className="k-card ws-drop ws-fill">
                        <h2 className="k16 k-line"><Lc name="upload" size={18} color="var(--muted)" />{floor.name} chưa có bản vẽ</h2>
                        <p className="k14 k-m">SVG, PNG, JPG hoặc WebP, tối đa 8 MB. Bản vẽ không cần đúng hướng bắc, hệ thống tự xoay theo 2 cặp mốc.</p>
                        <div className="ws-mt8"><Button variant="primary" icon="upload" onClick={() => fileInput.current?.click()}>Chọn tệp bản vẽ</Button></div>
                    </section>
                ) : (
                    <div className="ws-calib">
                        <section aria-label="Bản vẽ mặt bằng" className="k-card ws-mapcard">
                            <ImagePane source={source} url={sourceUrl(source, svgText)} a={a.image} b={b.image}
                                picking={pick === "a-img" || pick === "b-img"}
                                onPick={xy => {
                                    setDirty(true);
                                    if (pick === "a-img") { setA(m => ({ ...m, image: xy })); setPick("a-map"); }
                                    else if (pick === "b-img") { setB(m => ({ ...m, image: xy })); setPick("b-map"); }
                                }} />
                            <div className="ws-tag is-left56"><span className="k-b">Bản vẽ</span><span className="k-m">pixel</span></div>
                            <div className="ws-tools">
                                <button type="button" className="k-btn sm" onClick={() => fileInput.current?.click()}>Thay bản vẽ</button>
                                <button type="button" className="k-btn sm" onClick={() => { setA({}); setB({}); setPick("a-img"); setDirty(true); }}>Chấm lại mốc</button>
                            </div>
                            {(pick === "a-img" || pick === "b-img") && <div className="cb-hint">Bấm mốc {pick === "a-img" ? "A" : "B"} trên bản vẽ: góc tường, cột hoặc cửa dễ nhận ra</div>}
                        </section>
                        <section aria-label="Bản đồ nền" className="k-card ws-mapcard">
                            <WorldPane model={model} floor={floor} a={a.latlng} b={fixedB?.latlng ?? b.latlng} picking={pick === "a-map" || pick === "b-map"}
                                overlay={overlay}
                                onPick={ll => {
                                    setDirty(true);
                                    if (pick === "a-map") { setA(m => ({ ...m, latlng: ll })); setPick(b.image && b.latlng ? null : "b-img"); }
                                    else if (pick === "b-map") { setB(m => ({ ...m, latlng: ll })); setPick(null); }
                                }} />
                            <div className="ws-tag is-left56"><span className="k-b">Bản đồ nền</span><span className="k-m">lat/lng</span></div>
                            {(pick === "a-map" || pick === "b-map") && <div className="cb-hint">Bấm vị trí {pick === "a-map" ? "A" : "B"} trên bản đồ</div>}
                        </section>
                        <aside aria-labelledby="res-title" className="k-card" style={{ overflowY: "auto" }}>
                            <h2 id="res-title" className="k16">Kết quả</h2>
                            <div>
                                <div className="ws-kvrow k14"><span className="k-m">Cặp mốc</span><span className={`k-b ${pairs === 2 ? "k-ok" : "k-warn"}`}>{pairs}/2</span></div>
                                <div className="ws-kvrow k14"><span className="k-m">Góc xoay</span><span className="k-b">{info ? `${String(info.rotation).replace(".", ",").replace("-", "−")}°` : "—"}</span></div>
                                <div className="ws-kvrow k14"><span className="k-m">Tỉ lệ</span><span className="k-b">{mpp}</span></div>
                            </div>
                            <div className="k-line">
                                <button type="button" className="k-btn sm" onClick={() => setPick("a-img")}>Chấm lại A</button>
                                <button type="button" className="k-btn sm" onClick={() => setPick("b-img")}>Chấm lại B</button>
                            </div>
                            <div className="k-field">
                                <label htmlFor="measured">Khoảng cách thật A–B</label>
                                <div className="ws-suffix">
                                    <input id="measured" className="k-input" inputMode="decimal" autoComplete="off"
                                        placeholder={autoMeters ? autoMeters.toFixed(2).replace(".", ",") : "vd. 22,3"} value={measured}
                                        onChange={e => { setMeasured(e.target.value.replace(/[^\d.,]/g, "")); setDirty(true); }} />
                                    <span className="k14 k-m">m</span>
                                </div>
                                <span className="k-hint">
                                    {typed > 0
                                        ? "Tỉ lệ theo số đo, bản đồ chỉ quyết định vị trí và hướng."
                                        : autoMeters
                                            ? `Bản vẽ khai ${pxPerMeter} px = 1 m, đã tự áp dụng.`
                                            : "Đo bằng thước, máy laser hoặc app Đo. Để trống thì tỉ lệ ước theo bản đồ."}
                                </span>
                            </div>
                            <div role="status" className="k-kpi">
                                <span className="k12 k-m">Chênh với bản đồ</span>
                                {gap != null
                                    ? <span className="k28">{gap.toFixed(1).replace(".", ",")} m</span>
                                    : <span className="k14 k-m" style={{ lineHeight: "32px" }}>{pairs < 2 ? "Cần đủ 2 cặp mốc" : "Nhập khoảng cách thật để so"}</span>}
                            </div>
                            {measured && <div><button type="button" className="k-btn t sm" style={{ paddingLeft: 0 }} onClick={() => { setMeasured(""); setDirty(true); }}>Xoá số đo</button></div>}
                            <div className="k-field" style={{ marginTop: "auto" }}>
                                <label htmlFor="depth" style={{ display: "flex", justifyContent: "space-between" }}>Co giãn chiều sâu <span style={{ fontWeight: 400 }}>{depthScale.toFixed(2).replace(".", ",")}</span></label>
                                <input id="depth" type="range" min={0.3} max={1.6} step={0.01} value={depthScale} style={{ width: "100%", margin: 0 }} onChange={e => { setDepthScale(Number(e.target.value)); setDirty(true); }} />
                            </div>
                            <div className="k-field">
                                <label htmlFor="op" style={{ display: "flex", justifyContent: "space-between" }}>Độ trong lớp chồng <span style={{ fontWeight: 400 }}>{Math.round(opacity * 100)}%</span></label>
                                <input id="op" type="range" min={0} max={1} step={0.05} value={opacity} style={{ width: "100%", margin: 0 }} onChange={e => setOpacity(Number(e.target.value))} />
                            </div>
                        </aside>
                    </div>
                )}
            </div>
            <div className="ws-foot">
                <div>
                    <Button to={`/builder/v/${venueId}/buildings`}>Quay lại</Button>
                    {floor.plan && <Button variant="danger" onClick={() => void removePlan()}>Gỡ mặt bằng</Button>}
                    <div className="k-line ws-right" style={{ gap: 16 }}>
                        {source && (pairs === 2
                            ? <span className="k12 k-m">2/2 cặp mốc{info ? `, ${mpp}` : ""}</span>
                            : <span id="save-reason" className="k12 k-warn">Cần thêm {2 - pairs} cặp mốc để căn chỉnh</span>)}
                        <Button variant="primary" busy={busy} disabled={!canSave} onClick={() => void doSave()}>{anchors || !source ? "Lưu căn chỉnh" : "Lưu bản vẽ"}</Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

/** Thanh bước 1 · 2 · 3 (dùng chung với Nhập CSV) */
export function Steps({ labels, current }: { labels: string[]; current: number }) {
    return (
        <ol aria-label="Các bước" className="ws-steps k14">
            {labels.map((t, i) => (
                <Fragment key={t}>
                    {i > 0 && <li aria-hidden="true" className="sep" />}
                    {i < current
                        ? <li className="k-m"><Lc name="check" size={16} color="var(--ok)" />{t}<span className="sr-only">(xong)</span></li>
                        : <li aria-current={i === current ? "step" : undefined} className={i === current ? "k-b" : "k-m"}>{i + 1}. {t}</li>}
                </Fragment>
            ))}
        </ol>
    );
}

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
        if (a) group.addLayer(L.marker([-a[1], a[0]], { icon: anchorIcon("A", `${Math.round(a[0])}, ${Math.round(a[1])}`), interactive: false }));
        if (b) group.addLayer(L.marker([-b[1], b[0]], { icon: anchorIcon("B", `${Math.round(b[0])}, ${Math.round(b[1])}`), interactive: false }));
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

    return <div ref={box} className={`cb-map${picking ? " is-picking" : ""}`} />;
}
