import { ENV } from "./env";

/**
 * Supabase Auth verification.
 *
 * Replaces the Manus OAuth calls that previously lived in sdk.ts. The browser
 * signs in with Supabase (magic link or social) and receives a Supabase access
 * token. That token is presented once to POST /api/auth/session; this module
 * verifies it against Supabase and returns the caller's identity.
 *
 * Verification is done by calling Supabase's own /auth/v1/user endpoint rather
 * than validating the JWT locally. That keeps us correct across Supabase's key
 * rotations and both the legacy anon and modern publishable key formats, and it
 * fails closed if the user was deleted or the token was revoked — which local
 * signature checking would not catch.
 */

export type SupabaseIdentity = {
  openId: string;
  email: string | null;
  name: string | null;
  loginMethod: string | null;
};

type SupabaseUserResponse = {
  id?: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
  app_metadata?: Record<string, unknown> | null;
};

function readString(source: Record<string, unknown> | null | undefined, key: string): string | null {
  const value = source?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(ENV.supabaseUrl && ENV.supabaseKey);
}

export async function verifySupabaseAccessToken(
  accessToken: string
): Promise<SupabaseIdentity | null> {
  if (!isSupabaseConfigured()) {
    console.error(
      "[SupabaseAuth] SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY are not configured"
    );
    return null;
  }
  if (!accessToken) return null;

  const url = `${ENV.supabaseUrl.replace(/\/+$/, "")}/auth/v1/user`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: ENV.supabaseKey,
      },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    console.error("[SupabaseAuth] Request to Supabase failed:", String(error));
    return null;
  }

  if (!response.ok) {
    console.warn(`[SupabaseAuth] Token rejected by Supabase (${response.status})`);
    return null;
  }

  const user = (await response.json().catch(() => null)) as SupabaseUserResponse | null;
  if (!user?.id) {
    console.warn("[SupabaseAuth] Supabase returned no user id");
    return null;
  }

  const meta = user.user_metadata ?? null;

  return {
    openId: user.id,
    email: user.email ?? null,
    name:
      readString(meta, "full_name") ??
      readString(meta, "name") ??
      user.email ??
      null,
    loginMethod: readString(user.app_metadata ?? null, "provider") ?? "email",
  };
}
