import type { ReactNode } from "react";
import { AlertCircle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeaderActions } from "./Shell";

// Khung nội dung DUY NHẤT cho mọi màn máy tính dạng trang (không phải canvas bản đồ).
// Tên trang KHÔNG lặp lại trong trang: header (breadcrumb) đã nói trang nào, sidebar đánh dấu mục đang mở.
// Nút của trang nằm trên header (actions -> HeaderActions), bên phải, nút chính đứng cuối.
// Khoảng cách: lề 24 (px-6 py-6), giữa các khối 24 (gap-6), trong khối 16 (gap-4).
// Độ rộng: "wide" cho bảng/danh sách (1152), "narrow" cho form (768). Không khối nào tự kéo dãn quá độ rộng này.

export function Page({ actions, width = "wide", children }: {
    actions?: ReactNode;
    width?: "wide" | "narrow";
    children: ReactNode;
}) {
    return (
        <div className={`mx-auto flex w-full flex-col gap-6 px-6 py-6 ${width === "wide" ? "max-w-6xl" : "max-w-3xl"}`}>
            {actions && <HeaderActions>{actions}</HeaderActions>}
            {children}
        </div>
    );
}

/** Một khối có tiêu đề: viền mảnh, bo 12, đệm 16/24 — dùng cho mọi nhóm nội dung */
export function Section({ title, description, actions, children, flush }: {
    title?: ReactNode;
    description?: ReactNode;
    actions?: ReactNode;
    children: ReactNode;
    /** true: nội dung sát viền (bảng) */
    flush?: boolean;
}) {
    return (
        <section className="rounded-xl border bg-card text-card-foreground">
            {(title || actions) && (
                <div className="flex items-center justify-between gap-4 border-b px-6 py-4">
                    <div className="min-w-0 space-y-0.5">
                        {title && <h2 className="text-base font-semibold">{title}</h2>}
                        {description && <p className="text-sm text-muted-foreground">{description}</p>}
                    </div>
                    {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
                </div>
            )}
            <div className={flush ? "" : "p-6"}>{children}</div>
        </section>
    );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
    return (
        <div role="alert" className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
            <AlertCircle className="size-4 shrink-0 text-destructive" />
            <span className="flex-1">{(error as Error)?.message || "Có lỗi xảy ra"}</span>
            {onRetry && <Button size="sm" variant="outline" onClick={onRetry}><RotateCw />Thử lại</Button>}
        </div>
    );
}

export function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description?: string; action?: ReactNode }) {
    return (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
            <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary [&_svg]:size-5">{icon}</span>
            <div className="space-y-1">
                <p className="text-sm font-medium">{title}</p>
                {description && <p className="text-sm text-muted-foreground">{description}</p>}
            </div>
            {action}
        </div>
    );
}

const TONES = {
    blue: "bg-primary/10 text-primary",
    green: "bg-success/10 text-success",
    amber: "bg-warning/10 text-warning",
    violet: "bg-violet-500/10 text-violet-600",
    muted: "bg-muted text-muted-foreground"
};

/** Ô số liệu nhỏ (không phải dashboard): icon màu + nhãn + số */
export function Stat({ label, value, hint, icon, tone = "blue" }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode; tone?: keyof typeof TONES }) {
    return (
        <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
            {icon && <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4.5 ${TONES[tone]}`}>{icon}</span>}
            <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-lg font-semibold tabular-nums">{value}</p>
                {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
            </div>
        </div>
    );
}
