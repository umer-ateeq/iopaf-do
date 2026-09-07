import { establishAppSession, supabase, supabaseConfigured } from "@/lib/supabase";
import { useEffect, useState } from "react";

type Status = "idle" | "sending" | "sent" | "error";

/**
 * Sign-in by email magic link.
 *
 * Chosen over social OAuth because it needs no external provider registration,
 * and over passwords because IOPAF's user base is small and signs in rarely —
 * there are no passwords to store, rotate or reset. IOPAF never handles a
 * credential: Supabase verifies the mailbox and we mint a session from that.
 */
export default function Login() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  // If a session already exists (e.g. the user returned to /login), promote it.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supabaseConfigured) return;
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token || cancelled) return;
      try {
        await establishAppSession(token);
        window.location.replace("/portal");
      } catch {
        /* fall through to the form */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const sendLink = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabaseConfigured) {
      setStatus("error");
      setMessage("Sign-in is not configured on this deployment.");
      return;
    }
    const address = email.trim();
    if (!address) return;

    setStatus("sending");
    setMessage("");

    const { error } = await supabase.auth.signInWithOtp({
      email: address,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }
    setStatus("sent");
  };

  return (
    <div className="portal-gate" role="main">
      <div className="portal-gate-rule" />
      <span>IOPAF SECURE ACCESS</span>

      {status === "sent" ? (
        <>
          <h1>Check your email</h1>
          <p>
            A sign-in link has been sent to <strong>{email}</strong>. Open it on this
            device to enter the assessment engine. The link is single-use.
          </p>
          <p>
            <a href="/">Return to the website</a>
          </p>
        </>
      ) : (
        <>
          <h1>Sign in to IOPAF</h1>
          <p>
            Enter your work email and we will send a single-use sign-in link. No
            password is required, and IOPAF never handles one.
          </p>
          <form onSubmit={sendLink} style={{ display: "grid", gap: 12, marginTop: 20, maxWidth: 380 }}>
            <label htmlFor="login-email" style={{ fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Work email
            </label>
            <input
              id="login-email"
              type="email"
              required
              autoFocus
              autoComplete="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              placeholder="you@example.com"
              style={{ padding: "10px 12px", fontSize: 15, border: "1px solid #94a3b8", borderRadius: 6 }}
            />
            <button className="button button-primary button-wide" type="submit" disabled={status === "sending"}>
              {status === "sending" ? "Sending…" : "Send sign-in link"}
            </button>
            {status === "error" && (
              <div className="auth-error" role="alert">{message}</div>
            )}
            <a className="text-link" href="/">Back to the website</a>
          </form>
        </>
      )}
    </div>
  );
}
