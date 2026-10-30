import { Link } from "react-router-dom";
import { GitCompareArrows, Info, MapPin } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState, Page } from "../../console/page";
import { useWorkspace } from "../Workspace";

// Khác biệt bản nháp với bản công khai. Backend chưa tách bản nháp và bản công khai (lưu là hiện cho khách ngay,
// không lưu phiên bản), nên chưa có gì để so: hiện khung trống kèm "Chưa khả dụng", không giả số liệu.
export default function DiffPage() {
    const { venueId } = useWorkspace();
    const base = `/builder/v/${venueId}`;
    return (
        <Page actions={<Button asChild variant="outline"><Link to={`${base}/publish`}>Về Xuất bản</Link></Button>}>
            <Alert>
                <Info />
                <AlertTitle>Chưa khả dụng</AlertTitle>
                <AlertDescription>Backend chưa lưu phiên bản xuất bản, mọi chỉnh sửa hiện cho khách ngay khi lưu.</AlertDescription>
            </Alert>
            <EmptyState icon={<GitCompareArrows />} title="Chưa có thay đổi để so" description="Thay đổi điểm, lối đi, mã QR hay tầng sẽ hiện ở đây."
                action={<Button asChild variant="outline" size="sm"><Link to={`${base}/editor`}><MapPin />Mở Điểm và vùng</Link></Button>} />
        </Page>
    );
}
