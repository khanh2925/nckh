import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { VenueDto } from "@indoor-map/core";
import { venueApi } from "../../console/api";
import { Button, Empty, ErrorNote, PageHead, Spinner, Status, Table } from "../../console/ui";

// eslint-disable-next-line react-refresh/only-export-components
export const KIND_LABEL: Record<string, string> = {
    airport: "Sân bay", hospital: "Bệnh viện", school: "Trường học", mall: "Trung tâm thương mại", park: "Công viên", office: "Văn phòng", other: "Khác"
};

export function VenueStatus({ status }: { status?: string }) {
    if (status === "PUBLISHED") return <Status kind="ok">Đã xuất bản</Status>;
    if (status === "HIDDEN") return <Status kind="err">Bị ẩn</Status>;
    return <Status kind="mut">Bản nháp</Status>;
}

const STEPS: [string, string, string][] = [
    ["buildings", "01", "Toà nhà & tầng"], ["plan", "02", "Tải & căn chỉnh mặt bằng"], ["editor", "03", "Vùng & điểm quan tâm"],
    ["walkways", "04", "Vẽ lối đi, nối tầng"], ["test", "05", "Thử chỉ đường"], ["publish", "06", "Xuất bản, in mã QR"]
];

export default function VenuesPage() {
    const [venues, setVenues] = useState<VenueDto[] | null>(null);
    const [error, setError] = useState<unknown>(null);
    const [attempt, setAttempt] = useState(0);
    const [selected, setSelected] = useState<number | null>(null);

    useEffect(() => {
        venueApi.mine().then(list => {
            setVenues(list);
            setError(null);
        }).catch(setError);
    }, [attempt]);

    const current = venues?.find(v => v.id === selected) ?? venues?.[0];
    const published = venues?.filter(v => v.status === "PUBLISHED").length ?? 0;

    return (
        <>
            <PageHead title="Địa điểm của tôi"
                sub={venues ? `${venues.length} địa điểm · ${published} đã xuất bản · ${venues.length - published} chưa xuất bản` : "Đang tải…"}
                actions={<Button variant="primary" icon="bi-plus-lg" to="/builder/new">Tạo địa điểm</Button>} />
            {error ? <ErrorNote error={error} onRetry={() => setAttempt(a => a + 1)} /> : null}
            {!venues && !error && <Spinner />}
            {venues && venues.length === 0 && (
                <Empty title="Chưa có địa điểm nào" action={<Button variant="primary" to="/builder/new">Tạo địa điểm đầu tiên</Button>}>
                    Bắt đầu bằng tên, loại hình và khoanh vùng địa điểm trên bản đồ. Các loại địa điểm mẫu theo loại hình được thêm sẵn.
                </Empty>
            )}
            {venues && venues.length > 0 && (
                <Table head={["Địa điểm", "Loại hình", <span key="b" className="is-num">Toà nhà</span>, <span key="f">Tầng</span>, <span key="l">Địa điểm</span>, "Trạng thái", ""]} minWidth={860}>
                    {venues.map(v => (
                        <tr key={v.id} className={`is-click${v.id === current?.id ? " is-selected" : ""}`} onClick={() => setSelected(v.id)}>
                            <td><div style={{ fontWeight: 500 }}>{v.name}</div><div className="cb-mono" style={{ color: "#6B7280" }}>/v/{v.slug}</div></td>
                            <td>{KIND_LABEL[v.kind ?? "other"] ?? v.kind}</td>
                            <td className="is-num">{v.buildingCount ?? 0}</td>
                            <td className="is-num">{v.floorCount ?? 0}</td>
                            <td className="is-num">{v.locationCount ?? 0}</td>
                            <td><VenueStatus status={v.status} /></td>
                            <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                                {v.status === "PUBLISHED" && <a href={`/v/${v.slug}`} target="_blank" rel="noreferrer" style={{ marginRight: 14 }} onClick={e => e.stopPropagation()}>Xem như khách</a>}
                                <Link to={`/builder/v/${v.id}/${(v.floorCount ?? 0) === 0 ? "buildings" : "editor"}`} style={{ fontWeight: 500 }} onClick={e => e.stopPropagation()}>Mở trình biên tập →</Link>
                            </td>
                        </tr>
                    ))}
                </Table>
            )}
            {current && (
                <section className="cb-card cb-pad">
                    <h2 className="cb-h2">Quy trình dựng bản đồ · {current.name}</h2>
                    <p className="cb-muted" style={{ margin: "4px 0 14px" }}>Làm theo thứ tự; mỗi bước mở đúng tab trong trình biên tập.</p>
                    <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
                        {STEPS.map(([path, n, label]) => (
                            <li key={path}>
                                <Link to={`/builder/v/${current.id}/${path}`} className="cb-card" style={{ display: "flex", flexDirection: "column", gap: 6, padding: 12, textDecoration: "none", color: "inherit" }}>
                                    <span className="cb-mono" style={{ color: "#6B7280" }}>{n}</span>
                                    <span style={{ fontWeight: 500 }}>{label}</span>
                                </Link>
                            </li>
                        ))}
                    </ol>
                </section>
            )}
        </>
    );
}
