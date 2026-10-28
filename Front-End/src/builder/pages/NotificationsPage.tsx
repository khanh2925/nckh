import { useAuth } from "../../console/auth";
import { Button } from "../../console/ui";
import "./global.css";

// Thông báo cấp tài khoản (giai đoạn 2). Backend chưa có API thông báo và chưa gửi email:
// hiện đúng bố cục của bản thiết kế với trạng thái trống, ô chọn email bị tắt.
const MAIL: [string, boolean, string?][] = [
    ["Địa điểm bị ẩn hoặc hiện lại", true, "Luôn gửi"],
    ["Tài khoản được duyệt hoặc bị khoá", true, "Luôn gửi"],
    ["Tem cần thay", true],
    ["Xuất bản xong", false]
];

export default function NotificationsPage() {
    const { user } = useAuth();
    return (
        <>
            <div className="k-title">
                <h1 className="k24">Thông báo</h1>
                <span className="k14 k-m">Giai đoạn 2</span>
            </div>
            <div className="kg-split">
                <div className="main">
                    <section aria-label="Danh sách thông báo" className="k-card kg-empty">
                        <h2 className="k16">Chưa có thông báo</h2>
                        <p className="k14 k-m">Địa điểm bị ẩn, xuất bản xong hay tem cần thay sẽ hiện ở đây.</p>
                        <p className="k12 k-m">Chưa khả dụng</p>
                        <div style={{ marginTop: 8 }}><Button to="/builder">Mở Địa điểm của tôi</Button></div>
                    </section>
                </div>
                <aside aria-labelledby="em-t" aria-disabled="true" className="k-card" style={{ gap: 8 }}>
                    <h2 id="em-t" className="k16">Nhận email</h2>
                    <div className="kg-dim">
                        {MAIL.map(([label, on, hint]) => (
                            <label key={label} className="kg-ck k14">
                                <input type="checkbox" className="k-check" defaultChecked={on} disabled />
                                <span style={{ flex: 1 }}>{label}{hint && <span className="k12 k-m" style={{ display: "block" }}>{hint}</span>}</span>
                            </label>
                        ))}
                    </div>
                    <p className="k12 k-m kg-ruletop">Chưa khả dụng{user?.email ? `, sẽ gửi tới ${user.email}` : ""}</p>
                </aside>
            </div>
        </>
    );
}
