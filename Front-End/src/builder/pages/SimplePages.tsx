import { useEffect, useState, type FormEvent } from "react";
import type { VenueDto } from "@indoor-map/core";
import { authApi, venueApi } from "../../console/api";
import { useAuth } from "../../console/auth";
import { Button, Card, Field, Kpi, NotYet, PageHead, Spinner, Status, Table, useAction } from "../../console/ui";
import { useWorkspace } from "../Workspace";

/** Mốc camera (giai đoạn 2): cần API lưu ảnh mốc + dịch vụ trích đặc trưng */
export function LandmarksPage() {
    const { model } = useWorkspace();
    return (
        <div className="cb-main" style={{ maxWidth: 1000 }}>
            <PageHead title="Mốc nhận diện cho chỉ đường bằng camera" sub="Giai đoạn 2. Mỗi mốc là một cảnh dễ nhận (biển hiệu, mặt tiền quán, cột số) gắn với một nút lối đi; điện thoại khách so khớp cảnh để căn lại vị trí giữa hai lần quét QR." />
            <NotYet title="Chưa có API">Cần backend lưu ảnh mốc (7 góc × 2 ảnh), dịch vụ trích đặc trưng ảnh (DINOv2 / NetVLAD) và tải bộ đặc trưng xuống điện thoại. Hiện chỉ đường camera của khách dùng la bàn + đếm bước + mã QR — đã chạy được không cần mốc.</NotYet>
            <Card title="Ứng viên làm mốc (từ dữ liệu hiện có)">
                <p className="cb-muted" style={{ marginBottom: 10 }}>Các địa điểm có biển hiệu dễ thấy, nên chụp làm mốc khi tính năng sẵn sàng:</p>
                <Table head={["Địa điểm", "Loại", "Tầng"]} minWidth={480}>
                    {model.locations.filter(l => ["coffee", "restaurant", "shop", "information", "gate"].includes(l.type ?? "")).slice(0, 12).map(l => (
                        <tr key={l.id}><td>{l.name}</td><td>{model.typeOf(l.type).name}</td><td>{model.floorsById.get(l.floorId)?.buildingCode} · {model.floorsById.get(l.floorId)?.name}</td></tr>
                    ))}
                </Table>
            </Card>
        </div>
    );
}

/** Thống kê lượt dùng chưa có API; hiện số liệu dữ liệu của các địa điểm */
export function StatsPage() {
    const [venues, setVenues] = useState<VenueDto[] | null>(null);
    useEffect(() => {
        void venueApi.mine().then(setVenues).catch(() => setVenues([]));
    }, []);
    return (
        <>
            <PageHead title="Báo cáo và thống kê" sub="Dữ liệu ẩn danh của khách: lượt mở bản đồ, tìm kiếm, chỉ đường, tỉ lệ đến nơi." />
            <NotYet title="Chưa có API thống kê lượt dùng">Viewer chưa gửi sự kiện (mở bản đồ, tìm kiếm, chỉ đường, đến nơi, báo sai đường) về máy chủ. Khi có API sự kiện, trang này sẽ hiện biểu đồ theo ngày, từ khoá tìm không ra và các đoạn hay bị báo sai.</NotYet>
            {!venues ? <Spinner /> : (
                <>
                    <div className="cb-kpis">
                        <Kpi label="Địa điểm" value={venues.length} sub={`${venues.filter(v => v.status === "PUBLISHED").length} đã xuất bản`} />
                        <Kpi label="Toà nhà" value={venues.reduce((s, v) => s + (v.buildingCount ?? 0), 0)} />
                        <Kpi label="Tầng" value={venues.reduce((s, v) => s + (v.floorCount ?? 0), 0)} />
                        <Kpi label="Điểm quan tâm" value={venues.reduce((s, v) => s + (v.locationCount ?? 0), 0)} />
                    </div>
                    <Table head={["Địa điểm", "Trạng thái", "Toà nhà", "Tầng", "Điểm quan tâm"]}>
                        {venues.map(v => (
                            <tr key={v.id}>
                                <td>{v.name}</td>
                                <td>{v.status === "PUBLISHED" ? <Status kind="ok">Đã xuất bản</Status> : v.status === "HIDDEN" ? <Status kind="err">Bị ẩn</Status> : <Status kind="mut">Bản nháp</Status>}</td>
                                <td className="is-num">{v.buildingCount ?? 0}</td><td className="is-num">{v.floorCount ?? 0}</td><td className="is-num">{v.locationCount ?? 0}</td>
                            </tr>
                        ))}
                    </Table>
                </>
            )}
        </>
    );
}

export function AccountPage() {
    const { user, setUser, logout } = useAuth();
    const { busy, run } = useAction();
    const [name, setName] = useState(user?.fullName ?? "");
    const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
    const weak = pw.next.length > 0 && (pw.next.length < 8 || !/[a-zA-Z]/.test(pw.next) || !/\d/.test(pw.next));
    const mismatch = pw.confirm.length > 0 && pw.confirm !== pw.next;

    const saveName = async (e: FormEvent) => {
        e.preventDefault();
        const saved = await run(() => authApi.updateProfile(name.trim()), "Đã lưu");
        if (saved) setUser(saved);
    };
    const savePassword = async (e: FormEvent) => {
        e.preventDefault();
        if (weak || mismatch) return;
        if (await run(() => authApi.changePassword(pw.current, pw.next), "Đã đổi mật khẩu") !== null) setPw({ current: "", next: "", confirm: "" });
    };

    if (!user) return null;
    return (
        <div className="cb-stack" style={{ maxWidth: 820, gap: 20 }}>
            <PageHead title="Tài khoản" sub={<>{user.role === "SYSTEM_ADMIN" ? "Quản trị hệ thống" : "Quản trị địa điểm"} · {user.status === "ACTIVE" ? <Status kind="ok">Hoạt động</Status> : <Status kind="warn">{user.status}</Status>}{user.createdAt && ` · tham gia ${new Date(user.createdAt).toLocaleDateString("vi-VN")}`}</>}
                actions={<Button onClick={logout}>Đăng xuất</Button>} />
            <Card title="Thông tin cá nhân">
                <form className="cb-form" onSubmit={saveName}>
                    <div className="cb-grid-2">
                        <Field label="Họ và tên" required value={name} onChange={e => setName(e.target.value)} />
                        <Field label="Email đăng nhập" value={user.email} disabled help="Đổi email chưa hỗ trợ." />
                    </div>
                    <div className="cb-actions"><Button type="submit" variant="primary" busy={busy} disabled={!name.trim() || name.trim() === user.fullName}>Lưu thay đổi</Button></div>
                </form>
            </Card>
            <Card title="Đổi mật khẩu">
                <form className="cb-form" onSubmit={savePassword}>
                    <div className="cb-grid-3">
                        <Field label="Mật khẩu hiện tại" type="password" autoComplete="current-password" required value={pw.current} onChange={e => setPw(p => ({ ...p, current: e.target.value }))} />
                        <Field label="Mật khẩu mới" type="password" autoComplete="new-password" required value={pw.next} onChange={e => setPw(p => ({ ...p, next: e.target.value }))} error={weak ? "≥ 8 ký tự, có chữ và số" : null} />
                        <Field label="Nhập lại" type="password" autoComplete="new-password" required value={pw.confirm} onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))} error={mismatch ? "Chưa khớp" : null} />
                    </div>
                    <div className="cb-actions"><Button type="submit" variant="primary" busy={busy} disabled={weak || mismatch || !pw.current}>Đổi mật khẩu</Button></div>
                </form>
            </Card>
            <Card title="Cộng tác viên & chuyển quyền">
                <p className="cb-muted">Mỗi địa điểm có một chủ sở hữu. Cần chuyển địa điểm cho người khác thì liên hệ quản trị hệ thống (trang Kiểm duyệt có chức năng đổi chủ sở hữu).</p>
            </Card>
        </div>
    );
}
