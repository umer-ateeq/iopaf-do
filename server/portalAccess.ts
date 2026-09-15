import type { NextFunction, Request, Response } from "express";
import { sdk } from "./_core/sdk";

type AuthenticateRequest = (req: Request) => Promise<unknown>;

/**
 * How long a signed-in browser may reuse a gated asset before this guard has
 * to authorise it again. Short on purpose — long enough to cover a working
 * session, short enough that revoked access takes effect promptly.
 */
export const PORTAL_ASSET_MAX_AGE = 600;

export function createPortalGuard(
  authenticate: AuthenticateRequest = req => sdk.authenticateRequest(req)
) {
  return async function protectPortalAsset(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      await authenticate(req);

      // "private" is the security-critical half: no shared cache may store a
      // gated asset, so Cloudflare can never hand the engine to an
      // unauthenticated visitor and this guard stays the only way in. That
      // holds for every value of PORTAL_ASSET_MAX_AGE below.
      //
      // The lifetime is the performance half. app.html is the 1.67 MB
      // assessment engine, byte-identical for every user and carrying no
      // per-user data; under no-store every portal entry re-downloaded all of
      // it from Frankfurt. Plain revalidation cannot help here: the platform
      // normalises file mtimes to 1980 and Cloudflare strips the weak ETag when
      // it re-compresses, so a conditional request comes back 200, not 304 —
      // measured against production. A bounded max-age is what actually works,
      // and it is deliberately short: the browser reuses the engine across a
      // working session, and re-authorises through this guard every ten
      // minutes.
      res.setHeader(
        "Cache-Control",
        `private, max-age=${PORTAL_ASSET_MAX_AGE}, must-revalidate`
      );
      res.setHeader("X-Robots-Tag", "noindex, nofollow");
      next();
    } catch {
      res.redirect(302, "/?auth=required");
    }
  };
}

export const protectPortalAsset = createPortalGuard();
