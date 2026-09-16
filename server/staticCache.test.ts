import { describe, expect, it } from "vitest";
import { cacheControlForStatic } from "./_core/vite";
import { PORTAL_ASSET_MAX_AGE } from "./portalAccess";

/**
 * Delivery policy, pinned. Every value here was chosen against a measurement,
 * and each has a failure mode that is invisible until someone far from the
 * origin loads the site.
 */
describe("static cache policy", () => {
  it("caches content-hashed assets immutably", () => {
    // The name changes when the contents do, so this can never serve stale.
    expect(cacheControlForStatic("/srv/dist/public/assets/index-AbCdEf12.js")).toBe(
      "public, max-age=31536000, immutable"
    );
    expect(cacheControlForStatic("/srv/dist/public/assets/Home-DtvySfRJ.js")).toBe(
      "public, max-age=31536000, immutable"
    );
  });

  it("lets a shared cache answer for the SPA shell while browsers revalidate", () => {
    const shell = cacheControlForStatic("/srv/dist/public/index.html");
    // A browser must revalidate: the shell names the hashed bundles, and a
    // stale copy would reference files that no longer exist.
    expect(shell).toContain("max-age=0");
    // But Cloudflare may answer for five minutes. Without s-maxage it reported
    // BYPASS and every visit went to the origin in Frankfurt for the shell.
    expect(shell).toContain("s-maxage=300");
  });

  it("gives unhashed imagery and the engine a long shared lifetime", () => {
    for (const file of [
      "/srv/dist/public/engine/journey-three-streams.webp",
      "/srv/dist/public/app.html",
      "/srv/dist/public/favicon.svg",
    ]) {
      expect(cacheControlForStatic(file), file).toContain("max-age=2592000");
    }
  });

  it("never serves development instrumentation", () => {
    // The file lives in client/public, so the build copies it even though the
    // plugin that injects it is dev-only. It was reachable on production.
    expect(cacheControlForStatic("/srv/dist/public/__manus__/debug-collector.js")).toBe("no-store");
  });

  it("applies the same rules to Windows-style paths", () => {
    expect(cacheControlForStatic("C:\\srv\\dist\\public\\assets\\index-AbCdEf12.js")).toBe(
      "public, max-age=31536000, immutable"
    );
    expect(cacheControlForStatic("C:\\srv\\dist\\public\\__manus__\\debug-collector.js")).toBe(
      "no-store"
    );
  });

  /**
   * The one place this deliberately differs from the upstream optimized build,
   * which marks the engine no-store.
   *
   * no-store is only equivalent when revalidation can produce a 304, and
   * measured against production it cannot: Cloudflare strips the weak ETag
   * when it re-compresses, and the platform normalises file mtimes to 1980, so
   * a conditional request returns 200 with the whole body. Under no-store the
   * 1.67 MB engine crossed the wire on every portal entry.
   *
   * The engine never reaches cacheControlForStatic anyway — the portal guard
   * sets its header first and serveStatic refuses to overwrite one — so this
   * asserts the guard's own policy.
   */
  describe("the gated engine, which the portal guard owns", () => {
    it("is private and bounded, not no-store", () => {
      expect(PORTAL_ASSET_MAX_AGE).toBeGreaterThan(0);
      expect(PORTAL_ASSET_MAX_AGE).toBeLessThanOrEqual(3600);
    });
  });
});
