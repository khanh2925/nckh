import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "leaflet/dist/leaflet.css";
import "./App.css";
import Root from "./Root.jsx";

createRoot(document.getElementById("root")).render(
    <StrictMode>
        <Root />
    </StrictMode>
);
