import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "leaflet/dist/leaflet.css";
import "./App.css";
import Root from "./Root.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { initMonitoring } from "./monitoring/monitoring.js";

// Error tracking (Sentry / GlitchTip), only when VITE_SENTRY_DSN is set
initMonitoring();

createRoot(document.getElementById("root")).render(
    <StrictMode>
        <ErrorBoundary>
            <Root />
        </ErrorBoundary>
    </StrictMode>
);
