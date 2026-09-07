import { establishAppSession, supabase, supabaseConfigured } from "@/lib/supabase";
import { useEffect, useState } from "react";

/**
 * Magic-link landing page.
 *
 * Supabase returns the session in the URL fragment; the browser client parses
 * it, and we immediately trade it for the application's own session cookie
 * before sending the user into the portal.
 */
export default function AuthCallback() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!supabaseConfigured) {
        setError("Sign-in is not configured on this deployment.");
        return;
      }
      try {
        // detectSessionInUrl parses the fragment; poll briefly for it to settle.
        let token: string | undefined;
        for (let attempt = 0; attempt < 20 && !token; attempt += 1) {
          const { data } = await supabase.auth.getSession();
          token = data.session?.access_token;
          if (!token) await new Promise(resolve => setTimeout(resolve, 150));
        }
        if (cancelled) return;

        if (!token) {
          setError("The sign-in link has expired or was already used.");
          return;
        }

        await establishAppSession(token);
        window.location.replace("/portal");
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : String(caught));
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return (
    <div className="portal-gate" role="status">
      <div className="portal-gate-rule" />
      <span>IOPAF SECURE ACCESS</span>
      {error ? (
        <>
          <h1>Sign-in could not be completed</h1>
          <p>{error}</p>
          <p><a href="/login">Request a new sign-in link</a></p>
        </>
      ) : (
        <h1>Completing sign-in…</h1>
      )}
    </div>
  );
}
