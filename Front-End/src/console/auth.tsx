import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import type { Role, UserDto } from "@indoor-map/core";
import { authApi } from "./api";
import { getToken, setToken, setUnauthorizedHandler } from "./http";

interface AuthState {
    user: UserDto | null;
    /** Đang kiểm tra token đã lưu */
    checking: boolean;
    login(email: string, password: string): Promise<UserDto>;
    logout(): void;
    setUser(user: UserDto): void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<UserDto | null>(null);
    const [checking, setChecking] = useState(() => Boolean(getToken()));

    const logout = useCallback(() => {
        setToken(null);
        setUser(null);
    }, []);

    useEffect(() => {
        setUnauthorizedHandler(logout);
        if (getToken()) {
            authApi.me()
                .then(setUser)
                .catch(() => setToken(null))
                .finally(() => setChecking(false));
        }
        return () => setUnauthorizedHandler(null);
    }, [logout]);

    const login = useCallback(async (email: string, password: string) => {
        const result = await authApi.login(email, password);
        setToken(result.token);
        setUser(result.user);
        return result.user;
    }, []);

    const value = useMemo(() => ({ user, checking, login, logout, setUser }), [user, checking, login, logout]);
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
    const value = useContext(AuthContext);
    if (!value) throw new Error("useAuth() phải nằm trong <AuthProvider>");
    return value;
}

/** Chỉ cho vào khi đã đăng nhập (và đúng vai trò, nếu có yêu cầu) */
export function RequireAuth({ role, children }: { role?: Role; children: ReactNode }) {
    const { user, checking } = useAuth();
    const location = useLocation();
    if (checking) return <div className="cb-center"><div className="cb-spinner" aria-label="Đang kiểm tra đăng nhập" /></div>;
    if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
    if (role && user.role !== role) {
        return (
            <div className="cb-center">
                <div className="cb-card cb-pad" style={{ maxWidth: 420 }}>
                    <h1 className="cb-h2">Không có quyền</h1>
                    <p className="cb-muted">Trang này chỉ dành cho {role === "SYSTEM_ADMIN" ? "quản trị hệ thống" : "quản trị địa điểm"}.</p>
                </div>
            </div>
        );
    }
    return <>{children}</>;
}
