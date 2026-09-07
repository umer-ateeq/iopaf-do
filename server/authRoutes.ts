import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import { verifySupabaseAccessToken } from "./_core/supabaseAuth";

/**
 * Supabase session exchange.
 *
 * The browser signs in with Supabase and posts the resulting access token here
 * exactly once. We verify it with Supabase, record the user, and mint the
 * application's own HttpOnly session cookie.
 *
 * Deliberately keeping the app's own cookie rather than letting the browser
 * carry the Supabase token: the /portal route and the /app.html guard already
 * verify this cookie, it is HttpOnly (so page scripts cannot read it), and the
 * assessment engine is served as a static asset that cannot attach an
 * Authorization header of its own.
 */
export function registerAuthRoutes(app: Express) {
  app.post("/api/auth/session", async (req: Request, res: Response) => {
    const header = req.headers.authorization;
    const bodyToken =
      typeof (req.body as { accessToken?: unknown } | undefined)?.accessToken === "string"
        ? ((req.body as { accessToken: string }).accessToken)
        : undefined;

    const accessToken =
      typeof header === "string" && header.startsWith("Bearer ")
        ? header.slice(7)
        : bodyToken;

    if (!accessToken) {
      res.status(400).json({ error: "Missing access token" });
      return;
    }

    const identity = await verifySupabaseAccessToken(accessToken);
    if (!identity) {
      res.status(401).json({ error: "Invalid or expired Supabase session" });
      return;
    }

    try {
      await db.upsertUser({
        openId: identity.openId,
        name: identity.name,
        email: identity.email,
        loginMethod: identity.loginMethod,
        lastSignedIn: new Date(),
      });
    } catch (error) {
      console.error("[Auth] Failed to record user:", error);
      res.status(500).json({ error: "Could not record user" });
      return;
    }

    // verifySession() rejects a session whose name is empty, so an identity
    // with no display name would sign in successfully and then be bounced on
    // every subsequent request. Fall back through email to the opaque id so the
    // claim is always populated.
    const displayName = identity.name ?? identity.email ?? identity.openId;

    const sessionToken = await sdk.createSessionToken(identity.openId, {
      name: displayName,
      expiresInMs: ONE_YEAR_MS,
    });

    res.cookie(COOKIE_NAME, sessionToken, {
      ...getSessionCookieOptions(req),
      maxAge: ONE_YEAR_MS,
    });

    res.json({ success: true, openId: identity.openId });
  });
}
