import { useMemo, useState, type ChangeEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { ImportResultDto, LocationDto } from "@indoor-map/core";
import { catalogApi, locationApi } from "../../console/api";
import { Button, Card, Check, PageHead, Status, Table, useAction } from "../../console/ui";
import { useWorkspace } from "../Workspace";

// Nhập hàng loạt địa điểm từ CSV hoặc GeoJSON vào một tầng. Kiểm tra trên trình duyệt trước, rồi gửi một lần.
const FIELDS = [
    ["name", "Tên *"], ["type", "Loại"], ["x", "x (px)"], ["y", "y (px)"], ["lat", "Vĩ độ (lat)"], ["lng", "Kinh độ (lng)"],
    ["area", "Khu vực"], ["description", "Mô tả"], ["openingHours", "Giờ mở"], ["phone", "Điện thoại"], ["website", "Website"], ["facilities", "Tiện ích (;)"]
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

export default function ImportPage() {
    const { venueId, data, model, reload } = useWorkspace();
    const { busy, run } = useAction();
    const [params] = useSearchParams();
    const [floorId, setFloorId] = useState<number>(Number(params.get("floor")) || model.defaultFloor?.id || model.floors[0]?.id || 0);
    const [fileName, setFileName] = useState<string | null>(null);
    const [header, setHeader] = useState<string[]>([]);
    const [records, setRecords] = useState<Record<string, string>[]>([]);
    const [mapping, setMapping] = useState<Record<string, FieldKey | "">>({});
    const [createTypes, setCreateTypes] = useState(true);
    const [result, setResult] = useState<ImportResultDto | null>(null);
    const [error, setError] = useState<string | null>(null);
    const floor = model.floorsById.get(floorId);
    const typeCodes = new Set(data.types.map(t => t.code));
    const typeByName = new Map(data.types.map(t => [t.name.toLowerCase(), t.code]));

    const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        setResult(null);
        setError(null);
        try {
            const text = await file.text();
            if (/\.(geo)?json$/i.test(file.name)) {
                const json = JSON.parse(text) as { features?: { geometry?: { type: string; coordinates: number[] }; properties?: Record<string, unknown> }[] };
                const features = (json.features ?? []).filter(f => f.geometry?.type === "Point");
                const recs = features.map(f => ({
                    ...Object.fromEntries(Object.entries(f.properties ?? {}).map(([k, v]) => [k, Array.isArray(v) ? v.join(";") : String(v ?? "")])),
                    lng: String(f.geometry!.coordinates[0]), lat: String(f.geometry!.coordinates[1])
                }));
                const keys = [...new Set(recs.flatMap(r => Object.keys(r)))];
                setHeader(keys);
                setRecords(recs);
                setMapping(Object.fromEntries(keys.map(k => [k, GUESS[k.toLowerCase()] ?? ""])));
            } else {
                const rows = parseCsv(text.replace(/^\uFEFF/, ""));
                const [head = [], ...body] = rows;
                const keys = head.map(h => h.trim());
                setHeader(keys);
                setRecords(body.map(r => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()]))));
                setMapping(Object.fromEntries(keys.map(k => [k, GUESS[k.toLowerCase()] ?? ""])));
            }
            setFileName(file.name);
        } catch {
            setError("Không đọc được tệp. Cần CSV có dòng tiêu đề, hoặc GeoJSON gồm các Point.");
        }
    };

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
            else if (x != null && y != null) errors.push("tầng chưa căn chỉnh nên không đổi được x/y sang lat/lng");
            else errors.push("thiếu toạ độ (x, y hoặc lat, lng)");
        } else if (projection && (x == null || y == null)) {
            const xy = projection.toImage({ lat, lng });
            x = Math.round(xy.x * 10) / 10;
            y = Math.round(xy.y * 10) / 10;
        }
        if ([x, y, lat, lng].some(v => v != null && Number.isNaN(v))) errors.push("toạ độ không phải số");
        if (projection && x != null && y != null && floor?.plan?.width && floor.plan.height && (x < 0 || y < 0 || x > floor.plan.width || y > floor.plan.height)) {
            warnings.push("nằm ngoài bản vẽ");
        }
        const name = get("name");
        if (!name) errors.push("thiếu tên");
        let type = get("type");
        if (type && !typeCodes.has(type)) {
            const byName = typeByName.get(type.toLowerCase());
            if (byName) type = byName;
            else warnings.push(createTypes ? `loại mới “${type}” sẽ được tạo` : `loại “${type}” chưa có → “Địa điểm khác”`);
        }
        const facilities = get("facilities").split(/[;|]/).map(s => s.trim()).filter(Boolean);
        const dto: Partial<LocationDto> = {
            floorId, name, type: type || "other", x, y, lat, lng, area: get("area") || undefined, description: get("description") || undefined,
            openingHours: get("openingHours") || undefined, phone: get("phone") || undefined, website: get("website") || undefined,
            facilities: facilities.length ? [...new Set(facilities)] : undefined
        };
        return { index, dto, errors, warnings };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [records, mapping, floor, createTypes, data.types]);

    const valid = rows.filter(r => !r.errors.length);
    const newTypes = [...new Set(valid.map(r => r.dto.type!).filter(t => !typeCodes.has(t)))];

    const submit = async () => {
        const done = await run(async () => {
            if (createTypes) {
                for (const code of newTypes) {
                    const clean = code.toLowerCase().replace(/[^a-z0-9_]/g, "_");
                    await catalogApi.createType(venueId, { code: clean, name: code, icon: "bi-geo-alt", color: "#5f6368", groupName: "service" });
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

    return (
        <div className="cb-main">
            <PageHead title="Nhập hàng loạt địa điểm" sub="Từ CSV (dòng đầu là tiêu đề) hoặc GeoJSON (các Point). Hàng lỗi không được nhập; các hàng còn lại vẫn vào bình thường."
                actions={<Button to={`/builder/v/${venueId}/editor?floor=${floorId}`}>Về Điểm & vùng</Button>} />
            <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20, alignItems: "start" }}>
                <div className="cb-stack">
                    <Card title="1 · Tệp và tầng">
                        <div className="cb-form">
                            <div className="cb-field">
                                <label htmlFor="imp-floor">Nhập vào tầng</label>
                                <select id="imp-floor" className="cb-input" value={floorId} onChange={e => setFloorId(Number(e.target.value))}>
                                    {model.floors.map(f => <option key={f.id} value={f.id}>{f.buildingCode} · {f.name}</option>)}
                                </select>
                            </div>
                            <label className="cb-btn" style={{ cursor: "pointer" }}><i className="bi bi-upload" aria-hidden="true" /> {fileName ? "Chọn tệp khác" : "Chọn tệp CSV / GeoJSON"}
                                <input type="file" accept=".csv,.txt,.json,.geojson" hidden onChange={e => void onFile(e)} />
                            </label>
                            {fileName && <p className="cb-mono">{fileName} · {records.length} hàng</p>}
                            {error && <div className="cb-alert is-err"><i className="bi bi-x-circle" aria-hidden="true" /><span>{error}</span></div>}
                            <p className="cb-muted" style={{ fontSize: 12 }}>Mẫu cột: <span className="cb-mono">ten, loai, x, y, mo_ta, tien_ich</span>. Có x/y (pixel bản vẽ) thì hệ thống tự tính lat/lng và ngược lại.</p>
                        </div>
                    </Card>
                    {header.length > 0 && (
                        <Card title="2 · Ghép cột → trường">
                            <div className="cb-form">
                                {header.map(h => (
                                    <div key={h} style={{ display: "grid", gridTemplateColumns: "1fr 16px 1fr", gap: 6, alignItems: "center" }}>
                                        <span className="cb-mono" style={{ overflow: "hidden", textOverflow: "ellipsis" }} title={h}>{h}</span><span aria-hidden="true">→</span>
                                        <select className="cb-input" aria-label={`Cột ${h}`} value={mapping[h] ?? ""} onChange={e => setMapping(m => ({ ...m, [h]: e.target.value as FieldKey | "" }))}>
                                            <option value="">(bỏ qua)</option>
                                            {FIELDS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                                        </select>
                                    </div>
                                ))}
                                <Check label={`Tạo loại chưa có${newTypes.length ? ` (${newTypes.length})` : ""}`} checked={createTypes} onChange={setCreateTypes} />
                            </div>
                        </Card>
                    )}
                </div>
                <div className="cb-stack">
                    {result ? (
                        <Card title="Kết quả nhập">
                            <div className="cb-kpis" style={{ marginBottom: 12 }}>
                                <div className="cb-card cb-kpi"><div className="cb-muted">Đã nhập</div><div className="cb-kpi-value is-ok">{result.imported}</div></div>
                                <div className="cb-card cb-kpi"><div className="cb-muted">Máy chủ từ chối</div><div className="cb-kpi-value is-err">{result.skipped}</div></div>
                                <div className="cb-card cb-kpi"><div className="cb-muted">Bỏ trước khi gửi</div><div className="cb-kpi-value">{rows.length - valid.length}</div></div>
                            </div>
                            {result.errors.map(e => <div key={e} className="cb-status is-err" style={{ display: "flex" }}>{e}</div>)}
                            <div className="cb-actions" style={{ marginTop: 12 }}><Button variant="primary" to={`/builder/v/${venueId}/editor?floor=${floorId}`}>Xem trên bản đồ →</Button></div>
                        </Card>
                    ) : (
                        <>
                            <div className="cb-kpis">
                                <div className="cb-card cb-kpi"><div className="cb-muted">Sẽ nhập</div><div className="cb-kpi-value is-ok">{valid.length}</div></div>
                                <div className="cb-card cb-kpi"><div className="cb-muted">Lỗi · bỏ qua</div><div className="cb-kpi-value is-err">{rows.length - valid.length}</div></div>
                                <div className="cb-card cb-kpi"><div className="cb-muted">Cảnh báo</div><div className="cb-kpi-value is-warn">{rows.filter(r => r.warnings.length).length}</div></div>
                            </div>
                            {rows.length > 0 ? (
                                <Table head={["#", "Tên", "Loại", "x · y", "Kiểm tra"]} minWidth={620}>
                                    {rows.slice(0, 200).map(r => (
                                        <tr key={r.index} style={r.errors.length ? { background: "#FFF5F4" } : undefined}>
                                            <td className="cb-mono">{r.index + 2}</td>
                                            <td>{r.dto.name || <span className="cb-muted">—</span>}</td>
                                            <td>{data.types.find(t => t.code === r.dto.type)?.name ?? r.dto.type}</td>
                                            <td className="cb-mono">{r.dto.x != null ? `${r.dto.x} · ${r.dto.y}` : r.dto.lat != null ? `${r.dto.lat?.toFixed(5)}, ${r.dto.lng?.toFixed(5)}` : "—"}</td>
                                            <td>{r.errors.length ? <Status kind="err">{r.errors.join("; ")}</Status> : r.warnings.length ? <Status kind="warn">{r.warnings.join("; ")}</Status> : <Status kind="ok">hợp lệ</Status>}</td>
                                        </tr>
                                    ))}
                                </Table>
                            ) : (
                                <div className="cb-empty"><div className="cb-h3">Chưa chọn tệp</div><p className="cb-muted">Chọn tầng và tệp ở cột trái. Kết quả kiểm tra hiện ở đây trước khi nhập.</p></div>
                            )}
                            {rows.length > 200 && <p className="cb-muted">Hiện 200/{rows.length} hàng đầu.</p>}
                            <div className="cb-actions is-end">
                                <Link to={`/builder/v/${venueId}/editor?floor=${floorId}`} className="cb-btn">Huỷ</Link>
                                <Button variant="primary" busy={busy} disabled={!valid.length} onClick={() => void submit()}>Nhập {valid.length} địa điểm vào {floor?.name ?? "tầng"}</Button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
