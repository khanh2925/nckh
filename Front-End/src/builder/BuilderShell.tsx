import { Outlet, useLocation } from "react-router-dom";
import { ConsoleFrame, GlobalSidebar, type Crumb } from "../console/Shell";

// Breadcrumb các trang Builder ngoài một địa điểm (cha / trang)
const CRUMBS: Record<string, Crumb[]> = {
    "/builder": [{ label: "Địa điểm của tôi" }],
    "/builder/new": [{ label: "Địa điểm của tôi", to: "/builder" }, { label: "Tạo địa điểm" }],
    "/builder/stats": [{ label: "Thống kê" }],
    "/builder/account": [{ label: "Tài khoản" }],
    "/builder/notifications": [{ label: "Tài khoản", to: "/builder/account" }, { label: "Thông báo" }]
};

// Khung các trang Builder không thuộc một địa điểm cụ thể: danh sách, tạo mới, thống kê, tài khoản
export default function BuilderShell() {
    const { pathname } = useLocation();
    const path = pathname.replace(/\/$/, "");
    return (
        <ConsoleFrame crumbs={CRUMBS[path] ?? [{ label: "Builder" }]} nav={<GlobalSidebar />}>
            <div className="k-page"><Outlet /></div>
        </ConsoleFrame>
    );
}
