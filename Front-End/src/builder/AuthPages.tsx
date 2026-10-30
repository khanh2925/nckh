import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Check, CircleAlert, CircleDot, Clock, Eye, EyeOff, Info, LoaderCircle, Lock, RefreshCw, type LucideIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authApi } from "../console/api";
import { useAuth } from "../console/auth";
import { ApiError } from "../console/http";
import { BrandMark } from "../console/Shell";
import AuthArt from "./AuthArt";

// Đăng nhập, đăng ký, quên mật khẩu, bảo trì: theo khối "login" của shadcn/ui.
// Cột trái: logo + form (tối đa max-w-sm, căn giữa). Cột phải (màn rộng): mặt bằng minh hoạ.

export function AuthFrame({ children }: { children: ReactNode }) {
    return (
        <div className="grid min-h-svh bg-background lg:grid-cols-2">
            <div className="flex flex-col gap-4 p-6 md:p-10">
                <div className="flex justify-center md:justify-start">
                    <Link to="/" className="flex items-center gap-2 text-sm font-medium" aria-label="Indoor Map, mở bản đồ cho khách">
                        <BrandMark />Indoor Map
                    </Link>
                </div>
                <div className="flex flex-1 items-center justify-center">
                    <div className="w-full max-w-sm">{children}</div>
                </div>
            </div>
            <div className="relative hidden overflow-hidden border-l bg-muted lg:block" aria-hidden="true">
                <div className="absolute inset-0"><AuthArt /></div>
            </div>
        </div>
    );
}

export function AuthHead({ id, title, sub }: { id: string; title: string; sub?: ReactNode }) {
    return (
        <div className="flex flex-col items-center gap-1 text-center">
            <h1 id={id} className="text-lg font-semibold">{title}</h1>
            {sub && <p className="text-sm text-balance text-muted-foreground">{sub}</p>}
        </div>
    );
}

type Tone = "danger" | "warn" | "";
export function AuthNote({ tone, icon: Icon, title, children }: { tone: Tone; icon: LucideIcon; title: string; children?: ReactNode }) {
    return (
        <Alert variant={tone === "danger" ? "destructive" : "default"} role={tone === "danger" ? "alert" : "status"}>
            <Icon className={tone === "warn" ? "text-warning" : undefined} />
            <AlertTitle>{title}</AlertTitle>
            {children && <AlertDescription>{children}</AlertDescription>}
        </Alert>
    );
}

function SubmitButton({ busy, disabled, children }: { busy?: boolean; disabled?: boolean; children: ReactNode }) {
    return (
        <Button type="submit" className="w-full" disabled={disabled || busy} aria-busy={busy || undefined}>
            {busy && <LoaderCircle className="animate-spin" aria-hidden="true" />}{children}
        </Button>
    );
}

function PasswordInput({ id, value, onChange, autoComplete, invalid, describedBy }: {
    id: string; value: string; onChange: (v: string) => void; autoComplete: string; invalid?: boolean; describedBy?: string;
}) {
    const [show, setShow] = useState(false);
    const label = show ? "Ẩn mật khẩu" : "Hiện mật khẩu";
    return (
        <div className="relative">
            <Input id={id} type={show ? "text" : "password"} autoComplete={autoComplete} required value={value} maxLength={100} className="pr-10"
                aria-invalid={invalid || undefined} aria-describedby={describedBy} onChange={e => onChange(e.target.value)} />
            <Button type="button" variant="ghost" size="icon" className="absolute top-1/2 right-0.5 size-8 -translate-y-1/2 text-muted-foreground"
                aria-label={label} title={label} aria-pressed={show} aria-controls={id} onClick={() => setShow(s => !s)}>
                {show ? <EyeOff /> : <Eye />}
            </Button>
        </div>
    );
}

function Alt({ text, to, link }: { text: string; to: string; link: string }) {
    return <p className="text-center text-sm text-muted-foreground">{text} <Link to={to} className="font-medium text-foreground underline underline-offset-4">{link}</Link></p>;
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
        case "wrong": return <AuthNote tone="danger" icon={CircleAlert} title="Email hoặc mật khẩu chưa đúng" />;
        case "pending": return <AuthNote tone="warn" icon={Clock} title="Tài khoản đang chờ duyệt">Bạn đăng nhập được sau khi quản trị hệ thống duyệt.</AuthNote>;
        case "locked": return <AuthNote tone="danger" icon={Lock} title="Tài khoản đã bị khoá">Liên hệ quản trị hệ thống để mở lại.</AuthNote>;
        case "throttle": return <AuthNote tone="warn" icon={Clock} title="Tạm khoá đăng nhập">{error.message}</AuthNote>;
        default: return <AuthNote tone="danger" icon={CircleAlert} title="Chưa đăng nhập được">{error.message}</AuthNote>;
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
            <form onSubmit={submit} aria-labelledby="login-title" className="flex flex-col gap-6" noValidate>
                <AuthHead id="login-title" title="Đăng nhập" />
                <div aria-live="assertive" className="grid gap-2 empty:hidden">
                    {error ? <LoginAlert error={error} /> : (
                        <>
                            {params.get("registered") && <AuthNote tone="warn" icon={Clock} title="Tài khoản đang chờ duyệt">Đã gửi đăng ký. Bạn đăng nhập được sau khi quản trị hệ thống duyệt.</AuthNote>}
                            {params.get("expired") && <AuthNote tone="" icon={Info} title="Phiên đăng nhập đã kết thúc">Đăng nhập lại để tiếp tục.</AuthNote>}
                        </>
                    )}
                </div>
                <div className="grid gap-6">
                    <div className="grid gap-2">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" type="email" inputMode="email" spellCheck={false} autoComplete="username" required value={email}
                            placeholder="ten@donvi.vn" aria-invalid={emailBad || undefined} aria-describedby={emailBad ? "email-err" : undefined}
                            onChange={e => setEmail(e.target.value)} onBlur={() => setEmailTouched(true)} />
                        {emailBad && <p id="email-err" className="flex items-center gap-1.5 text-xs text-destructive"><CircleAlert className="size-3.5" aria-hidden="true" />Email chưa đúng định dạng, ví dụ ten@donvi.vn</p>}
                    </div>
                    <div className="grid gap-2">
                        <div className="flex items-center">
                            <Label htmlFor="pw">Mật khẩu</Label>
                            <Link to="/forgot" className="ml-auto text-sm underline-offset-4 hover:underline">Quên mật khẩu?</Link>
                        </div>
                        <PasswordInput id="pw" value={password} onChange={setPassword} autoComplete="current-password" invalid={error?.kind === "wrong"} />
                    </div>
                    <SubmitButton busy={busy} disabled={!email.trim() || !password}>Đăng nhập</SubmitButton>
                </div>
                <Alt text="Chưa có tài khoản?" to="/register" link="Đăng ký" />
            </form>
        </AuthFrame>
    );
}

// ---------------------------------------------------------------- đăng ký
function Rules({ id, items }: { id: string; items: [string, boolean][] }) {
    return (
        <ul id={id} aria-live="polite" className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {items.map(([label, ok]) => (
                <li key={label} className={`flex items-center gap-1.5 ${ok ? "text-success" : "text-muted-foreground"}`}>
                    {ok ? <Check className="size-3.5" aria-hidden="true" /> : <CircleDot className="size-3.5" aria-hidden="true" />}
                    {label}<span className="sr-only">{ok ? ", đạt" : ", chưa đạt"}</span>
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
            <form onSubmit={submit} aria-labelledby="reg-title" className="flex flex-col gap-6">
                <AuthHead id="reg-title" title="Tạo tài khoản" sub="Quản trị hệ thống duyệt xong mới đăng nhập được." />
                {error && <AuthNote tone="danger" icon={CircleAlert} title="Chưa gửi được đăng ký">{error}</AuthNote>}
                <div className="grid gap-6">
                    <div className="grid gap-2">
                        <Label htmlFor="name">Họ và tên</Label>
                        <Input id="name" type="text" autoComplete="name" maxLength={120} required value={form.fullName} onChange={set("fullName")} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" type="email" inputMode="email" spellCheck={false} autoComplete="username" required value={form.email}
                            placeholder="ten@donvi.vn" onChange={set("email")} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="pw">Mật khẩu</Label>
                        <PasswordInput id="pw" value={form.password} onChange={setPw("password")} autoComplete="new-password" describedBy="pw-rules" />
                        <Rules id="pw-rules" items={[["Ít nhất 8 ký tự", longEnough], ["Có chữ và số", mixed]]} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="pw2">Nhập lại mật khẩu</Label>
                        <Input id="pw2" type="password" autoComplete="new-password" required value={form.confirm} onChange={set("confirm")}
                            aria-invalid={(form.confirm.length > 0 && !matches) || undefined} aria-describedby="pw2-ok" />
                        <Rules id="pw2-ok" items={[["Khớp với mật khẩu", matches]]} />
                    </div>
                    <div className="flex items-start gap-3">
                        <Checkbox id="agree" required checked={agree} onCheckedChange={v => setAgree(v === true)} />
                        <Label htmlFor="agree" className="leading-snug font-normal">Tôi có quyền công bố sơ đồ mặt bằng của địa điểm sẽ dựng</Label>
                    </div>
                    <SubmitButton busy={busy} disabled={!valid}>Tạo tài khoản</SubmitButton>
                </div>
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
            <form onSubmit={submit} aria-labelledby="fg-title" className="flex flex-col gap-6">
                <AuthHead id="fg-title" title="Quên mật khẩu" sub="Nhập email đăng nhập để nhận link đặt lại." />
                <div className="grid gap-6">
                    <div className="grid gap-2">
                        <Label htmlFor="fg-email">Email</Label>
                        <Input id="fg-email" type="email" inputMode="email" spellCheck={false} autoComplete="username" required value={email}
                            placeholder="ten@donvi.vn" onChange={e => { setEmail(e.target.value); setAsked(false); }} />
                    </div>
                    {asked && <AuthNote tone="warn" icon={Clock} title="Chưa khả dụng">Liên hệ quản trị hệ thống để đặt lại mật khẩu.</AuthNote>}
                    <SubmitButton disabled={!EMAIL_RE.test(email.trim())}>Gửi link đặt lại</SubmitButton>
                </div>
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
            <div role="alert" aria-labelledby="e-title" className="flex flex-col gap-6">
                <AuthHead id="e-title" title="Máy chủ đang gặp sự cố" sub="Chưa kết nối được. Thử lại sau ít phút." />
                <ul className="divide-y rounded-xl border text-sm">
                    <li className="flex items-center justify-between gap-4 px-4 py-3">
                        <span className="min-w-0">Builder và quản trị</span>
                        <Badge className="gap-1 bg-warning/10 text-warning"><Clock />Tạm dừng</Badge>
                    </li>
                    <li className="flex items-center justify-between gap-4 px-4 py-3">
                        <span className="min-w-0">Bản đồ cho khách</span>
                        <Link to="/" className="font-medium underline underline-offset-4">Mở bản đồ</Link>
                    </li>
                </ul>
                <Button asChild className="w-full"><Link to={back}><RefreshCw />Thử lại</Link></Button>
            </div>
        </AuthFrame>
    );
}
