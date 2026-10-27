import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { authApi } from "../console/api";
import { useAuth } from "../console/auth";
import { Button, Field } from "../console/ui";

function Hero() {
    return (
        <section className="cb-auth-hero">
            <div className="cb-brand" style={{ color: "#fff" }}>Indoor Map · Builder</div>
            <h1>Tự dựng bản đồ trong nhà và chỉ đường cho địa điểm của bạn.</h1>
            <p>Tải bản vẽ mặt bằng, chấm điểm quan tâm, vẽ lối đi — khách tham quan quét mã QR là có bản đồ và chỉ đường từng bước trên điện thoại.</p>
            <ol className="cb-auth-steps">
                <li><span>01</span><div><b>Tải mặt bằng và căn chỉnh lên bản đồ</b><small>2 cặp điểm mốc là đủ; hệ thống tự tính góc xoay và tỉ lệ.</small></div></li>
                <li><span>02</span><div><b>Chấm điểm quan tâm, vẽ vùng và lối đi</b><small>Nhập hàng loạt từ CSV/GeoJSON, kiểm tra điểm nào chưa tới được.</small></div></li>
                <li><span>03</span><div><b>Thử chỉ đường, in mã QR, xuất bản</b><small>Bản đồ hiện ngay trên điện thoại khách tại /v/&lt;tên-địa-điểm&gt;.</small></div></li>
            </ol>
        </section>
    );
}

export function LoginPage() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [show, setShow] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
            const user = await login(email.trim(), password);
            const next = params.get("next");
            navigate(next && next.startsWith("/") ? next : user.role === "SYSTEM_ADMIN" ? "/admin" : "/builder", { replace: true });
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="cb-root cb-auth">
            <Hero />
            <section className="cb-auth-form">
                <form className="cb-form" onSubmit={submit}>
                    <div><h2 className="cb-h1">Đăng nhập</h2><p className="cb-muted" style={{ marginTop: 6 }}>Dành cho quản trị địa điểm và quản trị hệ thống.</p></div>
                    {params.get("registered") && <div className="cb-alert is-ok"><i className="bi bi-check-lg" aria-hidden="true" /><span>Đã gửi đăng ký. Bạn đăng nhập được sau khi quản trị hệ thống duyệt.</span></div>}
                    <Field label="Email" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} />
                    <div className="cb-field">
                        <label htmlFor="pw">Mật khẩu</label>
                        <div style={{ position: "relative" }}>
                            <input id="pw" className="cb-input" type={show ? "text" : "password"} autoComplete="current-password" required value={password}
                                onChange={e => setPassword(e.target.value)} style={{ paddingRight: 64 }} />
                            <button type="button" className="cb-btn cb-btn-ghost is-small" style={{ position: "absolute", right: 3, top: 3 }} onClick={() => setShow(s => !s)}>{show ? "Ẩn" : "Hiện"}</button>
                        </div>
                    </div>
                    {error && <div className="cb-alert is-err" role="alert"><i className="bi bi-x-circle" aria-hidden="true" /><span>{error}</span></div>}
                    <Button type="submit" variant="primary" busy={busy}>Đăng nhập</Button>
                    <div className="cb-alert is-warn"><i className="bi bi-exclamation-triangle" aria-hidden="true" /><span>Sai mật khẩu nhiều lần liên tiếp sẽ tạm khoá đăng nhập email này trong ít phút.</span></div>
                    <p className="cb-muted" style={{ textAlign: "center" }}>Chưa có tài khoản? <Link to="/register">Đăng ký làm quản trị địa điểm</Link></p>
                    <p className="cb-muted" style={{ textAlign: "center", fontSize: 12 }}>Khách tham quan không cần tài khoản — <Link to="/">mở bản đồ</Link></p>
                </form>
            </section>
        </div>
    );
}

export function RegisterPage() {
    const navigate = useNavigate();
    const [form, setForm] = useState({ fullName: "", email: "", password: "", confirm: "" });
    const [agree, setAgree] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm(f => ({ ...f, [key]: e.target.value }));
    const weak = form.password.length > 0 && (form.password.length < 8 || !/[a-zA-Z]/.test(form.password) || !/\d/.test(form.password));
    const mismatch = form.confirm.length > 0 && form.confirm !== form.password;

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        if (weak || mismatch || !agree) return;
        setBusy(true);
        setError(null);
        try {
            await authApi.register(form.email.trim(), form.password, form.fullName.trim());
            navigate("/login?registered=1", { replace: true });
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="cb-root cb-auth">
            <Hero />
            <section className="cb-auth-form">
                <form className="cb-form" onSubmit={submit}>
                    <div><h2 className="cb-h1">Đăng ký quản trị địa điểm</h2><p className="cb-muted" style={{ marginTop: 6 }}>Tài khoản mới ở trạng thái <b>Chờ duyệt</b>; quản trị hệ thống duyệt xong bạn mới đăng nhập được.</p></div>
                    <Field label="Họ và tên" required autoComplete="name" value={form.fullName} onChange={set("fullName")} />
                    <Field label="Email đăng nhập" type="email" required autoComplete="email" value={form.email} onChange={set("email")} help="Dùng email của tổ chức nếu có — giúp duyệt nhanh hơn." />
                    <div className="cb-grid-2">
                        <Field label="Mật khẩu" type="password" required autoComplete="new-password" value={form.password} onChange={set("password")}
                            error={weak ? "Tối thiểu 8 ký tự, có chữ và số" : null} help="Tối thiểu 8 ký tự, có chữ và số." />
                        <Field label="Nhập lại mật khẩu" type="password" required autoComplete="new-password" value={form.confirm} onChange={set("confirm")} error={mismatch ? "Chưa khớp" : null} />
                    </div>
                    <label className="cb-check"><input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} /><span>Tôi có quyền công bố sơ đồ mặt bằng của địa điểm sẽ dựng.</span></label>
                    {error && <div className="cb-alert is-err" role="alert"><i className="bi bi-x-circle" aria-hidden="true" /><span>{error}</span></div>}
                    <Button type="submit" variant="primary" busy={busy} disabled={weak || mismatch || !agree}>Gửi đăng ký</Button>
                    <p className="cb-muted" style={{ textAlign: "center" }}>Đã có tài khoản? <Link to="/login">Đăng nhập</Link></p>
                </form>
            </section>
        </div>
    );
}
