import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import { LoaderCircle, LocateFixed, MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import L from "../lib/leaflet";
import { lucideSvg } from "./layers";

export type LatLngTuple = [number, number];

const TILE = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const HCMC: LatLngTuple = [10.8231, 106.6297];

/** Ghim vị trí địa điểm (Leaflet cần HTML): ghim xanh chủ đạo, mũi ghim chạm đúng toạ độ */
// eslint-disable-next-line react-refresh/only-export-components
export function pinIcon(): Leaflet.DivIcon {
    return L.divIcon({
        className: "",
        html: `<span class="block text-primary drop-shadow-md [&_svg]:fill-white">${lucideSvg("map-pin", 36, 2.25)}</span>`,
        iconSize: [36, 36], iconAnchor: [18, 34]
    });
}

interface Place {
    label: string;
    detail: string;
    at: LatLngTuple;
}

/** Tìm địa chỉ bằng Nominatim (OpenStreetMap). Chỉ gửi đúng chuỗi người dùng gõ, giới hạn trong Việt Nam. */
async function geocode(query: string, signal: AbortSignal): Promise<Place[]> {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=vn&accept-language=vi&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error("Không tìm được địa chỉ lúc này");
    const rows = (await res.json()) as { display_name: string; name?: string; lat: string; lon: string }[];
    return rows.map(r => {
        const parts = r.display_name.split(",").map(s => s.trim());
        return { label: r.name || parts[0] || r.display_name, detail: parts.slice(r.name ? 0 : 1, 4).join(", "), at: [Number(r.lat), Number(r.lon)] };
    });
}

/**
 * Chọn vị trí địa điểm: tìm địa chỉ, dùng vị trí hiện tại, hoặc bấm lên bản đồ; ghim kéo được để chỉnh.
 * `initialQuery` (thường là tên địa điểm) được điền sẵn vào ô tìm.
 */
export function LocationPicker({ value, onChange, initialQuery = "" }: { value: LatLngTuple | null; onChange(v: LatLngTuple): void; initialQuery?: string }) {
    const box = useRef<HTMLDivElement>(null);
    const mapRef = useRef<Leaflet.Map | null>(null);
    const marker = useRef<Leaflet.Marker | null>(null);
    const changeRef = useRef(onChange);
    const [query, setQuery] = useState(initialQuery);
    const [results, setResults] = useState<Place[] | null>(null);
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [locating, setLocating] = useState(false);
    useEffect(() => {
        changeRef.current = onChange;
    }, [onChange]);

    useEffect(() => {
        if (!box.current) return undefined;
        const map = L.map(box.current, { center: value ?? HCMC, zoom: value ? 17 : 12, rotateControl: false, doubleClickZoom: false });
        L.tileLayer(TILE, { maxZoom: 22, maxNativeZoom: 19, attribution: "&copy; OpenStreetMap" }).addTo(map);
        map.on("click", e => changeRef.current([e.latlng.lat, e.latlng.lng]));
        mapRef.current = map;
        return () => {
            map.stop();
            map.remove();
            marker.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Ghim theo giá trị hiện tại
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        if (!value) {
            marker.current?.remove();
            marker.current = null;
            return;
        }
        if (!marker.current) {
            marker.current = L.marker(value, { draggable: true, icon: pinIcon(), title: "Vị trí địa điểm, kéo để chỉnh" }).addTo(map);
            marker.current.on("dragend", () => {
                const ll = marker.current!.getLatLng();
                changeRef.current([ll.lat, ll.lng]);
            });
        } else {
            marker.current.setLatLng(value);
        }
    }, [value]);

    const goTo = (at: LatLngTuple) => {
        changeRef.current(at);
        mapRef.current?.setView(at, 18);
    };

    const search = async () => {
        const q = query.trim();
        if (q.length < 3) return;
        setSearching(true);
        setError(null);
        try {
            const found = await geocode(q, AbortSignal.timeout(10000));
            setResults(found);
            if (found.length === 1) {
                goTo(found[0]!.at);
                setResults(null);
            }
        } catch (err) {
            setError((err as Error).message);
            setResults(null);
        } finally {
            setSearching(false);
        }
    };

    const locate = () => {
        if (!navigator.geolocation) return setError("Trình duyệt không cho lấy vị trí");
        setLocating(true);
        setError(null);
        navigator.geolocation.getCurrentPosition(
            pos => {
                setLocating(false);
                goTo([pos.coords.latitude, pos.coords.longitude]);
            },
            () => {
                setLocating(false);
                setError("Chưa lấy được vị trí. Hãy cho phép truy cập vị trí hoặc tìm theo địa chỉ.");
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    return (
        <div className="relative overflow-hidden rounded-b-xl">
            <div ref={box} className="cb-map min-h-110" />
            <div className="absolute top-3 right-3 left-3 z-[800] flex flex-col gap-1">
                {/* không dùng <form>: picker nằm trong form của trang, form lồng nhau không hợp lệ */}
                <div className="flex gap-2" role="search">
                    <div className="relative flex-1">
                        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input value={query} onChange={e => { setQuery(e.target.value); setResults(null); }} placeholder="Tìm địa chỉ hoặc tên toà nhà"
                            aria-label="Tìm địa chỉ" className="bg-background pl-9 shadow-sm"
                            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); void search(); } }} />
                    </div>
                    <Button type="button" disabled={searching || query.trim().length < 3} className="shadow-sm" onClick={() => void search()}>
                        {searching ? <LoaderCircle className="animate-spin" /> : <Search />}Tìm
                    </Button>
                    <Button type="button" variant="outline" className="bg-background shadow-sm" disabled={locating} onClick={locate}>
                        {locating ? <LoaderCircle className="animate-spin" /> : <LocateFixed />}Vị trí của tôi
                    </Button>
                </div>
                {results && (
                    <ul role="listbox" aria-label="Kết quả tìm địa chỉ" className="max-h-64 overflow-y-auto rounded-lg border bg-popover p-1 shadow-md">
                        {results.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">Không thấy địa chỉ khớp. Thử gõ cụ thể hơn, hoặc bấm thẳng lên bản đồ.</li>}
                        {results.map((r, i) => (
                            <li key={i}>
                                <button type="button" role="option" aria-selected={false} onClick={() => { goTo(r.at); setResults(null); }}
                                    className="flex w-full items-start gap-2 rounded-md px-3 py-2 text-left hover:bg-muted">
                                    <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                                    <span className="min-w-0">
                                        <span className="block truncate text-sm font-medium">{r.label}</span>
                                        <span className="block truncate text-xs text-muted-foreground">{r.detail}</span>
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
                {error && <p role="alert" className="self-start rounded-md bg-background px-3 py-1.5 text-xs text-destructive shadow-sm">{error}</p>}
            </div>
            <div className="absolute bottom-3 left-3 z-[800] rounded-lg border bg-background px-3 py-1.5 shadow-sm">
                {value
                    ? <><p className="text-xs text-muted-foreground">Đã chấm vị trí, kéo ghim để chỉnh</p><p className="text-sm font-medium tabular-nums">{value[0].toFixed(6)}, {value[1].toFixed(6)}</p></>
                    : <p className="text-sm text-muted-foreground">Tìm địa chỉ, hoặc bấm lên bản đồ để chấm vị trí</p>}
            </div>
        </div>
    );
}
