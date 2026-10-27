// Gọi API có đăng nhập (Builder, Admin). Token JWT lưu trong localStorage; 401 thì xoá token và về trang đăng nhập.
const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");
const TOKEN_KEY = "indoor-map.token";

export class ApiError extends Error {
    constructor(public readonly status: number, message: string) {
        super(message);
    }
}

export function getToken(): string | null {
    try {
        return localStorage.getItem(TOKEN_KEY);
    } catch {
        return null;
    }
}

export function setToken(token: string | null): void {
    try {
        if (token) localStorage.setItem(TOKEN_KEY, token);
        else localStorage.removeItem(TOKEN_KEY);
    } catch {
        // không lưu được: chỉ đăng nhập trong phiên này
    }
}

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null): void {
    onUnauthorized = fn;
}

export async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { Accept: "application/json" };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    let response: Response;
    try {
        response = await fetch(`${API_BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch {
        throw new ApiError(0, "Không kết nối được máy chủ. Kiểm tra backend đã chạy chưa (cổng 8080).");
    }
    if (response.status === 204) return undefined as T;
    const text = await response.text();
    let data: unknown = null;
    try {
        data = text ? JSON.parse(text) : null;
    } catch {
        data = null;
    }
    if (!response.ok) {
        const message = (data as { message?: string } | null)?.message
            || (response.status === 404 && !text.startsWith("{") ? "Máy chủ chưa có API này (backend chưa chạy?)" : `Lỗi ${response.status}`);
        if (response.status === 401 && path !== "/api/auth/login") onUnauthorized?.();
        throw new ApiError(response.status, message);
    }
    if (data === null && text && !text.startsWith("{") && !text.startsWith("[")) {
        throw new ApiError(502, "Máy chủ trả về dữ liệu không phải JSON (backend chưa chạy?)");
    }
    return data as T;
}

export const get = <T>(path: string) => request<T>("GET", path);
export const post = <T>(path: string, body?: unknown) => request<T>("POST", path, body ?? {});
export const put = <T>(path: string, body?: unknown) => request<T>("PUT", path, body);
export const del = (path: string) => request<void>("DELETE", path);
