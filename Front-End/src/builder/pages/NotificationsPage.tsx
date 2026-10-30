import { Link } from "react-router-dom";
import { Bell, Clock } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useAuth } from "../../console/auth";
import { EmptyState, Page, Section } from "../../console/page";
import { AccountTabs } from "./SimplePages";

// Thông báo cấp tài khoản (giai đoạn 2). Backend chưa có API thông báo và chưa gửi email:
// hiện bố cục thật với trạng thái trống, ô chọn email bị tắt.
const MAIL: [string, boolean, string?][] = [
    ["Địa điểm bị ẩn hoặc hiện lại", true, "Luôn gửi"],
    ["Tài khoản được duyệt hoặc bị khoá", true, "Luôn gửi"],
    ["Tem cần thay", true],
    ["Xuất bản xong", false]
];

export default function NotificationsPage() {
    const { user } = useAuth();
    return (
        <Page width="narrow">
            <AccountTabs current="notifications" />
            <Alert>
                <Clock />
                <AlertTitle>Chưa khả dụng</AlertTitle>
                <AlertDescription>Hệ thống chưa gửi thông báo và email.</AlertDescription>
            </Alert>
            <EmptyState icon={<Bell />} title="Chưa có thông báo" description="Địa điểm bị ẩn, xuất bản xong hay tem cần thay sẽ hiện ở đây."
                action={<Button asChild variant="outline" size="sm"><Link to="/builder">Mở Địa điểm của tôi</Link></Button>} />
            <Section title="Nhận email" description={user?.email ? `Gửi tới ${user.email}` : undefined}>
                <ul aria-disabled="true" className="grid gap-4">
                    {MAIL.map(([label, on, hint], i) => (
                        <li key={label} className="flex items-start gap-3">
                            <Checkbox id={`mail-${i}`} defaultChecked={on} disabled aria-describedby={hint ? `mail-${i}-h` : undefined} />
                            <div className="grid gap-1">
                                <Label htmlFor={`mail-${i}`} className="font-normal">{label}</Label>
                                {hint && <p id={`mail-${i}-h`} className="text-xs text-muted-foreground">{hint}</p>}
                            </div>
                        </li>
                    ))}
                </ul>
            </Section>
        </Page>
    );
}
