import { describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { createPortalGuard } from "./portalAccess";

function responseDouble() {
  return {
    setHeader: vi.fn(),
    redirect: vi.fn(),
  } as unknown as Response;
}

function cacheControlOf(res: Response) {
  const calls = (res.setHeader as unknown as ReturnType<typeof vi.fn>).mock.calls;
  return calls.find(([name]) => name === "Cache-Control")?.[1] as string | undefined;
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
    expect(res.setHeader).toHaveBeenCalledWith("X-Robots-Tag", "noindex, nofollow");
    expect(next).toHaveBeenCalledOnce();
    expect(res.redirect).not.toHaveBeenCalled();
  });

  /**
   * These pin the guarantee rather than one exact header string, so the
   * property survives a change of wording: no shared cache may ever store a
   * gated asset, and the browser must revalidate — which routes every request
   * back through this guard — while still being allowed a 304 in place of
   * re-downloading the 1.67 MB engine.
   */
  describe("the Cache-Control it sets on an authorized response", () => {
    const authorizedHeader = async () => {
      const res = responseDouble();
      await createPortalGuard(vi.fn().mockResolvedValue({ id: 7 }))(
        {} as Request,
        res,
        vi.fn() as unknown as NextFunction
      );
      const value = cacheControlOf(res);
      expect(value).toBeDefined();
      return (value as string).split(/,\s*/);
    };

    it("marks the response private so no shared cache may store it", async () => {
      expect(await authorizedHeader()).toContain("private");
    });

    it("never marks a gated asset public", async () => {
      expect(await authorizedHeader()).not.toContain("public");
    });

    it("never grants a shared cache a positive lifetime", async () => {
      const directives = await authorizedHeader();
      expect(directives.some(d => d.startsWith("s-maxage"))).toBe(false);
    });

    it("forces the browser to revalidate, so the guard authorizes every request", async () => {
      const directives = await authorizedHeader();
      const revalidates = ["no-cache", "no-store", "must-revalidate", "max-age=0"].some(d =>
        directives.includes(d)
      );
      expect(revalidates).toBe(true);
    });
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

  it("sets no cache header at all when it refuses the request", async () => {
    const res = responseDouble();
    await createPortalGuard(vi.fn().mockRejectedValue(new Error("nope")))(
      {} as Request,
      res,
      vi.fn() as unknown as NextFunction
    );
    // A refusal is a redirect, so nothing about the gated asset is described.
    expect(cacheControlOf(res)).toBeUndefined();
  });
});
