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

/**
 * Verify the caller and record them, via the record-user Edge Function.
 *
 * Preferred over verifySupabaseAccessToken() because the function also writes
 * the users row using the service role that Supabase injects into its own
 * runtime. That keeps the Postgres password and the service-role key off the
 * web host entirely — the host holds only the publishable key.
 *
 * If the function itself is unreachable we fall back to direct token
 * verification. Sign-in then still succeeds; only the audit row is skipped.
 */
export async function verifyAndRecordUser(
  accessToken: string
): Promise<{ identity: SupabaseIdentity; recorded: boolean } | null> {
  if (!isSupabaseConfigured() || !accessToken) return null;

  const url = `${ENV.supabaseUrl.replace(/\/+$/, "")}/functions/v1/record-user`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: ENV.supabaseKey,
        "Content-Type": "application/json",
      },
      body: "{}",
      signal: AbortSignal.timeout(15_000),
    });

    if (response.status === 401 || response.status === 403) return null;

    if (response.ok) {
      const body = (await response.json().catch(() => null)) as
        | { identity?: SupabaseIdentity; recorded?: boolean }
        | null;
      if (body?.identity?.openId) {
        if (body.recorded === false) {
          console.warn("[SupabaseAuth] Identity verified but the users row was not written");
        }
        return { identity: body.identity, recorded: body.recorded === true };
      }
    }

    console.warn(`[SupabaseAuth] record-user returned ${response.status}; verifying directly`);
  } catch (error) {
    console.warn("[SupabaseAuth] record-user unreachable; verifying directly:", String(error));
  }

  const identity = await verifySupabaseAccessToken(accessToken);
  return identity ? { identity, recorded: false } : null;
}
