import { useEffect, useRef, useState } from "react";
import { login } from "../api/auth";

// Admin login form.
// asPage: the /admin login page (full screen, link back to the map).
// Otherwise a box on top of the admin map, shown again when the login has expired; notice says why.
function LoginDialog({ notice, onLoggedIn, onCancel, asPage = false }) {
    const [username, setUsername] = useState("admin");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isSending, setIsSending] = useState(false);
    const passwordRef = useRef(null);

    // The username is usually "admin" already, so start in the password box
    useEffect(() => {
        passwordRef.current?.focus();
    }, []);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setIsSending(true);
        setError("");
        try {
            onLoggedIn(await login(username.trim(), password));
        } catch (err) {
            setError(err.message);
            setPassword("");
            passwordRef.current?.focus();
        } finally {
            setIsSending(false);
        }
    };

    const close = () => onCancel?.();

    return (
        // Clicking the dark background closes the box, clicks inside the card don't
        <div className={asPage ? "login-page" : "login-backdrop"} onMouseDown={(event) => !asPage && event.target === event.currentTarget && close()}>
            <form className="login-card" onSubmit={handleSubmit} onKeyDown={(event) => event.key === "Escape" && close()}
                  role={asPage ? undefined : "dialog"} aria-modal={asPage ? undefined : "true"} aria-labelledby="login-title">
                <div className="d-flex align-items-center gap-2 mb-3">
                    <span className="terminal-badge">SGN</span>
                    <div className="flex-grow-1">
                        <h1 id="login-title" className="h6 mb-0">Đăng nhập quản trị</h1>
                        <small className="text-muted">Bản đồ sân bay Tân Sơn Nhất</small>
                    </div>
                    {!asPage && (
                        <button type="button" className="btn btn-light btn-sm rounded-circle" onClick={close} aria-label="Đóng">
                            <i className="bi bi-x-lg" />
                        </button>
                    )}
                </div>

                {notice && <div className="alert alert-warning py-2 px-2 small" role="status">{notice}</div>}

                <label className="form-label small fw-semibold" htmlFor="login-username">Tên đăng nhập</label>
                <input id="login-username" className="form-control mb-2" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required />

                <label className="form-label small fw-semibold" htmlFor="login-password">Mật khẩu</label>
                <input id="login-password" ref={passwordRef} type="password" className="form-control" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />

                {error && <p className="small text-danger mt-2 mb-0" role="alert">{error}</p>}

                <button type="submit" className="btn btn-danger w-100 mt-3" disabled={isSending || !password}>
                    {isSending ? "Đang đăng nhập…" : "Đăng nhập"}
                </button>

                {asPage && <a className="d-block text-center small mt-3" href="/"><i className="bi bi-arrow-left me-1" />Về bản đồ</a>}
            </form>
        </div>
    );
}

export default LoginDialog;
