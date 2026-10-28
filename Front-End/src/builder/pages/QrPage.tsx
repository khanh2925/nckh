import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import QRCode from "qrcode";
import { distance, qrUrl, type WalkwayNodeDto } from "@indoor-map/core";
import { HeaderActions } from "../../console/Shell";
import { Button, useFeedback } from "../../console/ui";
import Lc from "../../design/Lc";
import EditorMap from "../EditorMap";
import { floorLabel, FloorSelect, GuestLink, RowMenu } from "../FloorList";
import { useWorkspace } from "../Workspace";
import { QR_STATUS_LABEL, QrNodesLayer, qrPlaceText, qrStatus, readQrState, withQrStatus, writeQrState, type QrState, type QrStatus } from "./qrLayer";
import "./workspace.css";

type Filter = "all" | QrStatus | "issue";

/** Gợi ý: nút thang + giao lộ (≥ 3 nhánh), bỏ bớt cho các mã cách nhau ít nhất 30 m */
function suggest(nodes: WalkwayNodeDto[], degree: Map<string, number>): string[] {
    const candidates = nodes.filter(n => n.connector || (degree.get(n.id) ?? 0) >= 3).sort((a, b) => Number(Boolean(b.connector)) - Number(Boolean(a.connector)));
    const picked: WalkwayNodeDto[] = [];
    for (const c of candidates) if (!picked.some(p => p.floorId === c.floorId && distance(p, c) < 30)) picked.push(c);
    return picked.map(n => n.id);
}
const day = (t?: number) => (t ? new Date(t).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }) : null);

// Mã QR định vị: mỗi mã = một nút lối đi; khách quét biết vị trí trong khoảng 1 m.
// Danh sách mã và trạng thái tem lưu tạm trên trình duyệt này (backend chưa có bảng mã QR).
export default function QrPage() {
    const { venueId, data, model } = useWorkspace();
    const { confirm } = useFeedback();
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const floorId = Number(params.get("floor")) || model.defaultFloor?.id || model.floors[0]?.id || null;
    const floor = floorId ? model.floorsById.get(floorId) : undefined;
    const [state, setState] = useState<QrState>(() => readQrState(venueId));
    const [current, setCurrent] = useState<string | null>(null);
    const [checked, setChecked] = useState<Set<string>>(() => new Set());
    const [filter, setFilter] = useState<Filter>("all");
    const [svg, setSvg] = useState<{ id: string; svg: string } | null>(null);
    const origin = window.location.origin;

    useEffect(() => writeQrState(venueId, state), [state, venueId]);

    const degree = useMemo(() => {
        const map = new Map<string, number>();
        data.walkways.edges.forEach(e => {
            map.set(e.from, (map.get(e.from) ?? 0) + 1);
            map.set(e.to, (map.get(e.to) ?? 0) + 1);
        });
        return map;
    }, [data.walkways]);
    const nodesById = model.nodesById;
    const floorNodes = useMemo(() => model.walkways.nodes.filter(n => n.floorId === floorId), [model, floorId]);
    // Mã của tầng này + mã mất nút (nút đã bị xoá khỏi lối đi: tem đã dán không còn định vị được)
    const lost = state.selected.filter(id => !nodesById.has(id));
    const floorCodes = state.selected.filter(id => nodesById.get(id)?.floorId === floorId);
    const listed = [...floorCodes, ...lost];
    const countBy = (s: QrStatus) => floorCodes.filter(id => qrStatus(state, id) === s).length;
    const shown = listed.filter(id => filter === "all" || (filter === "issue" ? !nodesById.has(id) : nodesById.has(id) && qrStatus(state, id) === filter));
    const currentId = current && state.selected.includes(current) ? current : shown[0] ?? null;
    const currentNode = currentId ? nodesById.get(currentId) : undefined;

    // Khoảng cách xa nhất từ một điểm quan tâm tới mã gần nhất cùng tầng
    const coverage = useMemo(() => {
        const pts = state.selected.map(id => nodesById.get(id)).filter((n): n is WalkwayNodeDto => n?.floorId === floorId);
        const places = model.locations.filter(l => l.floorId === floorId);
        if (!pts.length || !places.length) return null;
        let worst = 0;
        for (const p of places) worst = Math.max(worst, Math.min(...pts.map(q => distance(p, q))));
        return worst;
    }, [state.selected, nodesById, model, floorId]);

    useEffect(() => {
        if (!currentId) return undefined;
        let alive = true;
        void QRCode.toString(qrUrl(origin, data.venue.slug, currentId), { type: "svg", margin: 1, errorCorrectionLevel: "M" }).then(text => alive && setSvg({ id: currentId, svg: text }));
        return () => {
            alive = false;
        };
    }, [currentId, origin, data.venue.slug]);

    const pick = (id: string) => {
        if (state.selected.includes(id)) return setCurrent(id);
        const at = Date.now();
        setState(s => ({ ...s, selected: [...s.selected, id], times: { ...s.times, [id]: { created: at } } }));
        setCurrent(id);
    };
    const addSuggested = () => {
        const at = Date.now();
        setState(s => {
            const add = suggest(floorNodes, degree).filter(id => !s.selected.includes(id));
            return { ...s, selected: [...s.selected, ...add], times: { ...s.times, ...Object.fromEntries(add.map(id => [id, { created: at }])) } };
        });
    };
    const setStatus = (ids: string[], status: QrStatus) => setState(s => withQrStatus(s, ids, status, Date.now()));
    const revoke = async (ids: string[]) => {
        if (!ids.length) return;
        const pasted = ids.filter(id => state.posted.includes(id)).length;
        if (!(await confirm(ids.length === 1 ? `Thu hồi mã ${ids[0]}?` : `Thu hồi ${ids.length} mã?`, {
            danger: true, okLabel: "Thu hồi", detail: pasted ? `${pasted} tem đã dán cần gỡ khỏi tường. Nút lối đi vẫn giữ nguyên.` : "Nút lối đi vẫn giữ nguyên, có thể tạo mã lại."
        }))) return;
        const set = new Set(ids);
        setState(s => ({ ...s, selected: s.selected.filter(x => !set.has(x)), posted: s.posted.filter(x => !set.has(x)), printed: s.printed.filter(x => !set.has(x)) }));
        setChecked(c => new Set([...c].filter(x => !set.has(x))));
    };
    const toggleCheck = (id: string) => setChecked(c => {
        const next = new Set(c);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
    });
    const checkedHere = shown.filter(id => checked.has(id));
    const allChecked = shown.length > 0 && checkedHere.length === shown.length;
    const printable = checkedHere.filter(id => nodesById.has(id));
    const status = currentId && currentNode ? qrStatus(state, currentId) : null;
    const t = currentId ? state.times[currentId] : undefined;

    const chip = (value: Filter, label: string, n: number, warn = false) => (
        <button type="button" className={`k-chip${warn ? " is-warn" : ""}`} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label} {n}</button>
    );

    return (
        <div className="k-page ws-page-full" style={{ minHeight: 640 }}>
            <HeaderActions><GuestLink venue={data.venue} /></HeaderActions>
            <div className="k-title">
                <h1 className="k24">Mã QR định vị</h1>
                {floor && <FloorSelect model={model} floorId={floorId} onSelect={id => { setParams({ floor: String(id) }); setCurrent(null); setChecked(new Set()); }} width={220} />}
                <div className="k-acts"><Button disabled={!floorNodes.length} title={floorNodes.length ? "Chân thang và giao lộ, cách nhau ít nhất 30 m" : "Tầng chưa có lối đi"} onClick={addSuggested}>Gợi ý vị trí mã</Button></div>
            </div>

            {!floor ? (
                <section className="k-card ws-empty"><h2 className="k16">Chưa có tầng</h2><p className="k14 k-m">Thêm tầng và vẽ lối đi trước, mỗi mã QR gắn với một nút lối đi.</p></section>
            ) : !floorNodes.length && !listed.length ? (
                <section aria-labelledby="qr-empty" className="k-card ws-empty ws-fill" style={{ justifyContent: "center" }}>
                    <h2 id="qr-empty" className="k16">{floorLabel(model, floor)} chưa có lối đi</h2>
                    <p className="k14 k-m">Mỗi mã QR là một nút lối đi. Vẽ lối đi trước, rồi tạo mã ở chân thang và giao lộ.</p>
                    <div className="ws-mt8"><Button variant="primary" to={`/builder/v/${venueId}/walkways?floor=${floorId}`}>Mở Lối đi</Button></div>
                </section>
            ) : (
                <div className="ws-row ws-fill">
                    <div className="ws-col ws-grow" style={{ gap: 16 }}>
                        <section aria-label="Vị trí mã trên mặt bằng" className="k-card ws-card0 ws-qrmap">
                            <EditorMap model={model} floorId={floorId}>
                                {map => <QrNodesLayer map={map} nodes={floorNodes} state={state} current={currentId} onPick={pick} />}
                            </EditorMap>
                            <div className="ws-float is-tr is-col" style={{ borderRadius: 6 }}>
                                {(["pasted", "printed", "created"] as QrStatus[]).map(s => <span key={s} className="k-line"><span aria-hidden="true" className={`ws-qr is-lg is-${s}`} />{QR_STATUS_LABEL[s]}</span>)}
                                <span className="k-line"><span aria-hidden="true" className="ws-qr is-lg is-lost" />Mất nút</span>
                            </div>
                        </section>

                        <section aria-label="Danh sách mã" className="k-card ws-card0 ws-fill" style={{ display: "flex" }}>
                            <div className="k-line" style={{ padding: "12px 16px", borderBottom: "1px solid var(--rule)", flexWrap: "wrap" }} role="group" aria-label="Lọc theo trạng thái">
                                {chip("all", "Tất cả", listed.length)}{chip("created", "Đã tạo", countBy("created"))}{chip("printed", "Đã in", countBy("printed"))}{chip("pasted", "Đã dán", countBy("pasted"))}
                                {lost.length > 0 && chip("issue", "Cần xử lý", lost.length, true)}
                                {coverage != null && <span className={`k12 ws-right ${coverage > 60 ? "k-warn" : "k-m"}`}>Điểm xa mã nhất {Math.round(coverage)} m</span>}
                            </div>
                            <div role="region" aria-label="Thao tác hàng loạt" className="ws-bulk">
                                <input type="checkbox" className="k-check" aria-label="Chọn tất cả" checked={allChecked} disabled={!shown.length}
                                    onChange={() => setChecked(c => (allChecked ? new Set([...c].filter(x => !shown.includes(x))) : new Set([...c, ...shown])))} />
                                <span className="k14 k-b">{checkedHere.length} / {shown.length} đã chọn</span>
                                <div className="k-line ws-right">
                                    <StatusMenu disabled={!printable.length} onPick={s => setStatus(printable, s)} onRevoke={() => void revoke(checkedHere)} />
                                    <Button variant="primary" disabled={!printable.length} onClick={() => navigate(`/builder/v/${venueId}/qr-print?codes=${encodeURIComponent(printable.join(","))}`)}>
                                        {printable.length ? `In ${printable.length} tem đã chọn` : "In tem đã chọn"}
                                    </Button>
                                </div>
                            </div>
                            <div className="ws-tblwrap ws-fill">
                                <table className="k-tbl">
                                    <thead><tr><th scope="col"><span className="sr-only">Chọn</span></th><th scope="col">Mã</th><th scope="col">Vị trí in trên thẻ</th><th scope="col">Trạng thái</th><th scope="col">Cập nhật</th></tr></thead>
                                    <tbody>
                                        {shown.map(id => {
                                            const n = nodesById.get(id);
                                            const st = qrStatus(state, id);
                                            const tm = state.times[id];
                                            return (
                                                <tr key={id} className="is-click" tabIndex={0} aria-selected={id === currentId} onClick={() => setCurrent(id)} onKeyDown={e => e.key === "Enter" && setCurrent(id)}>
                                                    <td style={{ width: 20 }} onClick={e => e.stopPropagation()}><input type="checkbox" className="k-check" aria-label={`Chọn ${id}`} checked={checked.has(id)} onChange={() => toggleCheck(id)} /></td>
                                                    <td className="k-b is-nowrap">{id}</td>
                                                    <td>{n ? qrPlaceText(model, n) : <span className="k-m">Không còn nút</span>}</td>
                                                    <td className="is-nowrap">
                                                        <span className={st === "created" ? "k-m" : undefined}>{QR_STATUS_LABEL[st]}</span>
                                                        {!n && <span className="k-badge k-danger" style={{ marginLeft: 12 }}><Lc name="triangle-alert" size={14} />Nút đã xoá</span>}
                                                    </td>
                                                    <td className="k-m">{day(tm?.posted ?? tm?.printed ?? tm?.created) ?? "—"}</td>
                                                </tr>
                                            );
                                        })}
                                        {!shown.length && <tr><td colSpan={5} className="k-m">{listed.length ? "Không có mã nào ở trạng thái này." : "Chưa có mã nào. Bấm Gợi ý vị trí mã, hoặc bấm một nút lối đi trên bản đồ."}</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    </div>

                    <aside aria-label={currentId ? `Mã ${currentId}` : "Chi tiết mã"} className="k-card ws-card0" style={{ width: 360, flexShrink: 0, minHeight: 0, display: "flex" }}>
                        {currentId ? (
                            <>
                                <div className="ws-cardhead is-24" style={{ flexDirection: "column", alignItems: "flex-start", gap: 0 }}>
                                    <div className="k-line">
                                        <h2 className="k16">{currentId}</h2>
                                        {status === "pasted" && <span className="k-badge k-ok"><Lc name="circle-check" size={14} />Đã dán</span>}
                                        {status && status !== "pasted" && <span className="k-badge k-m">{QR_STATUS_LABEL[status]}</span>}
                                    </div>
                                    <div className="k12 k-m">{currentNode ? `${floorLabel(model, model.floorsById.get(currentNode.floorId))}, ${qrPlaceText(model, currentNode).toLowerCase()}` : "Nút lối đi đã bị xoá"}</div>
                                </div>
                                <div className="k-stack" style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "16px 24px" }}>
                                    {!currentNode && (
                                        <div className="k-note" role="alert">
                                            <Lc name="triangle-alert" size={16} color="var(--danger)" />
                                            <div><b className="k-b">Nút đã bị xoá khỏi lối đi.</b> Khách quét tem này sẽ không định vị được. Thu hồi mã và gỡ tem.</div>
                                        </div>
                                    )}
                                    {currentNode && (
                                        <figure className="ws-qrfig">
                                            <div className="band k12 k-b">Quét để xem bản đồ</div>
                                            <div className="ws-qrsvg" style={{ width: 112, height: 112, margin: "12px auto 4px" }}
                                                dangerouslySetInnerHTML={svg?.id === currentId ? { __html: svg.svg } : undefined} />
                                            <figcaption style={{ padding: "0 12px 12px" }}><div className="k16">{currentId}</div><div className="k12 k-m">{qrPlaceText(model, currentNode)}</div></figcaption>
                                        </figure>
                                    )}
                                    <div>
                                        <h3 className="k-sec" style={{ marginBottom: 8 }}>Vòng đời tem</h3>
                                        <dl className="ws-kv k14" style={{ gridTemplateColumns: "1fr 1fr" }}>
                                            <dt className={status === "created" ? "k-b" : undefined}>Tạo</dt><dd className="k-m">{day(t?.created) ?? "—"}</dd>
                                            <dt className={status === "printed" ? "k-b" : undefined}>Đã in</dt><dd className="k-m">{day(t?.printed) ?? (status === "printed" || status === "pasted" ? "có" : "chưa")}</dd>
                                            <dt className={status === "pasted" ? "k-b" : undefined}>Đã dán</dt><dd className="k-m">{day(t?.posted) ?? (status === "pasted" ? "có" : "chưa")}</dd>
                                        </dl>
                                        <div className="k12 k-m" style={{ marginTop: 8 }}>Lưu trên trình duyệt này.</div>
                                    </div>
                                    {currentNode && <div><Link to={`/builder/v/${venueId}/walkways?floor=${currentNode.floorId}`} className="k-btn t sm" style={{ paddingLeft: 0 }}>Xem nút trong Lối đi</Link></div>}
                                </div>
                                <div className="ws-cardfoot is-24" style={{ justifyContent: "space-between" }}>
                                    {currentNode
                                        ? <Button onClick={() => setStatus([currentId], status === "pasted" ? "printed" : "pasted")}>{status === "pasted" ? "Bỏ đánh dấu đã dán" : "Đánh dấu đã dán"}</Button>
                                        : <span />}
                                    <button type="button" className="k-btn d" style={{ marginRight: -16 }} onClick={() => void revoke([currentId])}>Thu hồi mã…</button>
                                </div>
                            </>
                        ) : (
                            <div className="ws-pidle" style={{ flex: 1 }}><p className="k14 k-m">Bấm một nút lối đi trên bản đồ để tạo mã, hoặc chọn mã trong danh sách.</p></div>
                        )}
                    </aside>
                </div>
            )}
        </div>
    );
}

function StatusMenu({ disabled, onPick, onRevoke }: { disabled: boolean; onPick(s: QrStatus): void; onRevoke(): void }) {
    if (disabled) return <button type="button" className="k-btn" disabled>Đổi trạng thái<Lc name="chevron-down" size={16} color="var(--muted)" /></button>;
    return (
        <RowMenu label="Đổi trạng thái các mã đã chọn" trigger="Đổi trạng thái">
            {(["created", "printed", "pasted"] as QrStatus[]).map(s => <button key={s} role="menuitem" type="button" onClick={() => onPick(s)}>{QR_STATUS_LABEL[s]}</button>)}
            <button role="menuitem" type="button" className="is-danger" onClick={onRevoke}>Thu hồi mã…</button>
        </RowMenu>
    );
}
