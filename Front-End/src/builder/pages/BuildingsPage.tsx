import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { floorWord, type BuildingDto, type FloorDto } from "@indoor-map/core";
import { planApi } from "../../console/api";
import { HeaderActions } from "../../console/Shell";
import { Button, useAction } from "../../console/ui";
import Lc from "../../design/Lc";
import { Dialog, GuestLink, RowMenu } from "../FloorList";
import { useWorkspace } from "../Workspace";
import "./workspace.css";

type Modal =
    | { kind: "building"; id?: number; code: string; name: string }
    | { kind: "floor"; id?: number; level: string; name: string }
    | { kind: "deleteBuilding"; typed: string }
    | { kind: "deleteFloor"; floor: FloorDto }
    | null;

/** Số mã QR đã chọn (lưu tạm trên trình duyệt, xem QrPage) */
function qrIds(venueId: number): string[] {
    try {
        return (JSON.parse(localStorage.getItem(`indoor-map.qr.${venueId}`) || "{}") as { selected?: string[] }).selected ?? [];
    } catch {
        return [];
    }
}

// Toà nhà và tầng: danh sách toà (sắp thứ tự), lối nối giữa toà, số liệu và bảng tầng của toà đang chọn.
export default function BuildingsPage() {
    const { venueId, data, model, reload } = useWorkspace();
    const { busy, run } = useAction();
    const buildings = useMemo(() => [...data.buildings].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id - b.id), [data.buildings]);
    const [selectedId, setSelectedId] = useState<number | null>(buildings[0]?.id ?? null);
    const building = buildings.find(b => b.id === selectedId) ?? buildings[0];
    const floors = building ? data.floors.filter(f => f.buildingId === building.id).sort((a, b) => b.level - a.level) : [];
    const [modal, setModal] = useState<Modal>(null);
    const [qr] = useState(() => new Set(qrIds(venueId)));
    const base = `/builder/v/${venueId}`;

    const nodesOf = (floorIds: Set<number>) => data.walkways.nodes.filter(n => floorIds.has(n.floorId));
    const floorIds = new Set(floors.map(f => f.id));
    const buildingNodes = nodesOf(floorIds);
    const buildingPlaces = floors.reduce((s, f) => s + (model.locationCount.get(f.id) ?? 0), 0);
    const buildingQr = buildingNodes.filter(n => qr.has(n.id)).length;

    // Lối nối giữa toà: cạnh lối đi có hai đầu ở hai toà khác nhau
    const links = useMemo(() => {
        const buildingOf = new Map(data.floors.map(f => [f.id, f.buildingId]));
        const nodeBuilding = new Map(data.walkways.nodes.map(n => [n.id, buildingOf.get(n.floorId)]));
        const count = new Map<string, number>();
        for (const e of data.walkways.edges) {
            const a = nodeBuilding.get(e.from);
            const b = nodeBuilding.get(e.to);
            if (a == null || b == null || a === b) continue;
            const key = a < b ? `${a}|${b}` : `${b}|${a}`;
            count.set(key, (count.get(key) ?? 0) + 1);
        }
        const pairs: { a: BuildingDto; b: BuildingDto; n: number }[] = [];
        const seen = new Set<string>();
        for (const [key, n] of count) {
            const [x, y] = key.split("|").map(Number) as [number, number];
            const a = buildings.find(b => b.id === x);
            const b = buildings.find(c => c.id === y);
            if (a && b) pairs.push({ a, b, n });
            seen.add(key);
        }
        for (let i = 1; i < buildings.length; i++) {
            const a = buildings[i - 1]!;
            const b = buildings[i]!;
            const key = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
            if (!seen.has(key)) pairs.push({ a, b, n: 0 });
        }
        return pairs;
    }, [data.floors, data.walkways, buildings]);

    const move = async (index: number, dir: -1 | 1) => {
        const order = [...buildings];
        const other = order[index + dir];
        const current = order[index];
        if (!other || !current) return;
        order[index] = other;
        order[index + dir] = current;
        const done = await run(async () => {
            for (const [i, b] of order.entries()) if ((b.sortOrder ?? 0) !== i + 1) await planApi.updateBuilding(venueId, b.id, { ...b, sortOrder: i + 1 });
            return true;
        });
        if (done) await reload("buildings", "floors");
    };

    const saveBuilding = async (e: FormEvent) => {
        e.preventDefault();
        if (modal?.kind !== "building") return;
        const dto = { code: modal.code.trim(), name: modal.name.trim() };
        const target = modal.id ? buildings.find(b => b.id === modal.id) : undefined;
        const saved = await run(() => (target ? planApi.updateBuilding(venueId, target.id, { ...target, ...dto }) : planApi.createBuilding(venueId, { ...dto, sortOrder: buildings.length + 1 })),
            target ? "Đã lưu toà nhà" : "Đã thêm toà nhà");
        if (saved) {
            setModal(null);
            await reload("buildings", "floors", "venue");
            setSelectedId(saved.id);
        }
    };

    const saveFloor = async (e: FormEvent) => {
        e.preventDefault();
        if (modal?.kind !== "floor" || !building) return;
        const level = Number(modal.level);
        const name = modal.name.trim() || floorWord(level);
        const target = modal.id ? floors.find(f => f.id === modal.id) : undefined;
        const saved = await run(() => (target
            ? planApi.updateFloor(venueId, target.id, { buildingId: target.buildingId, level, name })
            : planApi.createFloor(venueId, { buildingId: building.id, level, name })), target ? "Đã lưu tầng" : "Đã thêm tầng");
        if (saved) {
            setModal(null);
            await reload("floors", "venue");
        }
    };

    const removeFloor = async (floor: FloorDto) => {
        if (await run(() => planApi.removeFloor(venueId, floor.id), "Đã xoá tầng") !== null) {
            setModal(null);
            await reload("floors", "locations", "zones", "walkways", "venue");
        }
    };

    const removeBuilding = async () => {
        if (!building) return;
        if (await run(() => planApi.removeBuilding(venueId, building.id), "Đã xoá toà nhà") !== null) {
            setModal(null);
            setSelectedId(null);
            await reload();
        }
    };

    const header = (
        <HeaderActions>
            <GuestLink venue={data.venue} />
            <Button variant="primary" onClick={() => setModal({ kind: "building", code: "", name: "" })}>Thêm toà nhà</Button>
        </HeaderActions>
    );

    return (
        <div className="k-page">
            {header}
            {!building ? (
                <section className="k-card ws-empty">
                    <h2 className="k16">Chưa có toà nhà</h2>
                    <p className="k14 k-m">Mỗi địa điểm gồm một hoặc nhiều toà nhà, mỗi toà có các tầng. Thêm toà đầu tiên để bắt đầu.</p>
                </section>
            ) : (
                <div className="ws-split">
                    <aside className="k-stack">
                        <section aria-labelledby="bl-title" className="k-card tight">
                            <h2 id="bl-title" className="k16" style={{ padding: "0 8px" }}>Toà nhà</h2>
                            <ul className="ws-list ws-grp" style={{ gap: 4 }}>
                                {buildings.map((b, i) => {
                                    const cur = b.id === building.id;
                                    return (
                                        <li key={b.id} className="ws-bl" aria-current={cur}>
                                            <button type="button" aria-current={cur} className={cur ? "k-b" : undefined} onClick={() => setSelectedId(b.id)}>
                                                <span className="k-m k-b" style={{ minWidth: 24 }}>{b.code}</span>
                                                <span className="ws-grow ws-ellipsis">{b.name}</span>
                                                <span className="k12 k-m" style={{ fontWeight: 400 }}>{data.floors.filter(f => f.buildingId === b.id).length} tầng</span>
                                            </button>
                                            <button type="button" className="k-ib sm t" aria-label={`Đưa ${b.code} lên`} title="Đưa lên" disabled={i === 0 || busy} onClick={() => void move(i, -1)}><Lc name="arrow-up" size={16} /></button>
                                            <button type="button" className="k-ib sm t" aria-label={`Đưa ${b.code} xuống`} title="Đưa xuống" disabled={i === buildings.length - 1 || busy} onClick={() => void move(i, 1)}><Lc name="arrow-up" size={16} style={{ transform: "rotate(180deg)" }} /></button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </section>
                        {buildings.length > 1 && (
                            <section aria-labelledby="link-title" className="k-card tight">
                                <h2 id="link-title" className="k16">Lối nối giữa toà</h2>
                                <div>
                                    {links.map(({ a, b, n }) => (
                                        <div key={`${a.id}-${b.id}`} className="k-row k14">
                                            <span>{a.code} – {b.code}</span>
                                            {n ? <span className="k-m ws-right">{n} lối</span> : <span className="k-badge k-warn ws-right"><Lc name="triangle-alert" size={14} />Chưa nối</span>}
                                        </div>
                                    ))}
                                </div>
                                <div><Link to={`${base}/walkways`} className="k-btn t sm" style={{ marginLeft: -12 }}>Sửa trong Lối đi</Link></div>
                            </section>
                        )}
                    </aside>

                    <div className="k-stack" style={{ gap: 24, minWidth: 0 }}>
                        <div className="k-title">
                            <h1 className="k24"><span className="k-m" style={{ marginRight: 8 }}>{building.code}</span>{building.name}</h1>
                            <div className="k-acts"><Button onClick={() => setModal({ kind: "building", id: building.id, code: building.code, name: building.name })}>Sửa mã và tên</Button></div>
                        </div>
                        <div className="k-card">
                            <div className="k-grid4">
                                <Stat n={floors.length} label="Tầng" />
                                <Stat n={`${floors.filter(f => f.plan?.anchor).length}/${floors.length}`} label="Có mặt bằng" />
                                <Stat n={buildingPlaces.toLocaleString("vi-VN")} label="Điểm quan tâm" />
                                <Stat n={buildingNodes.length.toLocaleString("vi-VN")} label="Nút lối đi" />
                            </div>
                        </div>

                        <section aria-labelledby="fl-title" className="k-card ws-card0" style={{ overflow: "visible" }}>
                            <div className="ws-cardhead">
                                <h2 id="fl-title" className="k16">Tầng</h2>
                                <button type="button" className="k-btn sm ws-right" onClick={() => setModal({ kind: "floor", level: "", name: "" })}><Lc name="plus" size={16} />Thêm tầng</button>
                            </div>
                            {floors.length ? (
                                <table className="k-tbl">
                                    <thead><tr><th scope="col">Mức</th><th scope="col">Tên tầng</th><th scope="col">Mặt bằng</th><th scope="col" className="num">Điểm</th><th scope="col" className="num">Nút lối đi</th><th scope="col"><span className="sr-only">Thao tác</span></th></tr></thead>
                                    <tbody>
                                        {floors.map(f => {
                                            const file = f.plan?.imageUrl && !f.plan.imageUrl.startsWith("data:") ? f.plan.imageUrl.split("/").pop() : null;
                                            return (
                                                <tr key={f.id}>
                                                    <td className="k-m k-b">{f.level > 0 ? `+${f.level}` : f.level}</td>
                                                    <td className="k-b">{f.name}</td>
                                                    <td>
                                                        {!f.plan ? <span className="k-badge k-warn"><Lc name="triangle-alert" size={14} />Chưa có mặt bằng</span>
                                                            : f.plan.anchor ? <span className="k-badge k-ok"><Lc name="circle-check" size={14} />Đã căn chỉnh</span>
                                                                : <span className="k-badge k-warn"><Lc name="triangle-alert" size={14} />Chưa chấm mốc</span>}
                                                        {file && <span className="k12 k-m" style={{ marginLeft: 8 }}>{file}</span>}
                                                    </td>
                                                    <td className="num">{model.locationCount.get(f.id) ?? 0}</td>
                                                    <td className="num">{data.walkways.nodes.filter(n => n.floorId === f.id).length}</td>
                                                    <td className="is-act">
                                                        <span className="k-line" style={{ justifyContent: "flex-end", gap: 4 }}>
                                                            <Link to={`${base}/plan?floor=${f.id}`} className="k-btn t sm">{f.plan ? "Căn chỉnh" : "Tải bản vẽ"}</Link>
                                                            <RowMenu label={`Thao tác khác với ${f.name}`}>
                                                                <Link role="menuitem" to={`${base}/editor?floor=${f.id}`}>Sửa điểm và vùng</Link>
                                                                <Link role="menuitem" to={`${base}/walkways?floor=${f.id}`}>Sửa lối đi</Link>
                                                                <button role="menuitem" type="button" onClick={() => setModal({ kind: "floor", id: f.id, level: String(f.level), name: f.name })}>Đổi tên, mức tầng</button>
                                                                <button role="menuitem" type="button" className="is-danger" onClick={() => setModal({ kind: "deleteFloor", floor: f })}>Xoá tầng…</button>
                                                            </RowMenu>
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="ws-empty k-stack" style={{ padding: 32 }}>
                                    <p className="k14 k-m">{building.code} chưa có tầng. Thêm tầng rồi tải bản vẽ mặt bằng cho từng tầng.</p>
                                </div>
                            )}
                        </section>

                        <section aria-label="Xoá toà nhà" className="k-card">
                            <div className="k-line" style={{ gap: 16 }}>
                                <div style={{ minWidth: 0 }}>
                                    <div className="k14 k-b">Xoá toà nhà {building.code}</div>
                                    <div className="k12 k-m">Ảnh hưởng {floors.length} tầng, {buildingPlaces} điểm{buildingQr ? `, ${buildingQr} mã QR` : ""}</div>
                                </div>
                                <button type="button" className="k-btn d ws-right" aria-haspopup="dialog" onClick={() => setModal({ kind: "deleteBuilding", typed: "" })}><Lc name="trash" size={16} />Xoá toà nhà…</button>
                            </div>
                        </section>
                    </div>
                </div>
            )}

            {modal?.kind === "building" && (
                <Dialog title={modal.id ? "Sửa mã và tên toà nhà" : "Thêm toà nhà"} onClose={() => setModal(null)} onSubmit={e => void saveBuilding(e)}
                    actions={<><Button onClick={() => setModal(null)}>Huỷ</Button><Button type="submit" variant="primary" busy={busy} disabled={!modal.code.trim() || !modal.name.trim()}>{modal.id ? "Lưu" : "Thêm toà nhà"}</Button></>}>
                    <div style={{ display: "grid", gridTemplateColumns: "120px minmax(0, 1fr)", gap: 16 }}>
                        <div className="k-field"><label htmlFor="bld-code">Mã</label><input id="bld-code" className="k-input" maxLength={20} required placeholder="T1" value={modal.code} onChange={e => setModal({ ...modal, code: e.target.value.toUpperCase() })} /></div>
                        <div className="k-field"><label htmlFor="bld-name">Tên toà nhà</label><input id="bld-name" className="k-input" required placeholder="Ga nội địa" value={modal.name} onChange={e => setModal({ ...modal, name: e.target.value })} /></div>
                    </div>
                </Dialog>
            )}

            {modal?.kind === "floor" && building && (
                <Dialog title={modal.id ? "Đổi tên, mức tầng" : `Thêm tầng vào ${building.code}`} onClose={() => setModal(null)} onSubmit={e => void saveFloor(e)}
                    actions={<><Button onClick={() => setModal(null)}>Huỷ</Button><Button type="submit" variant="primary" busy={busy} disabled={modal.level === "" || Number.isNaN(Number(modal.level))}>{modal.id ? "Lưu" : "Thêm tầng"}</Button></>}>
                    <div className="k-stack">
                        <div style={{ display: "grid", gridTemplateColumns: "120px minmax(0, 1fr)", gap: 16 }}>
                            <div className="k-field"><label htmlFor="fl-level">Mức tầng</label><input id="fl-level" className="k-input" inputMode="numeric" required placeholder="+1" value={modal.level} onChange={e => setModal({ ...modal, level: e.target.value.replace("+", "") })} /></div>
                            <div className="k-field"><label htmlFor="fl-name">Tên tầng</label><input id="fl-name" className="k-input" placeholder={modal.level !== "" && !Number.isNaN(Number(modal.level)) ? floorWord(Number(modal.level)) : "Tầng 1, Đi"} value={modal.name} onChange={e => setModal({ ...modal, name: e.target.value })} /></div>
                        </div>
                        <span className="k-hint">Trệt là 0, hầm là −1. Mức dùng để sắp thứ tự và biết lên hay xuống khi đổi tầng.</span>
                    </div>
                </Dialog>
            )}

            {modal?.kind === "deleteFloor" && (
                <Dialog alert title={`Xoá ${modal.floor.name}?`} onClose={() => setModal(null)}
                    actions={<><Button onClick={() => setModal(null)}>Huỷ</Button><Button variant="danger" busy={busy} onClick={() => void removeFloor(modal.floor)}>Xoá tầng</Button></>}>
                    <p className="k14 k-m"><b className="k-b k-danger">Không hoàn tác được.</b> {model.locationCount.get(modal.floor.id) ?? 0} điểm, các vùng và lối đi của tầng này cũng bị xoá.</p>
                </Dialog>
            )}

            {modal?.kind === "deleteBuilding" && building && (
                <Dialog alert title={`Xoá toà nhà ${building.code}, ${building.name}?`} onClose={() => setModal(null)}
                    actions={<><Button onClick={() => setModal(null)}>Huỷ</Button><Button variant="danger" busy={busy} disabled={modal.typed.trim() !== building.code} title={modal.typed.trim() === building.code ? undefined : `Gõ ${building.code} để bật nút`} onClick={() => void removeBuilding()}>Xoá vĩnh viễn {building.code}</Button></>}>
                    <p className="k14 k-m"><b className="k-b k-danger">Không hoàn tác được.</b> Toàn bộ dữ liệu bên trong toà bị xoá.</p>
                    <div className="ws-box">
                        <table className="k-tbl">
                            <tbody>
                                <tr><th scope="row" className="k14" style={{ fontWeight: 400 }}>Tầng</th><td className="num k-b">{floors.length}</td><td className="k-m">Xoá cùng mặt bằng</td></tr>
                                <tr><th scope="row" className="k14" style={{ fontWeight: 400 }}>Điểm quan tâm</th><td className="num k-b">{buildingPlaces}</td><td className="k-m">Xoá cùng các vùng</td></tr>
                                <tr><th scope="row" className="k14" style={{ fontWeight: 400 }}>Nút lối đi</th><td className="num k-b">{buildingNodes.length}</td><td className="k-m">Xoá, kể cả lối sang toà khác</td></tr>
                                {buildingQr > 0 && <tr><th scope="row" className="k14 k-danger" style={{ fontWeight: 400 }}>Mã QR đã chọn</th><td className="num k-b k-danger">{buildingQr}</td><td className="k-danger">Hết hiệu lực</td></tr>}
                            </tbody>
                        </table>
                    </div>
                    <div className="k-field">
                        <label htmlFor="del-confirm">Gõ {building.code} để xác nhận</label>
                        <input id="del-confirm" className="k-input" autoComplete="off" spellCheck={false} placeholder={building.code} value={modal.typed} onChange={e => setModal({ ...modal, typed: e.target.value })} />
                    </div>
                </Dialog>
            )}
        </div>
    );
}

function Stat({ n, label }: { n: number | string; label: string }) {
    return <div className="k-kpi"><span className="k28">{n}</span><span className="k12 k-m">{label}</span></div>;
}
