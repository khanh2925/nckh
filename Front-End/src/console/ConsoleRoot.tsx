import { useEffect, useState, useSyncExternalStore } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { ChevronRight, CircleCheck, Copy, MonitorSmartphone } from "lucide-react";
import type { VenueDto } from "@indoor-map/core";
import "@fontsource-variable/inter";
import "./app.css";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { venueApi } from "./api";
import { AuthProvider, useAuth } from "./auth";
import { BrandMark } from "./Shell";
import { FeedbackProvider } from "./ui";

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
        <div className="flex min-h-svh flex-col bg-background">
            <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
                <Link to="/" aria-label="Indoor Map, mở bản đồ cho khách"><BrandMark /></Link>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">Indoor Map</span>
                {user && (
                    <span role="img" aria-label={user.fullName} className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-medium">
                        {initials(user.fullName)}
                    </span>
                )}
            </header>
            <main className="flex flex-1 flex-col gap-6 p-4">
                <section aria-labelledby="pb-t" className="flex flex-col items-center gap-3 rounded-xl border bg-card px-6 py-8 text-center">
                    <span aria-hidden="true" className="flex size-12 items-center justify-center rounded-lg bg-primary/10 text-primary"><MonitorSmartphone className="size-6" /></span>
                    <div className="space-y-1">
                        <h1 id="pb-t" className="text-lg font-semibold">Mở Builder trên máy tính</h1>
                        <p className="text-sm text-muted-foreground">Builder cần màn hình rộng từ 900 px để vẽ mặt bằng và lối đi.</p>
                    </div>
                </section>
                {copied === "ok" && (
                    <Alert role="status">
                        <CircleCheck className="text-success" />
                        <AlertTitle>Đã sao chép link</AlertTitle>
                        <AlertDescription>Dán vào trình duyệt trên máy tính.</AlertDescription>
                    </Alert>
                )}
                {venues && venues.length > 0 && (
                    <section aria-labelledby="pb-x" className="flex flex-col gap-2">
                        <h2 id="pb-x" className="text-xs font-medium text-muted-foreground">Xem như khách</h2>
                        <ul className="divide-y rounded-xl border bg-card">
                            {venues.map(v => (
                                <li key={v.id}>
                                    {v.status === "PUBLISHED" ? (
                                        <a href={`/v/${v.slug}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-sm font-medium">{v.name}</span>
                                                <span className="text-xs text-muted-foreground">Công khai</span>
                                            </span>
                                            <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
                                        </a>
                                    ) : (
                                        <div aria-disabled="true" className="px-4 py-3">
                                            <span className="block truncate text-sm font-medium text-muted-foreground">{v.name}</span>
                                            <span className="text-xs text-muted-foreground">{v.status === "HIDDEN" ? "Bị ẩn bởi quản trị" : "Bản nháp, chưa có bản công khai"}</span>
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </section>
                )}
            </main>
            <div className="flex flex-col gap-2 border-t p-4">
                <Button className="w-full" onClick={() => void copy()}><Copy />{copied === "ok" ? "Sao chép lại" : "Sao chép link"}</Button>
                <p className={`text-center text-xs ${copied === "err" ? "text-destructive" : "text-muted-foreground"}`}>
                    {copied === "err" ? "Không sao chép được, hãy mở link này trên máy tính." : "Mở link này trên máy tính"}
                </p>
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
