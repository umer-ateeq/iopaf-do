import { useAuth } from "@/_core/hooks/useAuth";
import { useEffect, useRef } from "react";

export default function Portal() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const signingOutRef = useRef(false);

  useEffect(() => {
    if (loading || isAuthenticated || signingOutRef.current) return;
    window.location.replace("/?auth=required");
  }, [loading, isAuthenticated]);

  const signOut = async () => {
    signingOutRef.current = true;
    await logout();
    window.location.replace("/");
  };

  if (loading || !isAuthenticated) {
    return (
      <div className="portal-gate" role="status">
        <div className="portal-gate-rule" />
        <span>IOPAF SECURE ACCESS</span>
        <h1>Verifying your session…</h1>
      </div>
    );
  }

  return (
    <div className="portal-shell">
      <header className="portal-bar">
        <a className="wordmark" href="/" aria-label="Return to IOPAF website">
          <span>IOPAF</span><i aria-hidden="true" /><small>Protected assessment workspace</small>
        </a>
        <div className="portal-user">
          <span>{user?.name || user?.email || "Authenticated user"}</span>
          <a href="/">Website</a>
          <button onClick={signOut}>Sign out</button>
        </div>
      </header>
      <iframe
        className="portal-frame"
        src="/app.html"
        title="IOPAF assessment portal"
        referrerPolicy="same-origin"
      />
    </div>
  );
}
