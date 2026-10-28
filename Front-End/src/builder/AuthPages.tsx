import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { authApi } from "../console/api";
import { useAuth } from "../console/auth";
import { ApiError } from "../console/http";
import Lc, { type LucideName } from "../design/Lc";
import AuthArt from "./AuthArt";
import "./pages/global.css";

// Đăng nhập, đăng ký, quên mật khẩu, bảo trì: cột trái form (tối đa 400), cột phải mặt bằng minh hoạ.

export function AuthFrame({ children }: { children: ReactNode }) {
    return (
        <div className="cb-auth">
            <section className="cb-auth-form">
                <div className="cs-brand">
                    <Link to="/" className="cs-logo" aria-label="Indoor Map, mở bản đồ cho khách"><Lc name="map-pin" size={18} stroke={2.2} /></Link>
                    <span>Indoor Map</span>
                </div>
                <div className="cb-auth-body"><div className="k-stack">{children}</div></div>
            </section>
            <aside className="cb-auth-art" aria-hidden="true"><AuthArt /></aside>
        </div>
    );
}

export function AuthHead({ id, title, sub }: { id: string; title: string; sub?: ReactNode }) {
    return <div><h1 id={id} className="k24">{title}</h1>{sub && <p className="k14 k-m" style={{ marginTop: 8 }}>{sub}</p>}</div>;
}

type Tone = "danger" | "warn" | "";
export function AuthNote({ tone, icon, title, children }: { tone: Tone; icon: LucideName; title: string; children?: ReactNode }) {
    const color = tone === "danger" ? "var(--danger)" : tone === "warn" ? "var(--warn)" : "var(--muted)";
    return (
        <div className="k-note" role={tone === "danger" ? "alert" : "status"}>
            <Lc name={icon} size={16} color={color} />
            <div><div className="k-b">{title}</div>{children && <div>{children}</div>}</div>
        </div>
    );
}

function SubmitButton({ busy, disabled, children }: { busy?: boolean; disabled?: boolean; children: ReactNode }) {
    return (
        <button type="submit" className="k-btn p kg-full" disabled={disabled || busy} aria-busy={busy || undefined}>
            {busy && <span className="cb-spinner is-inline" aria-hidden="true" />}{children}
        </button>
    );
}

function PasswordInput({ id, value, onChange, autoComplete, invalid, describedBy }: {
    id: string; value: string; onChange: (v: string) => void; autoComplete: string; invalid?: boolean; describedBy?: string;
}) {
    const [show, setShow] = useState(false);
    return (
        <div className="kg-pw">
            <input id={id} className="k-input" type={show ? "text" : "password"} autoComplete={autoComplete} required value={value} maxLength={100}
                aria-invalid={invalid || undefined} aria-describedby={describedBy} onChange={e => onChange(e.target.value)} />
            <button type="button" className="k-ib sm t" aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"} title={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                aria-pressed={show} aria-controls={id} onClick={() => setShow(s => !s)}>
                <Lc name={show ? "eye-off" : "eye"} size={16} />
            </button>
        </div>
    );
}

function Alt({ text, to, link }: { text: string; to: string; link: string }) {
    return <p className="k14 k-m kg-center">{text} <Link to={to} className="k-b kg-under" style={{ color: "var(--ink)" }}>{link}</Link></p>;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------------------------------------------------------------- đăng nhập
type LoginError = { kind: "wrong" | "pending" | "locked" | "throttle" | "other"; message: string };

function classify(err: unknown): LoginError {
    const message = (err as Error)?.message || "Có lỗi xảy ra";
    if (err instanceof ApiError) {
        if (err.status === 401) return { kind: "wrong", message };
        if (err.status === 429) return { kind: "throttle", message };
        if (err.status === 403 && /duyệt/i.test(message)) return { kind: "pending", message };
        if (err.status === 403 && /khoá/i.test(message)) return { kind: "locked", message };
    }
    return { kind: "other", message };
}

function LoginAlert({ error }: { error: LoginError }) {
    switch (error.kind) {
        case "wrong": return <AuthNote tone="danger" icon="circle-alert" title="Email hoặc mật khẩu chưa đúng" />;
        case "pending": return <AuthNote tone="warn" icon="clock" title="Tài khoản đang chờ duyệt">Bạn đăng nhập được sau khi quản trị hệ thống duyệt.</AuthNote>;
        case "locked": return <AuthNote tone="danger" icon="lock" title="Tài khoản đã bị khoá">Liên hệ quản trị hệ thống để mở lại.</AuthNote>;
        case "throttle": return <AuthNote tone="warn" icon="clock" title="Tạm khoá đăng nhập">{error.message}</AuthNote>;
        default: return <AuthNote tone="danger" icon="circle-alert" title="Chưa đăng nhập được">{error.message}</AuthNote>;
    }
}

export function LoginPage() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [emailTouched, setEmailTouched] = useState(false);
    const [error, setError] = useState<LoginError | null>(null);
    const [busy, setBusy] = useState(false);
    const emailBad = emailTouched && email.trim().length > 0 && !EMAIL_RE.test(email.trim());

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        if (!EMAIL_RE.test(email.trim())) {
            setEmailTouched(true);
            return;
        }
        setBusy(true);
        setError(null);
        try {
            const user = await login(email.trim(), password);
            const next = params.get("next");
            navigate(next && next.startsWith("/") && !next.startsWith("//") ? next : user.role === "SYSTEM_ADMIN" ? "/admin" : "/builder", { replace: true });
        } catch (err) {
            setError(classify(err));
        } finally {
            setBusy(false);
        }
    };

    return (
        <AuthFrame>
            <form onSubmit={submit} aria-labelledby="login-title" className="k-stack" noValidate>
                <AuthHead id="login-title" title="Đăng nhập" />
                <div aria-live="assertive" className="k-stack" style={{ gap: 8 }}>
                    {error ? <LoginAlert error={error} /> : (
                        <>
                            {params.get("registered") && <AuthNote tone="warn" icon="clock" title="Tài khoản đang chờ duyệt">Đã gửi đăng ký. Bạn đăng nhập được sau khi quản trị hệ thống duyệt.</AuthNote>}
                            {params.get("expired") && <AuthNote tone="" icon="info" title="Phiên đăng nhập đã kết thúc">Đăng nhập lại để tiếp tục.</AuthNote>}
                        </>
                    )}
                </div>
                <div className="k-field">
                    <label htmlFor="email">Email</label>
                    <input id="email" className="k-input" type="email" inputMode="email" spellCheck={false} autoComplete="username" required value={email}
                        placeholder="ten@donvi.vn" aria-invalid={emailBad || undefined} aria-describedby={emailBad ? "email-err" : undefined}
                        onChange={e => setEmail(e.target.value)} onBlur={() => setEmailTouched(true)} />
                    {emailBad && <span id="email-err" className="k-line k12 k-danger"><Lc name="circle-alert" size={16} />Email chưa đúng định dạng, ví dụ ten@donvi.vn</span>}
                </div>
                <div className="k-field">
                    <div className="k-line">
                        <label htmlFor="pw" className="k-label">Mật khẩu</label>
                        <Link to="/forgot" className="k12 k-b" style={{ marginLeft: "auto" }}>Quên mật khẩu?</Link>
                    </div>
                    <PasswordInput id="pw" value={password} onChange={setPassword} autoComplete="current-password" invalid={error?.kind === "wrong"} />
                </div>
                <SubmitButton busy={busy} disabled={!email.trim() || !password}>Đăng nhập</SubmitButton>
                <Alt text="Chưa có tài khoản?" to="/register" link="Đăng ký" />
            </form>
        </AuthFrame>
    );
}

// ---------------------------------------------------------------- đăng ký
function Rules({ id, items, column }: { id: string; items: [string, boolean][]; column?: boolean }) {
    return (
        <ul id={id} aria-live="polite" className={`kg-rules k12${column ? " is-col" : ""}`}>
            {items.map(([label, ok]) => (
                <li key={label} className={ok ? "k-ok" : "k-m"}>
                    <Lc name={ok ? "check" : "circle-dot"} size={14} />{label}<span className="sr-only">{ok ? ", đạt" : ", chưa đạt"}</span>
                </li>
            ))}
        </ul>
    );
}

export function RegisterPage() {
    const navigate = useNavigate();
    const [form, setForm] = useState({ fullName: "", email: "", password: "", confirm: "" });
    const [agree, setAgree] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm(f => ({ ...f, [key]: e.target.value }));
    const setPw = (key: "password" | "confirm") => (value: string) => setForm(f => ({ ...f, [key]: value }));
    const longEnough = form.password.length >= 8;
    const mixed = /[a-zA-Z]/.test(form.password) && /\d/.test(form.password);
    const matches = form.confirm.length > 0 && form.confirm === form.password;
    const valid = form.fullName.trim() && EMAIL_RE.test(form.email.trim()) && longEnough && mixed && matches && agree;

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        if (!valid) return;
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
        <AuthFrame>
            <form onSubmit={submit} aria-labelledby="reg-title" className="k-stack">
                <AuthHead id="reg-title" title="Tạo tài khoản" sub="Quản trị hệ thống duyệt xong mới đăng nhập được." />
                {error && <AuthNote tone="danger" icon="circle-alert" title="Chưa gửi được đăng ký">{error}</AuthNote>}
                <div className="k-field">
                    <label htmlFor="name">Họ và tên</label>
                    <input id="name" className="k-input" type="text" autoComplete="name" maxLength={120} required value={form.fullName} onChange={set("fullName")} />
                </div>
                <div className="k-field">
                    <label htmlFor="email">Email</label>
                    <input id="email" className="k-input" type="email" inputMode="email" spellCheck={false} autoComplete="username" required value={form.email} onChange={set("email")} />
                </div>
                <div className="k-field">
                    <label htmlFor="pw">Mật khẩu</label>
                    <PasswordInput id="pw" value={form.password} onChange={setPw("password")} autoComplete="new-password" describedBy="pw-rules" />
                    <Rules id="pw-rules" items={[["Ít nhất 8 ký tự", longEnough], ["Có chữ và số", mixed]]} />
                </div>
                <div className="k-field">
                    <label htmlFor="pw2">Nhập lại mật khẩu</label>
                    <input id="pw2" className="k-input" type="password" autoComplete="new-password" required value={form.confirm} onChange={set("confirm")}
                        aria-invalid={(form.confirm.length > 0 && !matches) || undefined} aria-describedby="pw2-ok" />
                    <Rules id="pw2-ok" column items={[["Khớp với mật khẩu", matches]]} />
                </div>
                <label className="kg-agree k14">
                    <input type="checkbox" className="k-check" required checked={agree} onChange={e => setAgree(e.target.checked)} />
                    <span>Tôi có quyền công bố sơ đồ mặt bằng của địa điểm sẽ dựng</span>
                </label>
                <SubmitButton busy={busy} disabled={!valid}>Tạo tài khoản</SubmitButton>
                <Alt text="Đã có tài khoản?" to="/login" link="Đăng nhập" />
            </form>
        </AuthFrame>
    );
}

// ---------------------------------------------------------------- quên mật khẩu (backend chưa có API đặt lại)
export function ForgotPage() {
    const [email, setEmail] = useState("");
    const [asked, setAsked] = useState(false);
    const submit = (e: FormEvent) => {
        e.preventDefault();
        if (EMAIL_RE.test(email.trim())) setAsked(true);
    };
    return (
        <AuthFrame>
            <form onSubmit={submit} aria-labelledby="fg-title" className="k-stack" style={{ gap: 24 }}>
                <AuthHead id="fg-title" title="Quên mật khẩu" sub="Nhập email đăng nhập để nhận link đặt lại." />
                <div className="k-field">
                    <label htmlFor="fg-email">Email</label>
                    <input id="fg-email" className="k-input" type="email" inputMode="email" spellCheck={false} autoComplete="username" required value={email}
                        placeholder="ten@donvi.vn" onChange={e => { setEmail(e.target.value); setAsked(false); }} />
                </div>
                {asked && <AuthNote tone="warn" icon="clock" title="Chưa khả dụng">Liên hệ quản trị hệ thống để đặt lại mật khẩu.</AuthNote>}
                <SubmitButton disabled={!EMAIL_RE.test(email.trim())}>Gửi link đặt lại</SubmitButton>
                <Alt text="Nhớ ra rồi?" to="/login" link="Đăng nhập" />
            </form>
        </AuthFrame>
    );
}

// ---------------------------------------------------------------- bảo trì / không kết nối được máy chủ
export function MaintenancePage() {
    const [params] = useSearchParams();
    const next = params.get("next");
    const back = next && next.startsWith("/") && !next.startsWith("//") ? next : "/builder";
    return (
        <AuthFrame>
            <div role="alert" aria-labelledby="e-title" className="k-stack" style={{ gap: 24 }}>
                <AuthHead id="e-title" title="Máy chủ đang gặp sự cố" sub="Chưa kết nối được. Thử lại sau ít phút." />
                <ul className="k-card tight" style={{ listStyle: "none", margin: 0, gap: 0, paddingTop: 4, paddingBottom: 4 }}>
                    <li className="k-row k14"><span style={{ flex: 1, minWidth: 0 }}>Builder và quản trị</span><span className="k-badge k-warn"><Lc name="clock" size={14} />Tạm dừng</span></li>
                    <li className="k-row k14"><span style={{ flex: 1, minWidth: 0 }}>Bản đồ cho khách</span><Link to="/" className="k12 k-b kg-under">Mở bản đồ</Link></li>
                </ul>
                <Link to={back} className="k-btn p kg-full"><Lc name="refresh-cw" size={16} />Thử lại</Link>
            </div>
        </AuthFrame>
    );
}
