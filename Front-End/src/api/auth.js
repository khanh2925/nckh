import { API_BASE } from "./locationApi";

// Admin login. The backend answers POST /api/auth/login with a token (JWT) valid for a few hours;
// every add / edit / delete then sends it as "Authorization: Bearer <token>" (see request() in locationApi.js).
//
// sessionStorage: the login lasts until the tab is closed, so a shared computer doesn't stay logged in.
// Private windows or blocked storage just mean logging in again, so every access is wrapped in try/catch.
const STORAGE_KEY = "airport-map-admin";
let current = null;   // kept in memory too, in case the browser refuses to store it

// Thrown when the backend refuses a change because the login is missing or has expired
export class AuthError extends Error {}

const isValid = (session) => Boolean(session?.token) && new Date(session.expiresAt) > new Date();

export function getSession() {
    if (isValid(current)) return current;
    try {
        const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
        if (isValid(stored)) {
            current = stored;
            return stored;
        }
    } catch {
        // storage unavailable or broken value: treat as logged out
    }
    return null;
}

export function logout() {
    current = null;
    try {
        sessionStorage.removeItem(STORAGE_KEY);
    } catch {
        // nothing stored
    }
}

// Returns { token, username, expiresAt } or throws an Error with a message to show
export async function login(username, password) {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
    });
    if (response.status === 401) throw new Error("Sai tên đăng nhập hoặc mật khẩu.");
    if (response.status === 429) throw new Error("Đăng nhập sai quá nhiều lần. Hãy thử lại sau 15 phút.");
    if (!response.ok) throw new Error("Không đăng nhập được. Hãy kiểm tra máy chủ.");

    const session = await response.json();
    current = session;
    try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
        // still logged in for this page (current), just not remembered after a reload
    }
    return session;
}
