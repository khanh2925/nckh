import { useState } from "react";
import App from "./App";
import AdminApp from "./admin/AdminApp";
import LoginDialog from "./components/LoginDialog";
import { getSession, logout } from "./api/auth";

// - "/"        public map, read only
// - "/admin…"  admin app (src/admin): login first, then overview, locations, walkways, data checks
// Cloudflare and Vite send every unknown path to index.html, so these paths need no router library.
const isAdminPage = /^\/admin(\/|$)/.test(window.location.pathname);

function Root() {
    const [session, setSession] = useState(getSession);

    if (!isAdminPage) return <App />;
    if (!session) return <LoginDialog asPage onLoggedIn={setSession} />;
    return (
        <AdminApp
            session={session}
            onSessionChange={setSession}
            onLogout={() => {
                logout();
                setSession(null);
            }}
        />
    );
}

export default Root;
