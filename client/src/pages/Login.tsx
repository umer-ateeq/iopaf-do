import { establishAppSession, supabase, supabaseConfigured } from "@/lib/supabase";
import { useEffect, useState } from "react";

type Mode = "password" | "register" | "magic" | "reset";
type Status = "idle" | "busy" | "sent" | "error" | "registered";

const MODE_COPY: Record<Mode, { title: string; lede: string; cta: string }> = {
  password: {
    title: "Sign in to IOPAF",
    lede: "Enter your work email and password to open the assessment engine.",
    cta: "Sign in",
  },
  register: {
    title: "Create your IOPAF account",
    lede: "Choose a password of at least eight characters. You will confirm your email before the first sign-in.",
    cta: "Create account",
  },
  magic: {
    title: "Sign in without a password",
    lede: "We will email a single-use link. Open it in this browser.",
    cta: "Send sign-in link",
  },
  reset: {
    title: "Reset your password",
    lede: "We will email a link that lets you choose a new password.",
    cta: "Send reset link",
  },
};

export default function Login() {
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  // Promote an existing Supabase session if the user returns to /login.
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
      } catch { /* fall through to the form */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const switchMode = (next: Mode) => {
    setMode(next);
    setStatus("idle");
    setMessage("");
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabaseConfigured) {
      setStatus("error");
      setMessage("Sign-in is not configured on this deployment.");
      return;
    }
    const address = email.trim();
    if (!address) return;

    setStatus("busy");
    setMessage("");
    const redirectTo = `${window.location.origin}/auth/callback`;

    try {
      if (mode === "password") {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: address,
          password,
        });
        if (error) throw error;
        const token = data.session?.access_token;
        if (!token) throw new Error("Sign-in did not return a session.");
        await establishAppSession(token);
        window.location.replace("/portal");
        return;
      }

      if (mode === "register") {
        if (password.length < 8) throw new Error("Password must be at least 8 characters.");
        const { data, error } = await supabase.auth.signUp({
          email: address,
          password,
          options: { emailRedirectTo: redirectTo },
        });
        if (error) throw error;
        // With email confirmation enabled Supabase returns no session yet.
        const token = data.session?.access_token;
        if (token) {
          await establishAppSession(token);
          window.location.replace("/portal");
          return;
        }
        setStatus("registered");
        return;
      }

      if (mode === "magic") {
        const { error } = await supabase.auth.signInWithOtp({
          email: address,
          options: { emailRedirectTo: redirectTo },
        });
        if (error) throw error;
        setStatus("sent");
        return;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(address, { redirectTo });
      if (error) throw error;
      setStatus("sent");
    } catch (caught) {
      setStatus("error");
      setMessage(caught instanceof Error ? caught.message : String(caught));
    }
  };

  const copy = MODE_COPY[mode];
  const needsPassword = mode === "password" || mode === "register";

  if (status === "sent" || status === "registered") {
    return (
      <div className="portal-gate" role="main">
        <div className="portal-gate-rule" />
        <span>IOPAF SECURE ACCESS</span>
        <h1>Check your email</h1>
        <p>
          {status === "registered"
            ? <>Your account was created. Confirm <strong>{email}</strong> to finish, then sign in.</>
            : <>We sent a link to <strong>{email}</strong>. Open it in this browser.</>}
        </p>
        <p><button className="button button-outline" onClick={() => switchMode("password")}>Back to sign in</button></p>
      </div>
    );
  }

  return (
    <div className="portal-gate" role="main">
      <div className="portal-gate-rule" />
      <span>IOPAF SECURE ACCESS</span>
      <h1>{copy.title}</h1>
      <p>{copy.lede}</p>

      <form onSubmit={submit} style={{ display: "grid", gap: 12, marginTop: 22, width: "100%", maxWidth: 380, textAlign: "left" }}>
        <label htmlFor="login-email" style={{ fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase" }}>Work email</label>
        <input
          id="login-email" type="email" required autoFocus autoComplete="email"
          value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com"
          style={{ padding: "10px 12px", fontSize: 15, border: "1px solid #94a3b8", borderRadius: 6 }}
        />

        {needsPassword && (
          <>
            <label htmlFor="login-password" style={{ fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase" }}>Password</label>
            <input
              id="login-password" type="password" required minLength={mode === "register" ? 8 : undefined}
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              value={password} onChange={e => setPassword(e.target.value)}
              placeholder={mode === "register" ? "At least 8 characters" : "Your password"}
              style={{ padding: "10px 12px", fontSize: 15, border: "1px solid #94a3b8", borderRadius: 6 }}
            />
          </>
        )}

        <button className="button button-primary button-wide" type="submit" disabled={status === "busy"}>
          {status === "busy" ? "Working…" : copy.cta}
        </button>

        {status === "error" && <div className="auth-error" role="alert">{message}</div>}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 4, fontSize: 12 }}>
          {mode !== "password" && <button type="button" className="text-link" onClick={() => switchMode("password")}>Sign in with password</button>}
          {mode !== "register" && <button type="button" className="text-link" onClick={() => switchMode("register")}>Create an account</button>}
          {mode !== "magic" && <button type="button" className="text-link" onClick={() => switchMode("magic")}>Email me a link instead</button>}
          {mode !== "reset" && <button type="button" className="text-link" onClick={() => switchMode("reset")}>Forgot password</button>}
        </div>

        <a className="text-link" href="/">Back to the website</a>
      </form>
    </div>
  );
}
