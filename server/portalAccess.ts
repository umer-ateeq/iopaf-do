import type { NextFunction, Request, Response } from "express";
import { sdk } from "./_core/sdk";

type AuthenticateRequest = (req: Request) => Promise<unknown>;

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
      // Two properties, both required.
      //
      // "private" keeps every shared cache out, so Cloudflare can never hand a
      // gated asset to an unauthenticated visitor. "no-cache" does not mean
      // "do not store" — it means "revalidate before reuse" — so the browser
      // must still ask this server every time, and this guard runs and
      // authorizes every one of those requests. Access control is therefore
      // exactly as strict as the previous no-store.
      //
      // What it buys: app.html is the 1.67 MB assessment engine, byte-identical
      // for every user. Under no-store the browser re-downloaded all of it
      // from Frankfurt on each portal entry; now it revalidates and gets a 304.
      res.setHeader("Cache-Control", "private, no-cache");
      res.setHeader("X-Robots-Tag", "noindex, nofollow");
      next();
    } catch {
      res.redirect(302, "/?auth=required");
    }
  };
}

export const protectPortalAsset = createPortalGuard();
