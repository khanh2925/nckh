import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import type * as Leaflet from "leaflet";
import { Check, CircleAlert, LoaderCircle, Undo2 } from "lucide-react";
import { normalizeText } from "@indoor-map/core";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import L from "../../lib/leaflet";
import { venueApi } from "../../console/api";
import { Page, Section } from "../../console/page";
import { useFeedback } from "../../console/ui";
import { mapColors } from "../layers";
import { LocationPicker, pinIcon } from "../LocationPicker";
import { KIND_LABEL } from "./VenuesPage";

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

/** Bản đồ khoanh vùng: bấm để thêm đỉnh, kéo đỉnh để sửa. `pin` = vị trí địa điểm (chỉ hiện, không kéo). className mặc định: cao tối thiểu 440 */
export function OutlineMap({ value, onChange, center, pin, className = "min-h-110" }: {
    value: [number, number][]; onChange: (v: [number, number][]) => void; center?: [number, number]; pin?: [number, number] | null; className?: string;
}) {
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
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 22, maxNativeZoom: 19, attribution: "&copy; OpenStreetMap" }).addTo(map);
        layer.current = L.layerGroup().addTo(map);
        if (pin) L.marker(pin, { icon: pinIcon(), interactive: false, keyboard: false }).addTo(map);
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
        // Leaflet cần chuỗi màu thật: lấy từ mapColors() (token chung của bản đồ)
        const c = mapColors();
        if (value.length >= 2) group.addLayer(L.polygon(value, { color: c.graphite, weight: 2, fillColor: c.signal, fillOpacity: 0.26, interactive: false }));
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

    return <div ref={box} className={`cb-map ${className}`} />;
}

const STEPS = ["Thông tin", "Vị trí", "Phạm vi"];
type Step = 1 | 2 | 3;

function Steps({ step }: { step: Step }) {
    return (
        <ol aria-label="Các bước" className="flex items-center gap-3">
            {STEPS.map((label, i) => {
                const n = i + 1;
                const done = n < step;
                const on = n === step;
                return (
                    <li key={label} aria-current={on ? "step" : undefined} className="flex items-center gap-3">
                        {i > 0 && <span aria-hidden="true" className="h-px w-8 bg-border" />}
                        <span className={`flex size-6 items-center justify-center rounded-full text-xs font-medium tabular-nums ${on || done ? "bg-primary text-primary-foreground" : "border text-muted-foreground"}`}>
                            {done ? <Check className="size-3.5" aria-hidden="true" /> : n}
                        </span>
                        <span className={`text-sm ${on ? "font-medium" : "text-muted-foreground"}`}>
                            {label}{done && <span className="sr-only"> (xong)</span>}
                        </span>
                    </li>
                );
            })}
        </ol>
    );
}

export default function VenueCreatePage() {
    const navigate = useNavigate();
    const { toast } = useFeedback();
    const [step, setStep] = useState<Step>(1);
    const [pin, setPin] = useState<[number, number] | null>(null);
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
        // Tâm địa điểm = ghim đã chấm ở bước Vị trí (khách mở bản đồ là thấy đúng chỗ này)
        const center = pin;
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
        if (step === 2) {
            if (pin) setStep(3);
            return;
        }
        void create(true);
    };

    const spinner = busy && <LoaderCircle className="animate-spin" aria-hidden="true" />;
    const actions = step === 1 ? (
        <>
            <Button asChild variant="outline"><Link to="/builder">Huỷ</Link></Button>
            <Button type="submit" form="venue-form" disabled={!canNext} title={canNext ? undefined : "Nhập tên và đường dẫn hợp lệ"}>Tiếp tục</Button>
        </>
    ) : step === 2 ? (
        <>
            <Button variant="outline" onClick={() => setStep(1)}>Quay lại</Button>
            <Button type="submit" form="venue-form" disabled={!pin} title={pin ? undefined : "Chấm vị trí địa điểm trên bản đồ trước"}>Tiếp tục</Button>
        </>
    ) : (
        <>
            <Button variant="outline" onClick={() => setStep(2)}>Quay lại</Button>
            <Button variant="outline" disabled={busy} onClick={() => void create(false)}>Bỏ qua, khoanh sau</Button>
            <Button type="submit" form="venue-form" disabled={busy} aria-busy={busy || undefined}>{spinner}Tạo địa điểm</Button>
        </>
    );
    const slugBad = !!finalSlug && !slugOk;

    return (
        <Page width="narrow" actions={actions}>
            <Steps step={step} />
            <form id="venue-form" onSubmit={submit} aria-label="Thông tin địa điểm">
                {step === 1 ? (
                    <Section>
                        <div className="grid gap-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="vname">Tên địa điểm</Label>
                                    <Input id="vname" type="text" autoComplete="off" maxLength={200} required value={name}
                                        onChange={e => setName(e.target.value)} placeholder="vd. Bệnh viện Chợ Rẫy" />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="kind">Loại hình</Label>
                                    <Select value={kind} onValueChange={setKind}>
                                        <SelectTrigger id="kind" className="w-full"><SelectValue /></SelectTrigger>
                                        <SelectContent>{KINDS.map(k => <SelectItem key={k} value={k}>{KIND_LABEL[k]}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="slug">Đường dẫn công khai</Label>
                                <div className="flex">
                                    <span className="inline-flex items-center rounded-l-md border border-r-0 bg-muted px-3 text-sm text-muted-foreground">{window.location.host}/v/</span>
                                    <Input id="slug" type="text" autoComplete="off" spellCheck={false} maxLength={60} required value={finalSlug} className="rounded-l-none"
                                        aria-invalid={slugBad || undefined} aria-describedby="slug-lock"
                                        onChange={e => { setSlugTouched(true); setSlug(e.target.value.toLowerCase()); }} />
                                </div>
                                {slugBad ? (
                                    <p id="slug-lock" role="alert" className="flex items-center gap-1.5 text-xs text-destructive"><CircleAlert className="size-3.5" aria-hidden="true" />Chỉ chữ thường không dấu, số và dấu gạch ngang.</p>
                                ) : (
                                    <p id="slug-lock" className="text-xs text-muted-foreground">Không đổi được sau lần xuất bản đầu, vì mã QR dùng đường dẫn này.</p>
                                )}
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="desc">Mô tả ngắn <span className="font-normal text-muted-foreground">(không bắt buộc)</span></Label>
                                <Textarea id="desc" rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Hiện trên điện thoại của khách" />
                            </div>
                        </div>
                    </Section>
                ) : step === 2 ? (
                    <Section title="Vị trí địa điểm" description="Tìm địa chỉ hoặc bấm lên bản đồ, rồi kéo ghim cho đúng cổng chính" flush>
                        <LocationPicker value={pin} onChange={setPin} initialQuery={name.trim()} />
                    </Section>
                ) : (
                    <Section title="Phạm vi trên bản đồ" description="Khoanh quanh khuôn viên. Không bắt buộc, sửa được sau" flush
                        actions={<Button type="button" variant="outline" size="sm" onClick={() => setOutline(o => o.slice(0, -1))} disabled={!outline.length}><Undo2 />Bỏ đỉnh cuối</Button>}>
                        <div aria-label="Khoanh vùng trên bản đồ" role="group" className="relative overflow-hidden rounded-b-xl">
                            <OutlineMap value={outline} onChange={setOutline} center={pin ?? undefined} pin={pin} />
                            <dl className="absolute bottom-3 left-3 z-[800] flex items-center gap-4 rounded-lg border bg-background px-3 py-1.5 shadow-sm">
                                <div><dt className="text-xs text-muted-foreground">Đỉnh</dt><dd className="text-sm font-medium tabular-nums">{outline.length}</dd></div>
                                <div><dt className="text-xs text-muted-foreground">Diện tích</dt><dd className="text-sm font-medium tabular-nums">{outline.length >= 3 ? formatArea(areaM2(outline)) : "—"}</dd></div>
                            </dl>
                            <span className="pointer-events-none absolute top-3 left-1/2 z-[800] -translate-x-1/2 rounded-full bg-primary px-4 py-1.5 text-sm whitespace-nowrap text-primary-foreground shadow-md">
                                Bấm từng góc để vẽ, kéo đỉnh để sửa
                            </span>
                        </div>
                    </Section>
                )}
            </form>
            {error && (
                <Alert variant="destructive">
                    <CircleAlert />
                    <AlertTitle>Chưa tạo được địa điểm</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
        </Page>
    );
}
