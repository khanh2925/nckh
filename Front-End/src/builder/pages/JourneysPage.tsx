import { Link } from "react-router-dom";
import { CircleHelp, Info, List, MapPin, MousePointer2, Plus, SquareDashed, Workflow, type LucideIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { HeaderActions } from "../../console/Shell";
import { useWorkspace } from "../Workspace";

const STEP_KINDS: [LucideIcon, string][] = [[MapPin, "Điểm cụ thể"], [List, "Theo loại"], [CircleHelp, "Câu hỏi"], [SquareDashed, "Tuỳ chọn"]];

// Quy trình (chuỗi bước dẫn khách: thủ tục, ký gửi, an ninh, cửa ra). Backend chưa có API quy trình:
// giữ bố cục 3 cột như màn Điểm và vùng, mọi thao tác tạo/sửa tắt, báo "Chưa khả dụng", không giả dữ liệu.
export default function JourneysPage() {
    const { venueId, data } = useWorkspace();
    const types = [...data.types].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)).slice(0, 6);
    return (
        <div className="flex min-h-0 flex-1">
            <HeaderActions>
                <Button asChild variant="outline"><Link to={`/builder/v/${venueId}/diff`}>Khác biệt</Link></Button>
                <Button disabled title="Chưa có quy trình để công khai">Công khai</Button>
            </HeaderActions>

            {/* Trái: quy trình và bước */}
            <aside aria-label="Quy trình và bước" className="flex w-64 shrink-0 flex-col border-r bg-background">
                <div className="border-b p-3">
                    <Button variant="outline" size="sm" className="w-full" disabled title="Chưa khả dụng"><Plus />Tạo quy trình</Button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-2">
                    <p className="px-2 pt-1 pb-2 text-xs font-medium text-muted-foreground">Thêm bước</p>
                    {STEP_KINDS.map(([Icon, label]) => (
                        <button key={label} type="button" disabled title="Chưa khả dụng"
                            className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm disabled:opacity-60">
                            <Icon className="size-4 text-muted-foreground" />{label}
                        </button>
                    ))}
                    {types.length > 0 && (
                        <>
                            <p className="px-2 pt-4 pb-2 text-xs font-medium text-muted-foreground">Loại điểm dùng làm bước</p>
                            {types.map(t => (
                                <button key={t.code} type="button" disabled title="Chưa khả dụng"
                                    className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm disabled:opacity-60">
                                    <span aria-hidden="true" className="flex size-5 shrink-0 items-center justify-center rounded text-xs text-white" style={{ background: t.color || "var(--muted-foreground)" }}>
                                        <i className={`bi ${t.icon || "bi-geo-alt"}`} />
                                    </span>
                                    <span className="min-w-0 flex-1 truncate">{t.name}</span>
                                </button>
                            ))}
                        </>
                    )}
                </div>
            </aside>

            {/* Giữa: sơ đồ quy trình */}
            <section aria-label="Sơ đồ quy trình" className="relative min-w-0 flex-1 bg-muted/40">
                <div className="absolute top-1/2 left-1/2 z-[800] flex w-96 -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-xl border bg-background p-5 shadow-lg">
                    <div className="flex items-center gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Workflow className="size-5" /></span>
                        <p className="text-sm font-medium">Chưa có quy trình nào</p>
                    </div>
                    <Alert>
                        <Info />
                        <AlertTitle>Chưa khả dụng</AlertTitle>
                        <AlertDescription>Backend chưa có API lưu quy trình.</AlertDescription>
                    </Alert>
                </div>
            </section>

            {/* Phải: thuộc tính bước */}
            <aside aria-label="Thuộc tính bước" className="flex w-80 shrink-0 flex-col border-l bg-background">
                <div className="flex flex-col items-center gap-2 p-4 pt-14 text-center">
                    <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground"><MousePointer2 className="size-5" /></span>
                    <p className="text-sm font-medium">Chưa chọn bước</p>
                </div>
            </aside>
        </div>
    );
}
