import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useSearchParams } from "react-router-dom";
import QRCode from "qrcode";
import { qrUrl, type WalkwayNodeDto } from "@indoor-map/core";
import { HeaderActions } from "../../console/Shell";
import { Button } from "../../console/ui";
import Lc from "../../design/Lc";
import { Dialog, floorLabel, GuestLink } from "../FloorList";
import { useWorkspace } from "../Workspace";
import { QR_STATUS_LABEL, qrPlaceText, qrStatus, readQrState, withQrStatus, writeQrState, type QrState } from "./qrLayer";
import "./workspace.css";

const PER_PAGE = [2, 4, 8] as const;
type PerPage = (typeof PER_PAGE)[number];
const TEM_SIZE: Record<PerPage, string> = { 2: "A5, 148 × 210 mm", 4: "A6, 105 × 148 mm", 8: "A7, 74 × 105 mm" };

// In tem mã QR: mã lấy từ ?codes= (chọn ở màn Mã QR), mặc định mọi mã đã tạo. Xem trước theo trang A4, in bằng trình duyệt.
export default function QrPrintPage() {
    const { venueId, data, model } = useWorkspace();
    const [params] = useSearchParams();
    const [state, setState] = useState<QrState>(() => readQrState(venueId));
    const [per, setPer] = useState<PerPage>(4);
    const [opts, setOpts] = useState({ guide: true, english: true, place: true, cut: true });
    const [page, setPage] = useState(0);
    const [svgs, setSvgs] = useState<Record<string, string>>({});
    const [afterPrint, setAfterPrint] = useState<Set<string> | null>(null);
    const origin = window.location.origin;

    const nodes = useMemo(() => {
        const asked = params.get("codes")?.split(",").filter(Boolean);
        const ids = asked?.length ? asked : state.selected;
        return ids.map(id => model.nodesById.get(id)).filter((n): n is WalkwayNodeDto => Boolean(n));
    }, [params, state.selected, model.nodesById]);
    const pages = Math.max(1, Math.ceil(nodes.length / per));
    const shownPage = Math.min(page, pages - 1);

    useEffect(() => writeQrState(venueId, state), [state, venueId]);

    useEffect(() => {
        let alive = true;
        const missing = nodes.filter(n => !svgs[n.id]);
        if (!missing.length) return undefined;
        void Promise.all(missing.map(async n => [n.id, await QRCode.toString(qrUrl(origin, data.venue.slug, n.id), { type: "svg", margin: 1, errorCorrectionLevel: "M" })] as const))
            .then(pairs => alive && setSvgs(s => ({ ...s, ...Object.fromEntries(pairs) })));
        return () => {
            alive = false;
        };
    }, [nodes, svgs, origin, data.venue.slug]);

    const print = () => {
        window.print();
        setAfterPrint(new Set(nodes.map(n => n.id)));
    };
    const markPrinted = () => {
        if (afterPrint?.size) setState(s => withQrStatus(s, [...afterPrint].filter(id => qrStatus(s, id) === "created"), "printed", Date.now()));
        setAfterPrint(null);
    };

    const tem = (n: WalkwayNodeDto) => (
        <div key={n.id} className={`ws-tem${opts.cut ? " is-cut" : ""}`}>
            {opts.guide && <div className="band k12 k-b">Quét để biết bạn đang ở đâu</div>}
            <div className="ws-qrsvg" dangerouslySetInnerHTML={svgs[n.id] ? { __html: svgs[n.id]! } : undefined} />
            <div className={per === 8 ? "k16" : "k20"} style={{ marginTop: 8 }}>{n.id}</div>
            {opts.english && <div className="k12 k-m">Scan to see where you are</div>}
            {opts.place && <div className="k12" style={{ marginTop: per === 8 ? 4 : 8 }}>{qrPlaceText(model, n)}</div>}
            <div className="k12 k-m foot">{data.venue.name}<br />{floorLabel(model, model.floorsById.get(n.floorId))}</div>
        </div>
    );
    const sheets = Array.from({ length: pages }, (_, i) => nodes.slice(i * per, i * per + per));

    return (
        <div className="k-page ws-page-full" style={{ minHeight: 640 }}>
            <HeaderActions><GuestLink venue={data.venue} /></HeaderActions>
            <div className="k-title">
                <h1 className="k24">In tem</h1>
                <div className="k-acts"><Button variant="primary" disabled={!nodes.length} onClick={print}>{nodes.length ? `In ${nodes.length} tem` : "In tem"}</Button></div>
            </div>

            {!nodes.length ? (
                <section className="k-card ws-empty ws-fill" style={{ justifyContent: "center" }}>
                    <h2 className="k16">Chưa có mã nào để in</h2>
                    <p className="k14 k-m">Tạo mã ở màn Mã QR định vị, chọn các mã cần in rồi quay lại đây.</p>
                    <div className="ws-mt8"><Button to={`/builder/v/${venueId}/qr`}>Mở Mã QR định vị</Button></div>
                </section>
            ) : (
                <div className="ws-row ws-fill">
                    <aside aria-label="Tuỳ chọn in" className="k-card ws-card0" style={{ width: 360, flexShrink: 0, minHeight: 0, display: "flex" }}>
                        <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
                            <div className="ws-opt">
                                <div className="k-field"><label htmlFor="paper">Khổ giấy</label><select id="paper" className="k-input" defaultValue="a4"><option value="a4">A4, 210 × 297 mm</option></select></div>
                            </div>
                            <div className="ws-opt">
                                <span className="k-label" id="per-l">Số tem mỗi trang</span>
                                <div className="k-line" role="group" aria-labelledby="per-l">
                                    {PER_PAGE.map(n => <button key={n} type="button" className="k-chip" aria-pressed={per === n} onClick={() => { setPer(n); setPage(0); }}>{n}</button>)}
                                </div>
                                <div className="k-line k14" style={{ justifyContent: "space-between" }}><span className="k-m">Cỡ tem</span><span>{TEM_SIZE[per]}</span></div>
                            </div>
                            <div className="ws-opt" style={{ gap: 0 }}>
                                <span className="k-label" style={{ marginBottom: 4 }}>Nội dung tem</span>
                                {([["guide", "Hướng dẫn quét"], ["english", "Tiếng Anh"], ["place", "Mô tả vị trí dán"], ["cut", "Đường cắt"]] as const).map(([k, label]) => (
                                    <label key={k} className="k-line k14" style={{ minHeight: 32, cursor: "pointer" }}>
                                        <input type="checkbox" className="k-check" checked={opts[k]} onChange={e => setOpts(o => ({ ...o, [k]: e.target.checked }))} />{label}
                                    </label>
                                ))}
                            </div>
                            <div className="ws-opt" style={{ paddingBottom: 8 }}>
                                <div className="k-line"><span className="k-label">{nodes.length} tem, {pages} trang</span><Link to={`/builder/v/${venueId}/qr`} className="k-btn t sm ws-right" style={{ marginRight: -12 }}>Đổi danh sách</Link></div>
                            </div>
                            <table className="k-tbl is-dense">
                                <tbody>
                                    {nodes.map(n => (
                                        <tr key={n.id}>
                                            <td className="k-b is-nowrap" style={{ width: "1%" }}>{n.id}</td>
                                            <td className="ws-ellipsis" style={{ maxWidth: 150 }}>{qrPlaceText(model, n)}</td>
                                            <td className="k-m is-nowrap" style={{ textAlign: "right" }}>{QR_STATUS_LABEL[qrStatus(state, n.id)]}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </aside>
                    <section aria-label="Xem trước trang in" className="k-card ws-preview">
                        <div className={`ws-sheet is-${per}`} role="img" aria-label={`Trang ${shownPage + 1}: ${sheets[shownPage]?.length ?? 0} tem mã QR trên giấy A4`}>
                            {sheets[shownPage]?.map(tem)}
                        </div>
                        <div className="k-line k14">
                            <button type="button" className="k-ib sm" aria-label="Trang trước" title="Trang trước" disabled={shownPage === 0} onClick={() => setPage(shownPage - 1)}><Lc name="chevron-left" size={16} /></button>
                            <span>Trang {shownPage + 1} / {pages}</span>
                            <button type="button" className="k-ib sm" aria-label="Trang sau" title="Trang sau" disabled={shownPage >= pages - 1} onClick={() => setPage(shownPage + 1)}><Lc name="chevron-right" size={16} /></button>
                        </div>
                    </section>
                </div>
            )}

            {/* Bản in gắn thẳng vào body: khung app cao 100dvh, ẩn tràn, sẽ cắt mất trang 2 trở đi */}
            {createPortal(
                <div className="ws-print" aria-hidden="true">
                    {sheets.map((list, i) => <div key={i} className={`ws-sheet is-${per}`}>{list.map(tem)}</div>)}
                </div>,
                document.body
            )}

            {afterPrint && (
                <Dialog title={`Đánh dấu ${afterPrint.size} tem là Đã in?`} onClose={() => setAfterPrint(null)}
                    actions={<><Button onClick={() => setAfterPrint(null)}>Để sau</Button><Button variant="primary" disabled={!afterPrint.size} onClick={markPrinted}>Đánh dấu Đã in</Button></>}>
                    <fieldset className="ws-fs0">
                        <legend className="k-label">Bỏ chọn tem in hỏng để in lại</legend>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 16, maxHeight: 280, overflowY: "auto" }}>
                            {nodes.map(n => (
                                <label key={n.id} className="k-line k14" style={{ minHeight: 32, cursor: "pointer" }}>
                                    <input type="checkbox" className="k-check" checked={afterPrint.has(n.id)}
                                        onChange={() => setAfterPrint(s => { const next = new Set(s); if (next.has(n.id)) next.delete(n.id); else next.add(n.id); return next; })} />{n.id}
                                </label>
                            ))}
                        </div>
                    </fieldset>
                    {nodes.some(n => qrStatus(state, n.id) === "pasted") && <p className="k12 k-m">Có tem đang dán: gỡ tem cũ khi dán tem mới.</p>}
                </Dialog>
            )}
        </div>
    );
}
