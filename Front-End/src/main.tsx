import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "bootstrap-icons/font/bootstrap-icons.css";
// Một phông đi kèm website (có bộ tiếng Việt, không phụ thuộc Google Fonts khi mạng trong toà nhà yếu)
import "@fontsource/familjen-grotesk/400.css";
import "@fontsource/familjen-grotesk/600.css";
import "@fontsource/familjen-grotesk/700.css";
import "./design/tokens.css";
import "./styles/wayfind.css";
import VenueLayout from "./viewer/VenueLayout";
import HomePage from "./viewer/pages/HomePage";
import VenueInfoPage from "./viewer/pages/VenueInfoPage";
import MapPage from "./viewer/pages/MapPage";
import SearchPage from "./viewer/pages/SearchPage";
import PlacePage from "./viewer/pages/PlacePage";
import RoutePage from "./viewer/pages/RoutePage";
import NavigatePage from "./viewer/pages/NavigatePage";
import { PreviewPage } from "./viewer/pages/MapPage";
import PermissionPage from "./viewer/pages/PermissionPage";
import StridePage from "./viewer/pages/StridePage";
import SharePage from "./viewer/pages/SharePage";
import SharedRoutePage from "./viewer/pages/SharedRoutePage";
import JourneysPage from "./viewer/pages/JourneysPage";
import ReportPage from "./viewer/pages/ReportPage";

import SettingsPage from "./viewer/pages/SettingsPage";
import { Loading } from "./viewer/components/ui";
import consoleRoutes from "./console/routes";

// Tải sau (camera, quét QR có thư viện jsQR; trang Builder/Admin) để trang bản đồ mở nhanh
const ScanPage = lazy(() => import("./viewer/pages/ScanPage"));
const GlobalScanPage = lazy(() => import("./viewer/pages/ScanPage").then(m => ({ default: m.GlobalScanPage })));
const QrEntryPage = lazy(() => import("./viewer/pages/ScanPage").then(m => ({ default: m.QrEntryPage })));
const CameraPage = lazy(() => import("./viewer/pages/CameraPage"));
const ComingSoon = lazy(() => import("./portal/ComingSoon"));
const ConsoleRoot = lazy(() => import("./console/ConsoleRoot"));

// Bản đồ các trang. Viewer (khách tham quan) nằm dưới /v/:slug; Builder/Admin làm ở đợt 2.
createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <BrowserRouter>
            <Suspense fallback={<div className="wf-screen wf-center"><Loading text="Đang mở…" /></div>}>
            <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/scan" element={<GlobalScanPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/settings/stride" element={<StridePage />} />
                <Route path="/v/:slug" element={<VenueLayout />}>
                    <Route index element={<VenueInfoPage />} />
                    <Route path="map" element={<MapPage />} />
                    <Route path="search" element={<SearchPage />} />
                    <Route path="place/:id" element={<PlacePage />} />
                    <Route path="route" element={<RoutePage />} />
                    <Route path="go" element={<NavigatePage />} />
                    <Route path="camera" element={<CameraPage />} />
                    <Route path="scan" element={<ScanPage />} />
                    <Route path="permission" element={<PermissionPage />} />
                    <Route path="stride" element={<StridePage />} />
                    <Route path="share" element={<SharePage />} />
                    <Route path="shared" element={<SharedRoutePage />} />
                    <Route path="preview" element={<PreviewPage />} />
                    <Route path="journeys" element={<JourneysPage />} />
                    <Route path="journeys/:id" element={<JourneysPage />} />
                    <Route path="report" element={<ReportPage />} />
                </Route>
                <Route path="/q/:slug" element={<VenueLayout />}>
                    <Route path=":code" element={<QrEntryPage />} />
                </Route>
                <Route element={<ConsoleRoot />}>{consoleRoutes()}</Route>
                <Route path="*" element={<ComingSoon />} />
            </Routes>
            </Suspense>
        </BrowserRouter>
    </StrictMode>
);
