import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import QRCode from "qrcode";
import { distance, qrUrl, type WalkwayNodeDto } from "@indoor-map/core";
import { Button, Card, Check, NotYet, Status, Table } from "../../console/ui";
import EditorMap from "../EditorMap";
import FloorList from "../FloorList";
import { PlacesLayer } from "../layers";
import { useWorkspace } from "../Workspace";
import { QrNodesLayer } from "./qrLayer";

// Mã QR định vị: mỗi mã = một nút lối đi. Khách quét -> biết vị trí ~1 m. Nên đặt ở lối vào, chân thang, giao lộ (cách 30–50 m).
// Backend chưa lưu danh sách mã đã chọn / đã dán: tạm lưu trên trình duyệt này.
interface QrState {
    selected: string[];
    posted: string[];
}
const key = (venueId: number) => `indoor-map.qr.${venueId}`;
function readState(venueId: number): QrState {
    try {
        return { selected: [], posted: [], ...(JSON.parse(localStorage.getItem(key(venueId)) || "{}") as Partial<QrState>) };
    } catch {
        return { selected: [], posted: [] };
    }
}

/** Gợi ý: nút thang + giao lộ (≥ 3 nhánh), bỏ bớt cho các mã cách nhau ít nhất 30 m */
function suggest(nodes: WalkwayNodeDto[], degree: Map<string, number>): string[] {
    const candidates = nodes.filter(n => n.connector || (degree.get(n.id) ?? 0) >= 3).sort((a, b) => Number(Boolean(b.connector)) - Number(Boolean(a.connector)));
    const picked: WalkwayNodeDto[] = [];
    for (const c of candidates) if (!picked.some(p => p.floorId === c.floorId && distance(p, c) < 30)) picked.push(c);
    return picked.map(n => n.id);
}

export default function QrPage() {
    const { venueId, data, model } = useWorkspace();
    const [params, setParams] = useSearchParams();
    const floorId = Number(params.get("floor")) || model.defaultFloor?.id || model.floors[0]?.id || null;
    const [state, setState] = useState<QrState>(() => readState(venueId));
    const [preview, setPreview] = useState<string | null>(null);
    const [svgs, setSvgs] = useState<Record<string, string>>({});
    const [bilingual, setBilingual] = useState(true);
    const origin = window.location.origin;

    useEffect(() => {
        try {
            localStorage.setItem(key(venueId), JSON.stringify(state));
        } catch {
            // bỏ qua
        }
    }, [state, venueId]);

    const degree = useMemo(() => {
        const map = new Map<string, number>();
        data.walkways.edges.forEach(e => {
            map.set(e.from, (map.get(e.from) ?? 0) + 1);
            map.set(e.to, (map.get(e.to) ?? 0) + 1);
        });
        return map;
    }, [data.walkways]);
    const nodesById = model.nodesById;
    const selected = state.selected.filter(id => nodesById.has(id));
    const floorSelected = selected.filter(id => nodesById.get(id)?.floorId === floorId);
    const toggle = (id: string) => setState(s => ({ ...s, selected: s.selected.includes(id) ? s.selected.filter(x => x !== id) : [...s.selected, id] }));

    // Khoảng cách xa nhất từ một địa điểm tới mã QR gần nhất cùng tầng
    const coverage = useMemo(() => {
        const pts = floorSelected.map(id => nodesById.get(id)!);
        const places = model.locations.filter(l => l.floorId === floorId);
        if (!pts.length || !places.length) return null;
        let worst = 0;
        for (const p of places) worst = Math.max(worst, Math.min(...pts.map(q => distance(p, q))));
        return worst;
    }, [floorSelected, nodesById, model, floorId]);

    // Sinh SVG mã QR cho các mã đã chọn (để xem trước và in)
    useEffect(() => {
        let alive = true;
        const missing = selected.filter(id => !svgs[id]);
        if (!missing.length) return undefined;
        void Promise.all(missing.map(async id => [id, await QRCode.toString(qrUrl(origin, data.venue.slug, id), { type: "svg", margin: 1, errorCorrectionLevel: "M" })] as const))
            .then(pairs => alive && setSvgs(s => ({ ...s, ...Object.fromEntries(pairs) })));
        return () => {
            alive = false;
        };
    }, [selected, svgs, origin, data.venue.slug]);

    const floorName = (id?: number) => (id ? `${model.floorsById.get(id)?.buildingCode} · ${model.floorsById.get(id)?.name}` : "");
    const nearestPlace = (n: WalkwayNodeDto) => {
        let best: { name: string; d: number } | null = null;
        for (const l of model.locations) if (l.floorId === n.floorId) {
            const d = distance(l, n);
            if (!best || d < best.d) best = { name: l.name, d };
        }
        return best && best.d < 25 ? `gần ${best.name}` : n.connector ? `chân ${n.connector.toLowerCase()}` : "giao lộ hành lang";
    };
    const previewNode = preview ? nodesById.get(preview) : selected[0] ? nodesById.get(selected[0]) : undefined;

    const renderCard = (n: WalkwayNodeDto) => (
        <div className="cb-qr-card" key={n.id}>
            <div className="cb-qr-title">QUÉT ĐỂ XEM BẢN ĐỒ &amp; CHỈ ĐƯỜNG{bilingual && <><br />SCAN FOR MAP &amp; DIRECTIONS</>}</div>
            {svgs[n.id] ? <span style={{ display: "block" }} dangerouslySetInnerHTML={{ __html: svgs[n.id]! }} /> : <div style={{ width: 160, height: 160 }} />}
            <div className="cb-qr-code">{n.id}</div>
            <div style={{ fontSize: 11, color: "#5E6473" }}>{floorName(n.floorId)} · {nearestPlace(n)}<br />{origin.replace(/^https?:\/\//, "")}/q/{data.venue.slug}/{n.id}</div>
            <div style={{ width: "100%", height: 2, background: "#141826" }} />
            <div style={{ display: "flex", justifyContent: "space-between", width: "100%", fontSize: 10, color: "#5E6473" }}><span>Bạn đang ở đây</span><span>{data.venue.name}</span></div>
        </div>
    );

    return (
        <div className="cb-work">
            <aside className="cb-side">
                <FloorList model={model} floorId={floorId} onSelect={id => setParams({ floor: String(id) })} count={id => `${selected.filter(s => nodesById.get(s)?.floorId === id).length} mã`} />
                <div className="cb-side-section">
                    <Button small onClick={() => setState(s => ({ ...s, selected: [...new Set([...s.selected, ...suggest(model.walkways.nodes.filter(n => n.floorId === floorId), degree)])] }))}>Gợi ý mã cho tầng này</Button>
                    <Button small variant="danger" onClick={() => setState(s => ({ ...s, selected: s.selected.filter(id => nodesById.get(id)?.floorId !== floorId) }))} disabled={!floorSelected.length}>Bỏ chọn cả tầng</Button>
                    <p className="cb-muted" style={{ fontSize: 12 }}>Bấm một nút lối đi trên bản đồ để chọn / bỏ chọn làm mã QR. Gợi ý = chân thang + giao lộ, cách nhau ≥ 30 m.</p>
                </div>
            </aside>
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                <div style={{ padding: "18px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
                    <div className="cb-page-head">
                        <div><h1 className="cb-h1">Mã QR định vị</h1><p className="cb-muted">Mã = id nút lối đi. Đổi vị trí nút không cần in lại; xoá nút thì mã hết hiệu lực.</p></div>
                        <div className="cb-actions">
                            <Check label="Song ngữ Việt – Anh" checked={bilingual} onChange={setBilingual} />
                            <Button variant="primary" icon="bi-printer" disabled={!selected.length} onClick={() => window.print()}>In {selected.length} mã (A6, 4 mã/trang A4)</Button>
                        </div>
                    </div>
                    <div className="cb-kpis">
                        <div className="cb-card cb-kpi"><div className="cb-muted">Mã trên tầng này</div><div className="cb-kpi-value">{floorSelected.length}</div></div>
                        <div className="cb-card cb-kpi"><div className="cb-muted">Đã dán / tổng</div><div className="cb-kpi-value">{state.posted.filter(id => selected.includes(id)).length} <span style={{ fontSize: 14, color: "#6B7280" }}>/ {selected.length}</span></div></div>
                        <div className="cb-card cb-kpi"><div className="cb-muted">Điểm xa mã nhất</div><div className={`cb-kpi-value${coverage != null && coverage > 60 ? " is-warn" : ""}`}>{coverage != null ? `${Math.round(coverage)} m` : "—"}</div></div>
                    </div>
                </div>
                <div style={{ position: "relative", height: 380, borderTop: "1px solid #E4E7EC", borderBottom: "1px solid #E4E7EC", display: "flex" }}>
                    <EditorMap model={model} floorId={floorId}>
                        {map => (
                            <>
                                <PlacesLayer map={map} places={model.locations.filter(l => l.floorId === floorId)} typeOf={model.typeOf} selectedId={null} />
                                <QrNodesLayer map={map} nodes={model.walkways.nodes.filter(n => n.floorId === floorId)} selected={new Set(selected)} posted={new Set(state.posted)} onToggle={toggle} />
                            </>
                        )}
                    </EditorMap>
                </div>
                <div style={{ padding: "18px 24px", display: "grid", gridTemplateColumns: "minmax(0, 1fr) 320px", gap: 20, alignItems: "start" }}>
                    <div className="cb-stack">
                        <NotYet title="Danh sách mã chỉ lưu trên trình duyệt này">Backend chưa có bảng mã QR, nên việc chọn mã và đánh dấu “đã dán” lưu tạm trong máy bạn. Bản thân mã (id nút) thì đã dùng được ngay trên điện thoại khách.</NotYet>
                        <Table head={["Mã", "Vị trí", "Trạng thái", ""]} minWidth={560}>
                            {selected.filter(id => nodesById.get(id)?.floorId === floorId).map(id => {
                                const n = nodesById.get(id)!;
                                const posted = state.posted.includes(id);
                                return (
                                    <tr key={id} className={preview === id ? "is-selected" : ""} onClick={() => setPreview(id)} style={{ cursor: "pointer" }}>
                                        <td className="cb-mono" style={{ fontWeight: 500 }}>{id}</td>
                                        <td>{nearestPlace(n)}</td>
                                        <td>{posted ? <Status kind="ok">Đã dán</Status> : <Status kind="warn">Chưa dán</Status>}</td>
                                        <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                                            <button type="button" className="cb-btn cb-btn-ghost is-small" onClick={e => { e.stopPropagation(); setState(s => ({ ...s, posted: posted ? s.posted.filter(x => x !== id) : [...s.posted, id] })); }}>{posted ? "Bỏ đánh dấu" : "Đánh dấu đã dán"}</button>
                                            <button type="button" className="cb-btn cb-btn-ghost is-small" style={{ color: "#B42318" }} onClick={e => { e.stopPropagation(); toggle(id); }}>Bỏ</button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {!floorSelected.length && <tr><td colSpan={4} className="cb-muted">Chưa chọn mã nào trên tầng này. Bấm “Gợi ý mã cho tầng này” hoặc bấm nút lối đi trên bản đồ.</td></tr>}
                        </Table>
                    </div>
                    <Card title="Xem trước bản in">
                        {previewNode ? renderCard(previewNode) : <p className="cb-muted">Chọn một mã để xem.</p>}
                    </Card>
                </div>
            </div>
            <div className="cb-print-sheet" aria-hidden="true">
                {selected.map(id => nodesById.get(id)).filter((n): n is WalkwayNodeDto => Boolean(n)).map(n => renderCard(n))}
            </div>
        </div>
    );
}
