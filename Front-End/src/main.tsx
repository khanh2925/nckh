import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "bootstrap-icons/font/bootstrap-icons.css";
// Phông chữ đi kèm website (không phụ thuộc Google Fonts, chạy được khi mạng trong toà nhà yếu)
import "@fontsource/be-vietnam-pro/400.css";
import "@fontsource/be-vietnam-pro/600.css";
import "@fontsource/be-vietnam-pro/700.css";
import "@fontsource/be-vietnam-pro/800.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/800.css";
import "./styles/wayfind.css";
import VenueLayout from "./viewer/VenueLayout";
import HomePage from "./viewer/pages/HomePage";
import VenueInfoPage from "./viewer/pages/VenueInfoPage";
import MapPage from "./viewer/pages/MapPage";
import SearchPage from "./viewer/pages/SearchPage";
import PlacePage from "./viewer/pages/PlacePage";
import RoutePage from "./viewer/pages/RoutePage";
import NavigatePage from "./viewer/pages/NavigatePage";

import SettingsPage from "./viewer/pages/SettingsPage";
import { Loading } from "./viewer/components/ui";

// Tải sau (camera, quét QR có thư viện jsQR; trang Builder/Admin) để trang bản đồ mở nhanh
const ScanPage = lazy(() => import("./viewer/pages/ScanPage"));
const GlobalScanPage = lazy(() => import("./viewer/pages/ScanPage").then(m => ({ default: m.GlobalScanPage })));
const QrEntryPage = lazy(() => import("./viewer/pages/ScanPage").then(m => ({ default: m.QrEntryPage })));
const CameraPage = lazy(() => import("./viewer/pages/CameraPage"));
const ComingSoon = lazy(() => import("./portal/ComingSoon"));

// Bản đồ các trang. Viewer (khách tham quan) nằm dưới /v/:slug; Builder/Admin làm ở đợt 2.
createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <BrowserRouter>
            <Suspense fallback={<div className="wf-screen wf-center"><Loading text="Đang mở…" /></div>}>
            <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/scan" element={<GlobalScanPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/v/:slug" element={<VenueLayout />}>
                    <Route index element={<VenueInfoPage />} />
                    <Route path="map" element={<MapPage />} />
                    <Route path="search" element={<SearchPage />} />
                    <Route path="place/:id" element={<PlacePage />} />
                    <Route path="route" element={<RoutePage />} />
                    <Route path="go" element={<NavigatePage />} />
                    <Route path="camera" element={<CameraPage />} />
                    <Route path="scan" element={<ScanPage />} />
                </Route>
                <Route path="/q/:slug" element={<VenueLayout />}>
                    <Route path=":code" element={<QrEntryPage />} />
                </Route>
                <Route path="*" element={<ComingSoon />} />
            </Routes>
            </Suspense>
        </BrowserRouter>
    </StrictMode>
);
