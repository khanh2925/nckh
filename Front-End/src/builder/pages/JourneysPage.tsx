import { HeaderActions } from "../../console/Shell";
import { Button, NotYet } from "../../console/ui";
import Lc, { type LucideName } from "../../design/Lc";
import { useWorkspace } from "../Workspace";
import "./workspace.css";

const STEP_KINDS: [LucideName, string][] = [["map-pin", "Điểm cụ thể"], ["list", "Theo loại"], ["circle-help", "Câu hỏi"], ["square-dashed", "Tuỳ chọn"]];

// Quy trình (chuỗi bước dẫn khách: thủ tục, ký gửi, an ninh, cửa ra). Backend chưa có API quy trình:
// giữ bố cục 3 cột của bản thiết kế, mọi thao tác tạo/sửa ở trạng thái "Chưa khả dụng", không giả dữ liệu.
export default function JourneysPage() {
    const { venueId, data } = useWorkspace();
    return (
        <div className="ws-work">
            <HeaderActions>
                <Button to={`/builder/v/${venueId}/diff`}>Khác biệt</Button>
                <Button variant="primary" disabled title="Chưa có quy trình để công khai">Công khai</Button>
            </HeaderActions>
            <aside aria-label="Quy trình và bước" className="ws-panel is-left">
                <section className="ws-grp">
                    <h2 className="k-sec">Quy trình</h2>
                    <button type="button" className="k-btn t sm" style={{ alignSelf: "flex-start", paddingLeft: 8 }} disabled title="Chưa khả dụng"><Lc name="plus" size={16} />Tạo quy trình</button>
                </section>
                <section className="ws-grp">
                    <h2 className="k-sec">Thêm bước</h2>
                    <div>
                        {STEP_KINDS.map(([icon, label]) => <button key={label} type="button" className="ws-tl" disabled title="Chưa khả dụng"><Lc name={icon} size={16} />{label}</button>)}
                    </div>
                </section>
                {data.types.length > 0 && (
                    <section className="ws-grp">
                        <h2 className="k-sec">Loại điểm dùng làm bước</h2>
                        <div>
                            {[...data.types].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)).slice(0, 6).map(t => (
                                <button key={t.code} type="button" className="ws-tl" disabled title="Chưa khả dụng">
                                    <span aria-hidden="true" className="ws-tile" style={{ background: t.color || "var(--muted)" }}><i className={`bi ${t.icon || "bi-geo-alt"}`} /></span>
                                    <span className="ws-ellipsis">{t.name}</span>
                                </button>
                            ))}
                        </div>
                    </section>
                )}
            </aside>
            <section aria-label="Sơ đồ quy trình" className="ws-canvas ws-dots">
                <div role="region" aria-labelledby="j-empty" className="k-card ws-overcard is-400">
                    <h2 id="j-empty" className="k16">Chưa có quy trình nào</h2>
                    <p className="k14 k-m">Quy trình dẫn khách qua nhiều bước theo thứ tự, ví dụ thủ tục, ký gửi, an ninh rồi tới cửa ra.</p>
                    <NotYet>Backend chưa có API lưu quy trình. Khi có, bạn tạo quy trình từ mẫu theo loại hình địa điểm và thử ngay trên bản nháp.</NotYet>
                </div>
            </section>
            <aside aria-label="Thuộc tính bước" className="ws-panel is-right">
                <div className="ws-pidle"><p className="k14 k-m">Chọn một bước để sửa nơi thực hiện, thời gian chờ và điều kiện.</p></div>
            </aside>
        </div>
    );
}
