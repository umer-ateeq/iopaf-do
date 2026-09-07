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
      res.setHeader("Cache-Control", "private, no-store, max-age=0");
      res.setHeader("X-Robots-Tag", "noindex, nofollow");
      next();
    } catch {
      res.redirect(302, "/?auth=required");
    }
  };
}

export const protectPortalAsset = createPortalGuard();
