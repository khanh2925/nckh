import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { formatMeters, searchPlaces, type Place } from "@indoor-map/core";
import { pushRecent, updateSettings, useSettings } from "../../lib/settings";
import { useModel, useVenue } from "../VenueContext";
import { IconButton, Plate, SectionKicker } from "../components/ui";

// Tìm kiếm. Chế độ ?pick=from|to: chọn điểm xuất phát / điểm đến cho màn Chỉ đường.
export default function SearchPage() {
    const model = useModel();
    const { slug, position, setPosition } = useVenue();
    const settings = useSettings();
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const pick = params.get("pick");
    const [query, setQuery] = useState("");
    const [group, setGroup] = useState<string | null>(null);
    const [floorOnly, setFloorOnly] = useState<number | null>(null);
    const contextFloor = Number(params.get("floor")) || position?.floorId || null;

    const near = position ?? null;
    const hits = useMemo(() => searchPlaces(model, query, { group, floorId: floorOnly, near, limit: 50 }), [model, query, group, floorOnly, near]);
    const recent = settings.recent
        .filter(r => r.startsWith(`${slug}:`))
        .map(r => model.locationsById.get(Number(r.split(":")[1])))
        .filter((p): p is Place => Boolean(p));

    const choose = (place: Place) => {
        pushRecent(slug, place.id);
        if (pick === "from") {
            setPosition({ floorId: place.floorId, lat: place.lat, lng: place.lng, source: "place", label: place.name, placeId: place.id });
            navigate(`/v/${slug}/route?to=${params.get("to") ?? ""}`, { replace: true });
        } else if (pick === "to") {
            navigate(`/v/${slug}/route?to=${place.id}`, { replace: true });
        } else {
            navigate(`/v/${slug}/place/${place.id}`);
        }
    };

    const floorChipLabel = floorOnly ? `Tầng: ${model.floorsById.get(floorOnly)?.buildingCode} · ${model.floorsById.get(floorOnly)?.level}` : "Mọi tầng";

    const row = (place: Place, meters: number | null) => (
        <button key={place.id} type="button" className="wf-result" onClick={() => choose(place)}>
            <Plate place={place} type={model.typeOf(place.type)} size={48} />
            <span className="wf-result-text">
                <b>{place.name}</b>
                <small>{model.floorsById.get(place.floorId)?.buildingCode} · {model.floorsById.get(place.floorId)?.name}{place.area ? ` · ${place.area}` : ""}</small>
            </span>
            <span className="wf-result-figure">{meters != null ? formatMeters(meters) : "›"}</span>
        </button>
    );

    return (
        <div className="wf-screen">
            <header className="wf-topbar">
                <IconButton icon="back" label="Quay lại" onClick={() => navigate(-1)} />
                <label className="wf-search is-top">
                    <span className="sr-only">{pick === "from" ? "Tìm điểm xuất phát" : pick === "to" ? "Tìm điểm đến" : "Tìm địa điểm"}</span>
                    <input autoFocus type="search" value={query} onChange={e => setQuery(e.target.value)}
                        placeholder={pick === "from" ? "Bạn đang đứng gần đâu?" : pick === "to" ? "Bạn muốn đến đâu?" : "Gate 12, Highlands, nhà vệ sinh…"} />
                    {query && <button type="button" className="wf-search-clear" aria-label="Xoá" onClick={() => setQuery("")}>×</button>}
                </label>
            </header>
            <div className="wf-seg is-bar" role="group" aria-label="Bộ lọc">
                <button type="button" aria-pressed={group === null} onClick={() => setGroup(null)}>Tất cả</button>
                {model.groups.map(g => (
                    <button key={g.code} type="button" aria-pressed={group === g.code} onClick={() => setGroup(g.code === group ? null : g.code)}>{g.label}</button>
                ))}
                {contextFloor && (
                    <button type="button" aria-pressed={floorOnly != null} onClick={() => setFloorOnly(floorOnly ? null : contextFloor)}>{floorChipLabel}</button>
                )}
            </div>

            <main className="wf-body is-scroll">
                {!query && !group && recent.length > 0 && (
                    <>
                        <SectionKicker right={<button type="button" className="wf-link-btn" onClick={() => updateSettings(s => ({ recent: s.recent.filter(r => !r.startsWith(`${slug}:`)) }))}>xoá</button>}>Gần đây</SectionKicker>
                        <div className="wf-stack">{recent.map(p => row(p, null))}</div>
                    </>
                )}
                <SectionKicker right={near ? <span>từ {near.label ?? "vị trí của bạn"}</span> : undefined}>
                    {hits.length} kết quả{near ? " · gần nhất trước" : ""}
                </SectionKicker>
                <div className="wf-stack">{hits.map(({ place, meters }) => row(place, meters))}</div>
                {hits.length === 0 && <p className="wf-muted">Không tìm thấy “{query}”. Thử bỏ dấu hoặc gõ ngắn hơn, ví dụ “wc”, “cua 12”.</p>}
                {!near && <Link className="wf-link" to={`/v/${slug}/scan?then=search`}>Quét QR để xếp kết quả theo khoảng cách →</Link>}
            </main>
        </div>
    );
}
