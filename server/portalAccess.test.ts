import { describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { createPortalGuard } from "./portalAccess";

function responseDouble() {
  return {
    setHeader: vi.fn(),
    redirect: vi.fn(),
  } as unknown as Response;
}

describe("protected IOPAF engine asset", () => {
  it("allows an authenticated request and disables shared caching", async () => {
    const authenticate = vi.fn().mockResolvedValue({ id: 7 });
    const guard = createPortalGuard(authenticate);
    const req = {} as Request;
    const res = responseDouble();
    const next = vi.fn() as unknown as NextFunction;

    await guard(req, res, next);

    expect(authenticate).toHaveBeenCalledWith(req);
    expect(res.setHeader).toHaveBeenCalledWith(
      "Cache-Control",
      "private, no-store, max-age=0"
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      "X-Robots-Tag",
      "noindex, nofollow"
    );
    expect(next).toHaveBeenCalledOnce();
    expect(res.redirect).not.toHaveBeenCalled();
  });

  it("redirects an unauthenticated request to the public website", async () => {
    const guard = createPortalGuard(vi.fn().mockRejectedValue(new Error("invalid session")));
    const req = {} as Request;
    const res = responseDouble();
    const next = vi.fn() as unknown as NextFunction;

    await guard(req, res, next);

    expect(res.redirect).toHaveBeenCalledWith(302, "/?auth=required");
    expect(next).not.toHaveBeenCalled();
  });
});
