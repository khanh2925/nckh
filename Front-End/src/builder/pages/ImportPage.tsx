import { useMemo, useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { normalizeText, type ImportResultDto, type LocationDto } from "@indoor-map/core";
import { catalogApi, locationApi } from "../../console/api";
import { HeaderActions } from "../../console/Shell";
import { Button, COLORS, useAction } from "../../console/ui";
import Lc from "../../design/Lc";
import { floorLabel, FloorSelect, GuestLink } from "../FloorList";
import { useWorkspace } from "../Workspace";
import { Steps } from "./CalibratePage";
import "./workspace.css";

// Nhập hàng loạt địa điểm từ CSV hoặc GeoJSON vào một tầng. Kiểm tra trên trình duyệt trước, rồi gửi một lần.
const FIELDS = [
    ["name", "Tên"], ["type", "Loại"], ["x", "x (px)"], ["y", "y (px)"], ["lat", "Vĩ độ (lat)"], ["lng", "Kinh độ (lng)"],
    ["area", "Khu vực"], ["description", "Mô tả"], ["openingHours", "Giờ mở"], ["phone", "Điện thoại"], ["website", "Trang web"], ["facilities", "Tiện ích"]
] as const;
type FieldKey = (typeof FIELDS)[number][0];
const GUESS: Record<string, FieldKey> = {
    name: "name", ten: "name", "tên": "name", type: "type", loai: "type", "loại": "type", x: "x", y: "y", lat: "lat", latitude: "lat", "vĩ độ": "lat",
    lng: "lng", lon: "lng", longitude: "lng", "kinh độ": "lng", area: "area", khu_vuc: "area", "khu vực": "area", description: "description", mo_ta: "description",
    "mô tả": "description", openinghours: "openingHours", hours: "openingHours", gio_mo: "openingHours", phone: "phone", dien_thoai: "phone",
    website: "website", facilities: "facilities", tien_ich: "facilities", "tiện ích": "facilities"
};

/** CSV đơn giản: dấu phẩy hoặc chấm phẩy, có ngoặc kép */
function parseCsv(text: string): string[][] {
    const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
    const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = "";
    let quoted = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i]!;
        if (quoted) {
            if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
            else if (c === '"') quoted = false;
            else cell += c;
        } else if (c === '"') quoted = true;
        else if (c === sep) { row.push(cell); cell = ""; }
        else if (c === "\n" || c === "\r") {
            if (c === "\r" && text[i + 1] === "\n") i++;
            row.push(cell); rows.push(row); row = []; cell = "";
        } else cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(r => r.some(x => x.trim()));
}

interface Row {
    index: number;
    dto: Partial<LocationDto>;
    errors: string[];
    warnings: string[];
}


const NEED: [string, string, string][] = [
    ["ten", "Tên", "Bắt buộc"], ["loai", "Loại", "Tuỳ chọn"], ["x, y", "Vị trí (px)", "Bắt buộc, hoặc lat, lng"],
    ["mo_ta", "Mô tả", "Tuỳ chọn"], ["tien_ich", "Tiện ích, cách nhau bởi ;", "Tuỳ chọn"], ["gio_mo", "Giờ mở cửa", "Tuỳ chọn"]
];
const SAMPLE = "ten,loai,x,y,mo_ta,tien_ich,gio_mo\nQuầy thông tin,info,640,410,Hỏi đường,Wi-Fi;Ổ cắm sạc,05:00–22:00\n";

/** Tải xuống một tệp chữ tạo ngay trên trình duyệt */
function downloadText(name: string, text: string, type = "text/csv;charset=utf-8") {
    const url = URL.createObjectURL(new Blob(["\uFEFF" + text], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const csvCell = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export default function ImportPage() {
    const { venueId, data, model, reload } = useWorkspace();
    const { busy, run } = useAction();
    const [params] = useSearchParams();
    const [floorId, setFloorId] = useState<number>(Number(params.get("floor")) || model.defaultFloor?.id || model.floors[0]?.id || 0);
    const [fileName, setFileName] = useState<string | null>(null);
    const [reading, setReading] = useState(false);
    const [header, setHeader] = useState<string[]>([]);
    const [records, setRecords] = useState<Record<string, string>[]>([]);
    const [mapping, setMapping] = useState<Record<string, FieldKey | "">>({});
    const [createTypes, setCreateTypes] = useState(true);
    const [dupPolicy, setDupPolicy] = useState<"skip" | "keep">("skip");
    const [filter, setFilter] = useState<"all" | "review">("all");
    const [over, setOver] = useState(false);
    const [result, setResult] = useState<ImportResultDto | null>(null);
    const [error, setError] = useState<{ file: string; message: string } | null>(null);
    const fileInput = useRef<HTMLInputElement>(null);
    const floor = model.floorsById.get(floorId);
    const typeCodes = new Set(data.types.map(t => t.code));
    const typeByName = new Map(data.types.map(t => [t.name.toLowerCase(), t.code]));
    const base = `/builder/v/${venueId}`;

    const readFile = async (file: File) => {
        setResult(null);
        setError(null);
        setReading(true);
        try {
            const text = await file.text();
            if (/\.(geo)?json$/i.test(file.name)) {
                const json = JSON.parse(text) as { features?: { geometry?: { type: string; coordinates: number[] }; properties?: Record<string, unknown> }[] };
                const features = (json.features ?? []).filter(f => f.geometry?.type === "Point");
                if (!features.length) throw new Error("no points");
                const recs = features.map(f => ({
                    ...Object.fromEntries(Object.entries(f.properties ?? {}).map(([k, v]) => [k, Array.isArray(v) ? v.join(";") : String(v ?? "")])),
                    lng: String(f.geometry!.coordinates[0]), lat: String(f.geometry!.coordinates[1])
                }));
                const keys = [...new Set(recs.flatMap(r => Object.keys(r)))];
                setHeader(keys);
                setRecords(recs);
                setMapping(Object.fromEntries(keys.map(k => [k, GUESS[k.toLowerCase()] ?? ""])));
            } else if (/\.(csv|txt)$/i.test(file.name) || file.type === "text/csv") {
                const rows = parseCsv(text.replace(/^\uFEFF/, ""));
                const [head = [], ...body] = rows;
                if (!head.length || !body.length) throw new Error("empty");
                const keys = head.map(h => h.trim());
                setHeader(keys);
                setRecords(body.map(r => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()]))));
                setMapping(Object.fromEntries(keys.map(k => [k, GUESS[k.toLowerCase()] ?? ""])));
            } else {
                throw new Error("format");
            }
            setFileName(file.name);
        } catch {
            setHeader([]);
            setRecords([]);
            setFileName(null);
            setError({ file: file.name, message: "Chỉ nhận CSV (UTF-8, dòng đầu là tiêu đề) hoặc GeoJSON gồm các Point. Trong Excel, chọn Lưu thành, rồi chọn CSV UTF-8." });
        } finally {
            setReading(false);
        }
    };
    const onFile = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (file) void readFile(file);
    };
    const onDrop = (e: DragEvent) => {
        e.preventDefault();
        setOver(false);
        const file = e.dataTransfer.files[0];
        if (file) void readFile(file);
    };

    const existingNames = useMemo(() => new Set(model.locations.filter(l => l.floorId === floorId).map(l => normalizeText(l.name))), [model, floorId]);

    const rows: Row[] = useMemo(() => records.map((rec, index) => {
        const get = (key: FieldKey) => {
            const column = Object.entries(mapping).find(([, f]) => f === key)?.[0];
            return column ? rec[column]?.trim() ?? "" : "";
        };
        const errors: string[] = [];
        const warnings: string[] = [];
        const num = (v: string) => (v === "" ? undefined : Number(v.replace(",", ".")));
        let x = num(get("x"));
        let y = num(get("y"));
        let lat = num(get("lat"));
        let lng = num(get("lng"));
        const projection = floor?.projection;
        if (lat == null || lng == null) {
            if (x != null && y != null && projection) ({ lat, lng } = projection.toLatLng(x, y));
            else if (x != null && y != null) errors.push("tầng chưa căn chỉnh, không đổi được x, y");
            else errors.push("thiếu toạ độ");
        } else if (projection && (x == null || y == null)) {
            const xy = projection.toImage({ lat, lng });
            x = Math.round(xy.x * 10) / 10;
            y = Math.round(xy.y * 10) / 10;
        }
        if ([x, y, lat, lng].some(v => v != null && Number.isNaN(v))) errors.push("toạ độ không phải số");
        if (projection && x != null && y != null && floor?.plan?.width && floor.plan.height && (x < 0 || y < 0 || x > floor.plan.width || y > floor.plan.height)) {
            warnings.push("nằm ngoài mặt bằng");
        }
        const name = get("name");
        if (!name) errors.push("thiếu tên");
        else if (existingNames.has(normalizeText(name))) (dupPolicy === "skip" ? errors : warnings).push("trùng tên trên tầng");
        let type = get("type");
        if (type && !typeCodes.has(type)) {
            const byName = typeByName.get(type.toLowerCase());
            if (byName) type = byName;
            else warnings.push(createTypes ? `tạo loại mới “${type}”` : `loại “${type}” chưa có, sẽ thành Địa điểm khác`);
        }
        const facilities = get("facilities").split(/[;|]/).map(s => s.trim()).filter(Boolean);
        const dto: Partial<LocationDto> = {
            floorId, name, type: type || "other", x, y, lat, lng, area: get("area") || undefined, description: get("description") || undefined,
            openingHours: get("openingHours") || undefined, phone: get("phone") || undefined, website: get("website") || undefined,
            facilities: facilities.length ? [...new Set(facilities)] : undefined
        };
        return { index, dto, errors, warnings };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [records, mapping, floor, createTypes, data.types, existingNames, dupPolicy]);

    const valid = rows.filter(r => !r.errors.length);
    const newTypes = [...new Set(valid.map(r => r.dto.type!).filter(t => !typeCodes.has(t)))];
    const bad = rows.length - valid.length;
    const warned = valid.filter(r => r.warnings.length).length;
    const mappedFields = new Set(Object.values(mapping).filter(Boolean));
    const hasCoords = (mappedFields.has("x") && mappedFields.has("y")) || (mappedFields.has("lat") && mappedFields.has("lng"));
    const mappingOk = mappedFields.has("name") && hasCoords;
    const step = !fileName ? 0 : mappingOk ? 2 : 1;
    const shown = filter === "all" ? rows : rows.filter(r => r.errors.length || r.warnings.length);

    const submit = async () => {
        const done = await run(async () => {
            if (createTypes) {
                for (const code of newTypes) {
                    const clean = code.toLowerCase().replace(/[^a-z0-9_]/g, "_");
                    await catalogApi.createType(venueId, { code: clean, name: code, icon: "bi-geo-alt", color: COLORS[COLORS.length - 1], groupName: "service" });
                    valid.forEach(r => { if (r.dto.type === code) r.dto.type = clean; });
                }
            } else {
                valid.forEach(r => { if (!typeCodes.has(r.dto.type!)) r.dto.type = "other"; });
            }
            return locationApi.importMany(venueId, valid.map(r => r.dto));
        });
        if (done) {
            setResult(done);
            await reload("locations", "types", "facilities");
        }
    };

    const downloadErrors = () => {
        const lines = [["dong", ...header, "loi"].map(csvCell).join(",")];
        rows.filter(r => r.errors.length).forEach(r => lines.push([r.index + 2, ...header.map(h => records[r.index]?.[h] ?? ""), r.errors.join("; ")].map(csvCell).join(",")));
        downloadText(`${(fileName ?? "tep").replace(/\.[^.]+$/, "")}_loi.csv`, lines.join("\n"));
    };

    const typeLabel = (code?: string) => data.types.find(t => t.code === code)?.name ?? code ?? "";
    const reset = () => {
        setFileName(null);
        setHeader([]);
        setRecords([]);
        setResult(null);
        setError(null);
        fileInput.current?.click();
    };

    const helpBox = (
        <section aria-labelledby="need-title" className="k-card ws-card0">
            <div className="ws-cardhead">
                <h2 id="need-title" className="k16">Cột trong tệp</h2>
                <button type="button" className="k-btn t sm ws-right" onClick={() => downloadText("mau_diem_quan_tam.csv", SAMPLE)}>Tải tệp mẫu</button>
            </div>
            <table className="k-tbl is-dense"><tbody>{NEED.map(([a, b, c]) => <tr key={a}><td className="k-m">{a}</td><td>{b}</td><td className="k-m">{c}</td></tr>)}</tbody></table>
        </section>
    );

    let footer: ReactNode = <div className="ws-right"><button type="button" className="k-btn" disabled>Nhập điểm</button></div>;
    if (reading) footer = <><span role="status" className="k14 k-m">Đang đọc tệp…</span><div className="ws-right"><button type="button" className="k-btn p" disabled>Nhập điểm</button></div></>;
    else if (result) footer = <div className="ws-right k-line"><Button onClick={reset}>Nhập tệp khác</Button><Button variant="primary" to={`${base}/editor?floor=${floorId}`}>Xem trên mặt bằng</Button></div>;
    else if (fileName) footer = (
        <>
            {bad > 0 && <span role="status" className="k14 k-danger k-line"><Lc name="circle-alert" size={16} />{bad} dòng lỗi sẽ bị bỏ qua</span>}
            {bad > 0 && <button type="button" className="k-btn" onClick={downloadErrors}><Lc name="download" size={16} />Tải file lỗi (.csv)</button>}
            <div className="k-line ws-right">
                <Button to={`${base}/editor?floor=${floorId}`}>Huỷ</Button>
                <Button variant="primary" busy={busy} disabled={!valid.length || !mappingOk} onClick={() => void submit()}>Nhập {valid.length} dòng hợp lệ</Button>
            </div>
        </>
    );

    return (
        <div className="ws-scroll">
            <HeaderActions><GuestLink venue={data.venue} /></HeaderActions>
            <input ref={fileInput} type="file" accept=".csv,.txt,.json,.geojson,text/csv,application/json,application/geo+json" hidden onChange={onFile} />
            <div className="k-page">
                <div>
                    <Link to={`${base}/editor?floor=${floorId}`} className="k12 k-m ws-back"><Lc name="chevron-left" size={16} />Điểm và vùng</Link>
                    <div className="k-title">
                        <h1 className="k24">Nhập điểm quan tâm</h1>
                        <div className="k-acts">
                            <label htmlFor="imp-floor" className="k14 k-m" style={{ whiteSpace: "nowrap" }}>Nhập vào</label>
                            <FloorSelect model={model} floorId={floorId} onSelect={setFloorId} id="imp-floor" width={220} />
                        </div>
                    </div>
                </div>
                <Steps labels={["Chọn tệp", "Ghép cột", "Kiểm tra và nhập"]} current={result ? 3 : step} />

                {!fileName && !reading ? (
                    <div className="ws-split is-help">
                        <section aria-label="Chọn tệp" className={`k-card ws-drop${over ? " is-over" : ""}${error ? " is-bad" : ""}`}
                            onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={onDrop}>
                            {error ? (
                                <>
                                    <h2 role="alert" className="k16 k-line k-danger"><Lc name="circle-alert" size={18} />Không đọc được tệp {error.file}</h2>
                                    <p className="k14 k-m">{error.message}</p>
                                    <div className="ws-mt8"><Button variant="primary" onClick={() => fileInput.current?.click()}>Chọn tệp khác</Button></div>
                                </>
                            ) : (
                                <>
                                    <h2 className="k16 k-line"><Lc name="upload" size={18} color="var(--muted)" />Kéo tệp vào đây</h2>
                                    <p className="k14 k-m">CSV (UTF-8) hoặc GeoJSON</p>
                                    <div className="ws-mt8"><Button variant="primary" onClick={() => fileInput.current?.click()}>Chọn tệp</Button></div>
                                </>
                            )}
                        </section>
                        {helpBox}
                    </div>
                ) : (
                    <div className="ws-split is-280">
                        <aside className="k-stack">
                            <div className="k-card tight">
                                <div className="k-line" style={{ gap: 16 }}>
                                    <div className="ws-grow">
                                        <div className="k14 k-b ws-ellipsis" title={fileName ?? ""}>{fileName ?? "Đang đọc tệp"}</div>
                                        <div className="k12 k-m">{reading ? "Đang đọc…" : `${records.length} dòng`}</div>
                                    </div>
                                    {!reading && <button type="button" className="k-btn t sm" onClick={reset}>Đổi tệp</button>}
                                </div>
                            </div>
                            {reading ? (
                                <div className="k-card tight" aria-hidden="true">
                                    <span className="k-skel" style={{ width: 80, height: 16 }} />
                                    {Array.from({ length: 6 }, (_, i) => <span key={i} className="k-skel" style={{ height: 12 }} />)}
                                </div>
                            ) : (
                                <>
                                    <section aria-labelledby="map-title" className="k-card ws-card0">
                                        <div className="ws-cardhead">
                                            <h2 id="map-title" className="k16">Ghép cột</h2>
                                            <span className={`k-badge ${mappingOk ? "k-ok" : "k-warn"}`}>{header.filter(h => mapping[h]).length}/{header.length}</span>
                                        </div>
                                        <table className="k-tbl is-dense">
                                            <thead><tr><th scope="col">Cột trong tệp</th><th scope="col">Trường</th></tr></thead>
                                            <tbody>
                                                {header.map(h => (
                                                    <tr key={h}>
                                                        <td className="k-m ws-ellipsis" style={{ maxWidth: 100 }} title={h}>{h}</td>
                                                        <td>
                                                            <select className="k-input" style={{ height: 32 }} aria-label={`Trường cho cột ${h}`} value={mapping[h] ?? ""} onChange={e => setMapping(m => ({ ...m, [h]: e.target.value as FieldKey | "" }))}>
                                                                <option value="">Bỏ qua</option>
                                                                {FIELDS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                                                            </select>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {!mappingOk && <div className="ws-cardfoot k12 k-warn">Cần ghép cột Tên và toạ độ (x, y hoặc lat, lng).</div>}
                                    </section>
                                    <section aria-label="Tuỳ chọn nhập" className="k-card tight">
                                        <label className="k-line k14" style={{ minHeight: 32 }}>
                                            <input type="checkbox" className="k-check" checked={createTypes} onChange={e => setCreateTypes(e.target.checked)} />
                                            {newTypes.length ? `Tạo ${newTypes.length} loại mới` : "Tạo loại chưa có"}
                                        </label>
                                        <div className="k-field">
                                            <label htmlFor="dup">Trùng tên trên tầng</label>
                                            <select id="dup" className="k-input" value={dupPolicy} onChange={e => setDupPolicy(e.target.value as "skip" | "keep")}>
                                                <option value="skip">Bỏ qua dòng trùng</option>
                                                <option value="keep">Vẫn nhập</option>
                                            </select>
                                        </div>
                                    </section>
                                </>
                            )}
                        </aside>

                        <section aria-label="Kết quả kiểm tra" className="k-stack" style={{ minWidth: 0 }} role={reading ? "status" : undefined}>
                            {reading ? (
                                <>
                                    <div className="k-card" aria-hidden="true"><div className="k-grid3">{[0, 1, 2].map(i => <div key={i} className="k-kpi" style={{ gap: 8 }}><span className="k-skel" style={{ width: 64, height: 12 }} /><span className="k-skel" style={{ width: 96, height: 28 }} /></div>)}</div></div>
                                    <div className="k-card ws-card0" aria-hidden="true"><table className="k-tbl"><tbody>{Array.from({ length: 7 }, (_, i) => <tr key={i}>{[24, 160, 96, 72, 140].map(w => <td key={w}><span className="k-skel" style={{ width: w, height: 12 }} /></td>)}</tr>)}</tbody></table></div>
                                </>
                            ) : result ? (
                                <div className="k-card">
                                    <h2 className="k16">Đã nhập vào {floorLabel(model, floor)}</h2>
                                    <div className="k-grid3">
                                        <Kpi n={result.imported} label="Đã nhập" />
                                        <Kpi n={result.skipped} label="Máy chủ từ chối" tone={result.skipped ? "k-danger" : ""} />
                                        <Kpi n={bad} label="Bỏ qua trước khi gửi" />
                                    </div>
                                    {result.errors.map(e => <div key={e} className="k-badge k-danger"><Lc name="circle-alert" size={14} />{e}</div>)}
                                </div>
                            ) : (
                                <>
                                    <div className="k-card">
                                        <div className="k-grid3">
                                            <Kpi n={valid.length} label="Sẽ nhập" sub={warned ? `${warned} có cảnh báo` : undefined} />
                                            <Kpi n={bad} label="Bị bỏ qua" sub="dòng lỗi" tone={bad ? "k-danger" : ""} />
                                            <Kpi n={rows.length} label="Tổng" sub="dòng trong tệp" />
                                        </div>
                                    </div>
                                    <div className="k-card ws-card0" style={{ overflowX: "auto" }}>
                                        <div className="k-line" role="group" aria-label="Lọc dòng" style={{ padding: 16, borderBottom: "1px solid var(--rule)" }}>
                                            <button type="button" className="k-chip" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>Tất cả {rows.length}</button>
                                            <button type="button" className="k-chip" aria-pressed={filter === "review"} onClick={() => setFilter("review")}>Cần xem {bad + warned}</button>
                                        </div>
                                        <table className="k-tbl">
                                            <thead><tr><th scope="col">Dòng</th><th scope="col">Tên</th><th scope="col">Loại</th><th scope="col">x, y</th><th scope="col">Kiểm tra</th></tr></thead>
                                            <tbody>
                                                {shown.slice(0, 200).map(r => (
                                                    <tr key={r.index}>
                                                        <td className="k-m">{r.index + 2}</td>
                                                        <td className="k-b">{r.dto.name || <span className="k-danger">(trống)</span>}</td>
                                                        <td>{typeLabel(r.dto.type)}</td>
                                                        <td className="k-m is-nowrap">{r.dto.x != null ? `${Math.round(r.dto.x)}, ${Math.round(r.dto.y ?? 0)}` : r.dto.lat != null ? `${r.dto.lat.toFixed(5)}, ${r.dto.lng?.toFixed(5)}` : "—"}</td>
                                                        <td>
                                                            {r.errors.length ? <span className="k-badge k-danger"><Lc name="circle-alert" size={14} />Bỏ qua: {r.errors.join(", ")}</span>
                                                                : r.warnings.length ? <span className="k-badge k-warn"><Lc name="triangle-alert" size={14} />{r.warnings.join(", ").replace(/^./, c => c.toUpperCase())}</span>
                                                                    : <span className="k-m">Hợp lệ</span>}
                                                        </td>
                                                    </tr>
                                                ))}
                                                {!shown.length && <tr><td colSpan={5} className="k-m">Không có dòng nào cần xem.</td></tr>}
                                            </tbody>
                                        </table>
                                        {shown.length > 200 && <div className="ws-cardfoot k12 k-m">Hiện 200 trên {shown.length} dòng.</div>}
                                    </div>
                                </>
                            )}
                        </section>
                    </div>
                )}
            </div>
            <div className="ws-stickyfoot"><div>{footer}</div></div>
        </div>
    );
}

function Kpi({ n, label, sub, tone = "" }: { n: number; label: string; sub?: string; tone?: string }) {
    return (
        <div className="k-kpi">
            <span className="k12 k-m">{label}</span>
            <div className="k-line" style={{ alignItems: "baseline" }}><span className={`k28 ${tone}`}>{n}</span>{sub && <span className="k12 k-m">{sub}</span>}</div>
        </div>
    );
}
