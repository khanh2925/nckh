import { Link, useLocation } from "react-router-dom";
import { Link2 } from "lucide-react";
import "@fontsource-variable/inter";
import "../console/app.css";
import { Button } from "@/components/ui/button";
import { BrandMark } from "../console/Shell";

// Trang 404 cho mọi đường dẫn không có. Nằm ngoài ConsoleRoot (không biết người xem đã đăng nhập hay chưa),
// nên chỉ có logo, không có sidebar và tài khoản. Dùng cùng theme shadcn với Builder (lớp .cb-root bật theme).
export default function ComingSoon() {
    const { pathname } = useLocation();
    return (
        <div className="cb-root flex min-h-svh flex-col bg-background text-foreground">
            <header className="flex h-14 items-center gap-2 border-b px-4">
                <Link to="/" aria-label="Indoor Map, mở bản đồ cho khách"><BrandMark /></Link>
                <span className="text-sm font-medium">Indoor Map</span>
            </header>
            <main className="flex flex-1 items-center justify-center p-6">
                <div className="w-full max-w-md space-y-6 text-center">
                    <div className="space-y-2">
                        <p className="text-sm font-medium text-primary">404</p>
                        <h1 className="text-2xl font-semibold tracking-tight">Không tìm thấy trang</h1>
                        <p className="text-sm text-muted-foreground">Trang này không tồn tại hoặc đã bị xoá.</p>
                    </div>
                    <p className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                        <Link2 className="size-3.5 shrink-0" /><span className="truncate">{window.location.host}{pathname}</span>
                    </p>
                    <div className="flex justify-center gap-2">
                        <Button asChild variant="outline"><Link to="/">Mở bản đồ cho khách</Link></Button>
                        <Button asChild><Link to="/builder">Về Địa điểm của tôi</Link></Button>
                    </div>
                </div>
            </main>
        </div>
    );
}
