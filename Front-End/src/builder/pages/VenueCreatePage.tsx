import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import type * as Leaflet from "leaflet";
import { normalizeText } from "@indoor-map/core";
import L from "../../lib/leaflet";
import { venueApi } from "../../console/api";
import { Button, useFeedback } from "../../console/ui";
import Lc from "../../design/Lc";
import { KIND_LABEL } from "./VenuesPage";
import "./global.css";

const KINDS = ["airport", "hospital", "school", "mall", "park", "office", "other"];

// eslint-disable-next-line react-refresh/only-export-components
export function slugify(text: string): string {
    return normalizeText(text).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

/** Diện tích (m²) của đa giác lat/lng nhỏ: chiếu phẳng quanh tâm rồi dùng công thức dây giày */
function areaM2(points: [number, number][]): number {
    if (points.length < 3) return 0;
    const lat0 = points.reduce((s, p) => s + p[0], 0) / points.length;
    const kx = 111320 * Math.cos((lat0 * Math.PI) / 180);
    const ky = 110540;
    let sum = 0;
    points.forEach((p, i) => {
        const q = points[(i + 1) % points.length]!;
        sum += p[1] * kx * q[0] * ky - q[1] * kx * p[0] * ky;
    });
    return Math.abs(sum) / 2;
}

function formatArea(m2: number): string {
    if (m2 >= 10000) return `${(m2 / 10000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} ha`;
    return `${Math.round(m2).toLocaleString("vi-VN")} m²`;
}

/** Bản đồ khoanh vùng: bấm để thêm đỉnh, kéo đỉnh để sửa */
export function OutlineMap({ value, onChange, center }: { value: [number, number][]; onChange: (v: [number, number][]) => void; center?: [number, number] }) {
    const box = useRef<HTMLDivElement>(null);
    const mapRef = useRef<Leaflet.Map | null>(null);
    const layer = useRef<Leaflet.LayerGroup | null>(null);
    const valueRef = useRef(value);
    const changeRef = useRef(onChange);
    useEffect(() => {
        valueRef.current = value;
        changeRef.current = onChange;
    }, [value, onChange]);

    useEffect(() => {
        if (!box.current) return undefined;
        const map = L.map(box.current, { center: center ?? [10.8231, 106.6297], zoom: center ? 17 : 12, rotateControl: false, doubleClickZoom: false });
        L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", { subdomains: "abcd", maxZoom: 20, attribution: "&copy; OpenStreetMap &copy; CARTO" }).addTo(map);
        layer.current = L.layerGroup().addTo(map);
        map.on("click", e => changeRef.current([...valueRef.current, [e.latlng.lat, e.latlng.lng]]));
        mapRef.current = map;
        if (valueRef.current.length) map.fitBounds(L.latLngBounds(valueRef.current), { padding: [40, 40] });
        return () => {
            map.stop();
            map.remove();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const group = layer.current;
        if (!group) return;
        group.clearLayers();
        // màu đặt bằng lớp CSS .kg-outline (biến màu), không ghi mã màu ở đây
        if (value.length >= 2) group.addLayer(L.polygon(value, { className: "kg-outline", weight: 2, interactive: false }));
        value.forEach((p, i) => {
            const marker = L.marker(p, {
                draggable: true, title: `Đỉnh ${i + 1}`,
                icon: L.divIcon({ className: "", html: '<span class="cb-vertex"></span>', iconSize: [12, 12], iconAnchor: [6, 6] })
            });
            marker.on("dragend", () => {
                const ll = marker.getLatLng();
                changeRef.current(valueRef.current.map((q, j) => (j === i ? [ll.lat, ll.lng] : q)));
            });
            group.addLayer(marker);
        });
    }, [value]);

    return <div ref={box} className="cb-map" style={{ minHeight: 440 }} />;
}

function Steps({ step }: { step: 1 | 2 }) {
    const items: [string, "is-on" | "is-done" | ""][] = step === 1
        ? [["1. Thông tin", "is-on"], ["2. Phạm vi trên bản đồ", ""]]
        : [["1. Thông tin", "is-done"], ["2. Phạm vi trên bản đồ", "is-on"]];
    return (
        <ol className="kg-steps" aria-label="Các bước">
            {items.map(([label, state]) => (
                <li key={label} className={state} aria-current={state === "is-on" ? "step" : undefined}>
                    <span className="bar" aria-hidden="true" />
                    <span className={state === "is-on" ? "k14 k-b" : state === "is-done" ? "k14" : "k14 k-m"}>
                        {label}{state === "is-done" && <span className="k-m"> (xong)</span>}
                    </span>
                </li>
            ))}
        </ol>
    );
}

export default function VenueCreatePage() {
    const navigate = useNavigate();
    const { toast } = useFeedback();
    const [step, setStep] = useState<1 | 2>(1);
    const [name, setName] = useState("");
    const [slug, setSlug] = useState("");
    const [slugTouched, setSlugTouched] = useState(false);
    const [kind, setKind] = useState("school");
    const [description, setDescription] = useState("");
    const [outline, setOutline] = useState<[number, number][]>([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const finalSlug = slugTouched ? slug : slugify(name);
    const slugOk = /^[a-z0-9]+(-[a-z0-9]+)*$/.test(finalSlug);
    const canNext = name.trim().length > 0 && slugOk;

    const create = async (withOutline: boolean) => {
        if (!canNext) return;
        setBusy(true);
        setError(null);
        const shape = withOutline && outline.length >= 3 ? outline : [];
        const center = shape.length
            ? [shape.reduce((s, p) => s + p[0], 0) / shape.length, shape.reduce((s, p) => s + p[1], 0) / shape.length]
            : null;
        try {
            const venue = await venueApi.create({
                name: name.trim(), slug: finalSlug, kind, description: description.trim() || undefined,
                outline: shape.length ? shape : undefined, centerLat: center?.[0], centerLng: center?.[1]
            });
            toast("Đã tạo địa điểm. Tiếp theo: thêm toà nhà và tầng.");
            navigate(`/builder/v/${venue.id}/buildings`, { replace: true });
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setBusy(false);
        }
    };

    const submit = (e: FormEvent) => {
        e.preventDefault();
        if (step === 1) {
            if (canNext) setStep(2);
            return;
        }
        void create(true);
    };

    return (
        <>
            <div className="k-title"><h1 className="k24">Tạo địa điểm</h1></div>
            {step === 1 ? <Steps step={1} /> : (
                <div className="k-line" style={{ alignItems: "flex-end", gap: 24 }}>
                    <Steps step={2} /><span className="k12 k-m">Không bắt buộc, sửa được sau</span>
                </div>
            )}
            <form id="venue-form" onSubmit={submit} aria-label="Thông tin địa điểm" className={step === 1 ? "k-card kg-form" : undefined}>
                {step === 1 ? (
                    <>
                        <div className="k-field">
                            <label htmlFor="vname">Tên địa điểm</label>
                            <input id="vname" className="k-input" type="text" autoComplete="off" maxLength={200} required value={name}
                                onChange={e => setName(e.target.value)} placeholder="vd. Bệnh viện Chợ Rẫy" />
                        </div>
                        <div className="k-field">
                            <label htmlFor="slug">Đường dẫn công khai</label>
                            <div className={`kg-slug${finalSlug && !slugOk ? " is-bad" : ""}`}>
                                <span className="pre k14 k-m">{window.location.host}/v/</span>
                                <input id="slug" className="k14" type="text" autoComplete="off" spellCheck={false} maxLength={60} required value={finalSlug}
                                    aria-invalid={finalSlug && !slugOk ? true : undefined} aria-describedby="slug-lock"
                                    onChange={e => { setSlugTouched(true); setSlug(e.target.value.toLowerCase()); }} />
                                {finalSlug && !slugOk && <span role="alert" className="k-badge k-danger"><Lc name="circle-alert" size={14} />Sai định dạng</span>}
                            </div>
                            <span id="slug-lock" className="k-hint">
                                {finalSlug && !slugOk ? "Chỉ chữ thường không dấu, số và dấu gạch ngang." : "Không đổi được sau lần xuất bản đầu (mã QR dùng đường dẫn này)"}
                            </span>
                        </div>
                        <div className="k-field">
                            <label htmlFor="kind">Loại hình</label>
                            <select id="kind" className="k-input" value={kind} onChange={e => setKind(e.target.value)}>
                                {KINDS.map(k => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
                            </select>
                        </div>
                        <div className="k-field">
                            <label htmlFor="desc">Mô tả ngắn <span style={{ fontWeight: 400 }}>(không bắt buộc)</span></label>
                            <textarea id="desc" className="k-input" rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Hiện trên điện thoại của khách" />
                        </div>
                    </>
                ) : (
                    <section aria-label="Khoanh vùng trên bản đồ" className="k-card kg-mapbox">
                        <OutlineMap value={outline} onChange={setOutline} />
                        <dl className="kg-float kg-facts k-card tight">
                            <div><dt className="k12 k-m">Đỉnh</dt><dd className="k14 k-b">{outline.length}</dd></div>
                            <div><dt className="k12 k-m">Diện tích</dt><dd className="k14 k-b">{outline.length >= 3 ? formatArea(areaM2(outline)) : "—"}</dd></div>
                        </dl>
                        <div className="kg-float kg-undo"><Button small icon="undo-2" onClick={() => setOutline(o => o.slice(0, -1))} disabled={!outline.length}>Bỏ đỉnh cuối</Button></div>
                        <span className="kg-float kg-hint k12">Bấm từng góc để vẽ, kéo đỉnh để sửa</span>
                    </section>
                )}
            </form>
            {error && <div className="k-note" role="alert"><Lc name="circle-alert" size={16} color="var(--danger)" /><div>{error}</div></div>}
            <div className="kg-foot">
                {step === 1 ? (
                    <>
                        <Button to="/builder">Huỷ</Button>
                        <span className="k12 k-m grow">Bước 1/2</span>
                        <button type="submit" form="venue-form" className="k-btn p" disabled={!canNext} title={canNext ? undefined : "Nhập tên và đường dẫn hợp lệ"}>Tiếp: Phạm vi</button>
                    </>
                ) : (
                    <>
                        <Button onClick={() => setStep(1)}>Quay lại</Button>
                        <span className="k12 k-m grow">Bước 2/2</span>
                        <Button variant="ghost" disabled={busy} onClick={() => void create(false)}>Bỏ qua, khoanh sau</Button>
                        <button type="submit" form="venue-form" className="k-btn p" disabled={busy} aria-busy={busy || undefined}>
                            {busy && <span className="cb-spinner is-inline" aria-hidden="true" />}Tạo địa điểm
                        </button>
                    </>
                )}
            </div>
        </>
    );
}
