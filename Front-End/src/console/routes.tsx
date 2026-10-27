import { lazy } from "react";
import { Navigate, Route } from "react-router-dom";
import { RequireAuth } from "./auth";

// Tải sau theo từng trang: khách tham quan không phải tải mã của Builder/Admin
const LoginPage = lazy(() => import("../builder/AuthPages").then(m => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import("../builder/AuthPages").then(m => ({ default: m.RegisterPage })));
const BuilderShell = lazy(() => import("../builder/BuilderShell"));
const WorkspaceLayout = lazy(() => import("../builder/Workspace").then(m => ({ default: m.WorkspaceLayout })));
const VenuesPage = lazy(() => import("../builder/pages/VenuesPage"));
const VenueCreatePage = lazy(() => import("../builder/pages/VenueCreatePage"));
const BuildingsPage = lazy(() => import("../builder/pages/BuildingsPage"));
const CalibratePage = lazy(() => import("../builder/pages/CalibratePage"));
const EditorPage = lazy(() => import("../builder/pages/EditorPage"));
const ImportPage = lazy(() => import("../builder/pages/ImportPage"));
const WalkwaysPage = lazy(() => import("../builder/pages/WalkwaysPage"));
const TypesPage = lazy(() => import("../builder/pages/TypesPage"));
const QrPage = lazy(() => import("../builder/pages/QrPage"));
const TestPage = lazy(() => import("../builder/pages/TestPage"));
const PublishPage = lazy(() => import("../builder/pages/PublishPage"));
const AccountPage = lazy(() => import("../builder/pages/SimplePages").then(m => ({ default: m.AccountPage })));
const LandmarksPage = lazy(() => import("../builder/pages/SimplePages").then(m => ({ default: m.LandmarksPage })));
const StatsPage = lazy(() => import("../builder/pages/SimplePages").then(m => ({ default: m.StatsPage })));
const AdminDashboard = lazy(() => import("../admin/AdminPages").then(m => ({ default: m.AdminDashboard })));
const AdminLayout = lazy(() => import("../admin/AdminPages").then(m => ({ default: m.AdminLayout })));
const AdminLogs = lazy(() => import("../admin/AdminPages").then(m => ({ default: m.AdminLogs })));
const AdminReview = lazy(() => import("../admin/AdminPages").then(m => ({ default: m.AdminReview })));
const AdminSettings = lazy(() => import("../admin/AdminPages").then(m => ({ default: m.AdminSettings })));
const AdminTemplates = lazy(() => import("../admin/AdminPages").then(m => ({ default: m.AdminTemplates })));
const AdminUsers = lazy(() => import("../admin/AdminPages").then(m => ({ default: m.AdminUsers })));

// Các trang Builder (quản trị địa điểm) và Admin (quản trị hệ thống). Nằm trong <ConsoleRoot> (xem main.tsx).
export default function consoleRoutes() {
    return (
        <>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/builder" element={<RequireAuth><BuilderShell /></RequireAuth>}>
                <Route index element={<VenuesPage />} />
                <Route path="new" element={<VenueCreatePage />} />
                <Route path="stats" element={<StatsPage />} />
                <Route path="account" element={<AccountPage />} />
            </Route>
            <Route path="/builder/v/:venueId" element={<RequireAuth><WorkspaceLayout /></RequireAuth>}>
                <Route index element={<Navigate to="editor" replace />} />
                <Route path="plan" element={<CalibratePage />} />
                <Route path="buildings" element={<BuildingsPage />} />
                <Route path="editor" element={<EditorPage />} />
                <Route path="import" element={<ImportPage />} />
                <Route path="walkways" element={<WalkwaysPage />} />
                <Route path="types" element={<TypesPage />} />
                <Route path="qr" element={<QrPage />} />
                <Route path="landmarks" element={<LandmarksPage />} />
                <Route path="test" element={<TestPage />} />
                <Route path="publish" element={<PublishPage />} />
            </Route>
            <Route path="/admin" element={<RequireAuth role="SYSTEM_ADMIN"><AdminLayout /></RequireAuth>}>
                <Route index element={<AdminDashboard />} />
                <Route path="review" element={<AdminReview />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="templates" element={<AdminTemplates />} />
                <Route path="settings" element={<AdminSettings />} />
                <Route path="logs" element={<AdminLogs />} />
            </Route>
        </>
    );
}
