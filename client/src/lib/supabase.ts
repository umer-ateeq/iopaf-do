import { createClient } from "@supabase/supabase-js";

/**
 * Browser Supabase client, used only to establish identity.
 *
 * Once Supabase confirms the user, the token is exchanged once at
 * POST /api/auth/session for the application's own HttpOnly session cookie,
 * which is what /portal and the /app.html guard actually check. The Supabase
 * session is not what protects the assessment engine.
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const supabaseConfigured = Boolean(url && key);

export const supabase = createClient(url ?? "http://localhost", key ?? "public-anon-key", {
  auth: {
    // The magic-link callback arrives as a URL fragment that this client reads.
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
  },
});

/** Exchange a verified Supabase access token for the app's own session cookie. */
export async function establishAppSession(accessToken: string): Promise<void> {
  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    credentials: "include",
    body: JSON.stringify({ accessToken }),
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(detail?.error || `Session exchange failed (${response.status})`);
  }
}
