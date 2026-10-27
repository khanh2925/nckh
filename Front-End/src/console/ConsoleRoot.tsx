import { Outlet } from "react-router-dom";
import "@fontsource/familjen-grotesk/500.css";
import "@fontsource/familjen-grotesk/600.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "./console.css";
import { AuthProvider } from "./auth";
import { FeedbackProvider } from "./ui";

/** Gốc của Builder + Admin: theme Cobalt, đăng nhập, thông báo */
export default function ConsoleRoot() {
    return (
        <AuthProvider>
            <FeedbackProvider>
                <div className="cb-root"><Outlet /></div>
            </FeedbackProvider>
        </AuthProvider>
    );
}
