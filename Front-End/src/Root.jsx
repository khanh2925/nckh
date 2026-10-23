import { useState } from "react";
import App from "./App";
import LoginDialog from "./components/LoginDialog";
import { getSession, logout } from "./api/auth";

// Two pages share the same map:
// - "/"      public website, read only
// - "/admin" admin page: login first, then the map with the Admin panel
// Cloudflare and Vite send every unknown path to index.html, so /admin needs no router.
const isAdminPage = window.location.pathname.replace(/\/+$/, "") === "/admin";

function Root() {
    const [session, setSession] = useState(getSession);

    if (!isAdminPage) return <App />;
    if (!session) return <LoginDialog asPage onLoggedIn={setSession} />;
    return (
        <App admin={{
            session,
            onSessionChange: setSession,
            onLogout: () => {
                logout();
                setSession(null);
            }
        }} />
    );
}

export default Root;
