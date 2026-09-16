import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

/** 30 days. Imagery and the engine change only when a build is deployed. */
const THIRTY_DAYS = 2_592_000;
/** How long a shared cache may answer for the SPA shell without asking. */
const SHELL_SHARED_MAX_AGE = 300;

/**
 * The cache policy for one built file, as a pure function so it can be tested
 * without a server. Gated assets never reach here: the portal guard sets their
 * header first and serveStatic refuses to overwrite it.
 */
export function cacheControlForStatic(filePath: string): string {
  const name = path.basename(filePath);

  // Dev instrumentation that the build copies but production must not serve.
  if (filePath.replace(/\\/g, "/").includes("/__manus__/")) return "no-store";

  // Content-hashed: a change produces a new name, so it can never go stale.
  if (filePath.replace(/\\/g, "/").includes("/assets/")) {
    return "public, max-age=31536000, immutable";
  }

  // The SPA shell names the hashed bundles, so a browser must revalidate — a
  // stale copy would point at files that no longer exist. A shared cache may
  // still answer for five minutes, which matters when the origin is in
  // Frankfurt and the readers are not: before this, every single visit went to
  // the origin for the shell and Cloudflare reported BYPASS.
  if (name === "index.html") {
    return `public, max-age=0, s-maxage=${SHELL_SHARED_MAX_AGE}, stale-while-revalidate=${SHELL_SHARED_MAX_AGE}`;
  }

  // Everything else is unhashed but only changes on deploy: the engine
  // screenshots, favicons, robots. An earlier version of this rule matched on
  // ".html" and so gave the 1.67 MB engine no-cache, which meant every portal
  // entry pulled all of it from the origin.
  return `public, max-age=${THIRTY_DAYS}, stale-while-revalidate=${THIRTY_DAYS}`;
}

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  // Browsers request /favicon.ico unprompted. There is no such file, so the
  // SPA catch-all below answered with index.html — which, before the Manus
  // runtime was taken out of production builds, meant 367 KB of HTML for an
  // icon request on every cold visit. Answer it directly instead. Declared
  // before the static handlers so nothing else can claim the path.
  app.get("/favicon.ico", (_req, res) => {
    res.setHeader("Cache-Control", "public, max-age=604800");
    res.status(204).end();
  });

  // Vite writes a content hash into every filename under /assets, so those
  // files are immutable: a change produces a new name. Serving them with the
  // Express default of max-age=0 made Cloudflare report BYPASS and fetch each
  // one from the origin on every visit — including the ~1.6 MB bundle.
  app.use(
    "/assets",
    express.static(path.join(distPath, "assets"), {
      immutable: true,
      maxAge: "1y",
    })
  );

  // The dev debug collector lives in client/public, so Vite copies it verbatim
  // into the build even though the plugin that injects it is dev-only. It was
  // therefore reachable on production: 26 KB of instrumentation nobody loads.
  // Refuse the whole prefix rather than relying on nothing linking to it.
  app.use("/__manus__", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.status(404).end();
  });

  app.use(
    express.static(distPath, {
      setHeaders: (res, filePath) => {
        // The portal guard marks gated assets before static serving runs, and
        // its decision is an access-control one. Never overwrite it.
        if (res.getHeader("Cache-Control")) return;
        res.setHeader("Cache-Control", cacheControlForStatic(filePath));
      },
    })
  );

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
