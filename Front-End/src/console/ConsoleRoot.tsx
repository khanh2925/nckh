import { useEffect, useState, useSyncExternalStore } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import type { VenueDto } from "@indoor-map/core";
import "./console.css";
import "../builder/pages/global.css";
import { venueApi } from "./api";
import { AuthProvider, useAuth } from "./auth";
import { FeedbackProvider } from "./ui";
import Lc from "../design/Lc";

// Builder và Admin cần màn hình rộng (vẽ mặt bằng, lối đi). Dưới ngưỡng này hiện màn "Mở Builder trên máy tính";
// đăng nhập, đăng ký, quên mật khẩu vẫn dùng được trên điện thoại.
const NARROW = "(max-width: 899px)";

function subscribe(onChange: () => void) {
    const query = window.matchMedia(NARROW);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
}
const isNarrow = () => window.matchMedia(NARROW).matches;

function initials(name?: string) {
    const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "";
    return (parts[0]!.charAt(0) + (parts.length > 1 ? parts[parts.length - 1]!.charAt(0) : "")).toUpperCase();
}

function PhoneBlock() {
    const { user } = useAuth();
    const [venues, setVenues] = useState<VenueDto[] | null>(null);
    const [copied, setCopied] = useState<"ok" | "err" | null>(null);
    useEffect(() => {
        if (!user) return;
        let alive = true;
        venueApi.mine().then(list => alive && setVenues(list)).catch(() => alive && setVenues([]));
        return () => {
            alive = false;
        };
    }, [user]);
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            setCopied("ok");
        } catch {
            setCopied("err");
        }
    };
    return (
        <div className="kg-phone">
            <header className="kg-phone-head">
                <Link to="/" className="cs-logo" aria-label="Indoor Map, mở bản đồ cho khách"><Lc name="map-pin" size={18} stroke={2.2} /></Link>
                <span className="k16" style={{ flex: 1, minWidth: 0 }}>Indoor Map</span>
                {user && <span className="cs-avatar" aria-label={user.fullName} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", background: "var(--surface)", color: "var(--ink)", borderColor: "var(--rule)" }}>{initials(user.fullName)}</span>}
            </header>
            <main className="kg-phone-main">
                <section className="k-card" aria-labelledby="pb-t" style={{ padding: 16 }}>
                    <div className="kg-phone-art" aria-hidden="true">
                        <div className="k-stack" style={{ alignItems: "center", gap: 8 }}>
                            <div className="kg-screen"><span /><span><Lc name="map" size={32} color="var(--muted)" /></span></div>
                            <div className="kg-stand" />
                        </div>
                        <div className="kg-handset"><Lc name="x" size={20} color="var(--muted)" /></div>
                    </div>
                    <div>
                        <h1 id="pb-t" className="k28">Mở Builder trên máy tính</h1>
                        <p className="k14 k-m" style={{ marginTop: 8 }}>Builder cần màn hình rộng từ 900 px để vẽ mặt bằng và lối đi.</p>
                    </div>
                </section>
                {copied === "ok" && (
                    <div role="status" className="k-note"><Lc name="circle-check" size={16} color="var(--ok)" /><div><div className="k-b k-ok">Đã sao chép link</div><div>Dán vào trình duyệt trên máy tính.</div></div></div>
                )}
                {venues && venues.length > 0 && (
                    <section aria-labelledby="pb-x" className="k-stack" style={{ gap: 8 }}>
                        <h2 id="pb-x" className="k-sec">Xem như khách</h2>
                        <div className="k-card kg-phone-list">
                            {venues.map(v => v.status === "PUBLISHED" ? (
                                <a key={v.id} href={`/v/${v.slug}`}>
                                    <span style={{ flex: 1, minWidth: 0 }}><span className="k16" style={{ display: "block" }}>{v.name}</span><span className="k12 k-m">Công khai</span></span>
                                    <Lc name="chevron-right" size={20} color="var(--muted)" />
                                </a>
                            ) : (
                                <div key={v.id} aria-disabled="true">
                                    <span style={{ flex: 1, minWidth: 0 }}><span className="k16 k-m" style={{ display: "block" }}>{v.name}</span><span className="k12 k-m">{v.status === "HIDDEN" ? "Bị ẩn bởi quản trị" : "Bản nháp, chưa có bản công khai"}</span></span>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </main>
            <div className="kg-phone-foot">
                <button type="button" className="k-btn p kg-full" onClick={() => void copy()}>{copied === "ok" ? "Sao chép lại" : "Sao chép link"}</button>
                <p className="k12 k-m kg-center">{copied === "err" ? "Không sao chép được, hãy mở link này trên máy tính." : "Mở link này trên máy tính"}</p>
            </div>
        </div>
    );
}

function Gate() {
    const { pathname } = useLocation();
    const { user } = useAuth();
    const narrow = useSyncExternalStore(subscribe, isNarrow, () => false);
    const wide = /^\/(builder|admin)(\/|$)/.test(pathname);
    // chưa đăng nhập: để RequireAuth đưa về trang đăng nhập (dùng được trên điện thoại)
    return narrow && wide && user ? <PhoneBlock /> : <Outlet />;
}

/** Gốc của Builder + Admin: bộ giao diện màn máy tính, đăng nhập, thông báo */
export default function ConsoleRoot() {
    return (
        <AuthProvider>
            <FeedbackProvider>
                <div className="cb-root"><Gate /></div>
            </FeedbackProvider>
        </AuthProvider>
    );
}
