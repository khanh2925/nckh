import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import type * as Leaflet from "leaflet";
import { normalizeText } from "@indoor-map/core";
import L from "../../lib/leaflet";
import { venueApi } from "../../console/api";
import { Button, Card, Field, PageHead, TextArea, useFeedback } from "../../console/ui";
import { KIND_LABEL } from "./VenuesPage";

const KINDS = ["airport", "school", "hospital", "mall", "park", "office", "other"];

// eslint-disable-next-line react-refresh/only-export-components
export function slugify(text: string): string {
    return normalizeText(text).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
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
        if (value.length >= 2) group.addLayer(L.polygon(value, { color: "#2D5BE3", weight: 2.5, fillOpacity: 0.14, interactive: false }));
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

export default function VenueCreatePage() {
    const navigate = useNavigate();
    const { toast } = useFeedback();
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

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !slugOk) return;
        setBusy(true);
        setError(null);
        const center = outline.length
            ? [outline.reduce((s, p) => s + p[0], 0) / outline.length, outline.reduce((s, p) => s + p[1], 0) / outline.length]
            : null;
        try {
            const venue = await venueApi.create({
                name: name.trim(), slug: finalSlug, kind, description: description.trim() || undefined,
                outline: outline.length >= 3 ? outline : undefined, centerLat: center?.[0], centerLng: center?.[1]
            });
            toast("Đã tạo địa điểm. Tiếp theo: thêm toà nhà và tầng.");
            navigate(`/builder/v/${venue.id}/buildings`, { replace: true });
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <form onSubmit={submit} className="cb-stack" style={{ gap: 20 }}>
            <PageHead title="Tạo địa điểm mới" sub="Thông tin và phạm vi. Sau khi tạo, các loại địa điểm mẫu theo loại hình được thêm sẵn; bạn sửa được bất cứ lúc nào."
                actions={<Button to="/builder">Huỷ</Button>} />
            <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 440px) 1fr", gap: 20, alignItems: "start" }}>
                <Card>
                    <div className="cb-form">
                        <Field label="Tên địa điểm" required value={name} onChange={e => setName(e.target.value)} placeholder="Toà nhà H – Đại học Công nghiệp TP.HCM" />
                        <div className="cb-field">
                            <label htmlFor="slug">Đường dẫn công khai</label>
                            <div style={{ display: "flex", alignItems: "stretch", border: "1px solid #D0D5DD", borderRadius: 6, overflow: "hidden" }}>
                                <span className="cb-mono" style={{ padding: "0 10px", display: "flex", alignItems: "center", background: "#F3F4F6", borderRight: "1px solid #D0D5DD", color: "#6B7280" }}>/v/</span>
                                <input id="slug" className="cb-input" style={{ border: 0, borderRadius: 0, fontFamily: "var(--mono)" }} value={finalSlug}
                                    onChange={e => { setSlugTouched(true); setSlug(e.target.value.toLowerCase()); }} />
                            </div>
                            <div className={slugOk || !finalSlug ? "cb-field-help" : "cb-field-error"}>{slugOk ? "Tự sinh từ tên, có thể sửa. Chỉ chữ thường, số, dấu gạch ngang." : "Chỉ gồm chữ thường không dấu, số và dấu gạch ngang."}</div>
                        </div>
                        <div className="cb-field">
                            <span className="cb-label">Loại hình</span>
                            <div className="cb-grid-2">
                                {KINDS.map(k => (
                                    <label key={k} className="cb-check" style={{ border: `1px solid ${kind === k ? "#2D5BE3" : "#D0D5DD"}`, background: kind === k ? "#EEF2FB" : "#fff", borderRadius: 6, padding: "8px 10px" }}>
                                        <input type="radio" name="kind" checked={kind === k} onChange={() => setKind(k)} /><span>{KIND_LABEL[k]}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <TextArea label="Mô tả ngắn (hiện trên điện thoại)" value={description} onChange={e => setDescription(e.target.value)} />
                        {error && <div className="cb-alert is-err" role="alert"><i className="bi bi-x-circle" aria-hidden="true" /><span>{error}</span></div>}
                        <div className="cb-actions"><Button type="submit" variant="primary" busy={busy} disabled={!name.trim() || !slugOk}>Tạo và thêm toà nhà →</Button></div>
                    </div>
                </Card>
                <Card title="Khoanh vùng trên bản đồ (không bắt buộc)" pad={false}
                    actions={<><span className="cb-mono" style={{ color: "#6B7280" }}>{outline.length} đỉnh</span><Button small onClick={() => setOutline(o => o.slice(0, -1))} disabled={!outline.length}>Bỏ đỉnh cuối</Button><Button small onClick={() => setOutline([])} disabled={!outline.length}>Xoá</Button></>}>
                    <p className="cb-muted" style={{ padding: "10px 16px 0" }}>Bấm từng góc để vẽ đa giác; kéo đỉnh để sửa. Dùng cho vùng bao trên màn chọn địa điểm và tâm bản đồ.</p>
                    <div style={{ padding: 16 }}><OutlineMap value={outline} onChange={setOutline} /></div>
                </Card>
            </div>
        </form>
    );
}
