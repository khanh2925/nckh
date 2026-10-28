import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { formatMeters, searchPlaces, type Place } from "@indoor-map/core";
import Lc from "../../design/Lc";
import { pushRecent, updateSettings, useSettings } from "../../lib/settings";
import { useModel, useVenue } from "../VenueContext";
import { IconButton, Row } from "../components/ui";
import { floorLabel, groupCounts, groupUi, placeWhere, positionLabel, typeIcon } from "../format";

// Tìm kiếm không dấu ("cua 12" ra "Cửa 12"). ?group=: lọc sẵn theo nhóm. ?pick=from|to: chọn điểm đi / điểm đến cho chỉ đường;
// ?pick=here(&return=): "Chọn điểm gần bạn" để đặt vị trí.
export default function SearchPage() {
    const model = useModel();
    const { slug, position, setPosition } = useVenue();
    const settings = useSettings();
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const pick = params.get("pick");
    const returnTo = params.get("return");
    const [query, setQuery] = useState("");
    const initialGroup = params.get("group");
    const [group, setGroup] = useState<string | null>(initialGroup && model.groups.some(g => g.code === initialGroup) ? initialGroup : null);
    const contextFloor = Number(params.get("floor")) || position?.floorId || null;
    const [floorOnly, setFloorOnly] = useState<number | null>(initialGroup && contextFloor ? contextFloor : null);

    const near = pick === "here" || pick === "from" ? null : position ?? null;
    const hits = useMemo(() => searchPlaces(model, query, { group, floorId: floorOnly, near, limit: 60 }), [model, query, group, floorOnly, near]);
    const total = useMemo(() => searchPlaces(model, query, { floorId: floorOnly, limit: 100000 }).length, [model, query, floorOnly]);
    const counts = useMemo(() => groupCounts(model, null), [model]);
    const recent = settings.recent
        .filter(r => r.startsWith(`${slug}:`))
        .map(r => model.locationsById.get(Number(r.split(":")[1])))
        .filter((p): p is Place => Boolean(p));

    const choose = (place: Place) => {
        pushRecent(slug, place.id);
        const here = { floorId: place.floorId, lat: place.lat, lng: place.lng, source: "place" as const, label: place.name, placeId: place.id };
        if (pick === "from") {
            setPosition(here);
            navigate(`/v/${slug}/route?to=${params.get("to") ?? ""}`, { replace: true });
        } else if (pick === "to") {
            navigate(`/v/${slug}/route?to=${place.id}`, { replace: true });
        } else if (pick === "here") {
            setPosition(here);
            navigate(returnTo ? `/v/${slug}/${returnTo}` : `/v/${slug}/map?floor=${place.floorId}`, { replace: true });
        } else {
            navigate(`/v/${slug}/place/${place.id}`);
        }
    };

    const placeholder = pick === "from" || pick === "here" ? "Bạn đang đứng gần đâu?" : pick === "to" ? "Bạn muốn đến đâu?" : "Tìm cửa, quầy, nhà vệ sinh";
    const purpose = pick === "from" ? "Chọn điểm đi cho chỉ đường" : pick === "to" ? "Chọn điểm đến cho chỉ đường" : pick === "here" ? "Chọn điểm gần chỗ bạn đứng" : null;
    const showHome = !query && !group;
    const contextFloorObj = contextFloor ? model.floorsById.get(contextFloor) : undefined;

    const resultRow = (place: Place, meters: number | null, recentRow = false) => (
        <Row key={place.id} title={place.name} sub={placeWhere(model, place)} onClick={() => choose(place)}
            lead={<Lc name={recentRow ? "history" : typeIcon(model, place.type)} size={20} color="var(--muted)" />}
            trailing={meters != null ? <span className="wf-t15 wf-row-val">{formatMeters(meters)}</span> : undefined} chevron={meters == null} />
    );

    return (
        <div className="wf-screen">
            <header className="wf-hdr">
                <IconButton icon="arrow-left" label="Quay lại" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate(`/v/${slug}/map`))} />
                <label className="wf-field" role="search">
                    <Lc name="search" size={20} color="var(--ink)" />
                    <span className="sr-only">{purpose ?? "Tìm địa điểm"}</span>
                    <input autoFocus type="search" enterKeyHint="search" autoComplete="off" value={query} onChange={e => setQuery(e.target.value)} placeholder={placeholder} />
                    {query && <button type="button" className="wf-ib is-clear" style={{ marginRight: -12 }} aria-label="Xoá chữ đã gõ" onClick={() => setQuery("")}><Lc name="x" size={20} /></button>}
                </label>
            </header>

            <main className="wf-main is-tight">
                {purpose && <p className="wf-t15 wf-status" style={{ fontWeight: 400 }}><Lc name="flag" size={20} />{purpose}</p>}

                {!showHome && (
                    <div className="wf-chips is-static" role="group" aria-label="Lọc theo danh mục">
                        <button type="button" className="wf-chip is-text" aria-pressed={group === null} onClick={() => setGroup(null)}>Tất cả<span className="wf-chip-count">{total}</span></button>
                        {counts.map(c => (
                            <button key={c.code} type="button" className="wf-chip is-text" aria-pressed={group === c.code} onClick={() => setGroup(group === c.code ? null : c.code)}>{groupUi(c.code).label}</button>
                        ))}
                        {contextFloorObj && (
                            <button type="button" className="wf-chip is-text" aria-pressed={floorOnly != null} onClick={() => setFloorOnly(floorOnly ? null : contextFloor)}>
                                {contextFloorObj.buildingCode}, {floorLabel(contextFloorObj)}
                            </button>
                        )}
                    </div>
                )}

                {showHome ? (
                    <>
                        {recent.length > 0 && (
                            <section aria-labelledby="s-recent">
                                <h2 id="s-recent" className="wf-sec">
                                    Gần đây
                                    <button type="button" className="wf-link" onClick={() => updateSettings(s => ({ recent: s.recent.filter(r => !r.startsWith(`${slug}:`)) }))}>Xoá lịch sử</button>
                                </h2>
                                <div className="wf-group">{recent.map(p => resultRow(p, null, true))}</div>
                            </section>
                        )}
                        <section aria-labelledby="s-suggest">
                            <h2 id="s-suggest" className="wf-sec">Gợi ý</h2>
                            <div className="wf-floorset">
                                {counts.map(c => {
                                    const ui = groupUi(c.code);
                                    return <button key={c.code} type="button" className="wf-chip" onClick={() => setGroup(c.code)}><Lc name={ui.icon} size={20} />{ui.label}<span className="wf-chip-count">{c.count}</span></button>;
                                })}
                            </div>
                        </section>
                    </>
                ) : (
                    <section aria-labelledby="s-hits">
                        <h2 id="s-hits" className="wf-sec">
                            <span>{hits.length} kết quả{query ? ` cho “${query}”` : ""}</span>
                            {near && <span style={{ fontWeight: 400 }}>Tính từ {positionLabel(model, near)}</span>}
                        </h2>
                        {hits.length > 0 ? (
                            <div className="wf-group">{hits.map(({ place, meters }) => resultRow(place, meters))}</div>
                        ) : (
                            <div className="wf-card is-white">
                                <p className="wf-t17">Không tìm thấy “{query}”</p>
                                <p className="wf-t15 wf-muted" style={{ marginTop: 4 }}>Thử gõ ngắn hơn, ví dụ “wc”, “cua 12”. Không cần gõ dấu.</p>
                            </div>
                        )}
                    </section>
                )}
            </main>
        </div>
    );
}
