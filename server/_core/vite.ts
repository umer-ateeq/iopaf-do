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

  // index.html is the SPA shell: it names the hashed bundles, so a stale copy
  // would point at files that no longer exist. It must always revalidate.
  //
  // Everything else here is unhashed but only changes on deploy — app.html is
  // the 1.67 MB assessment engine, plus the engine screenshots and favicons.
  // An earlier version of this rule matched on ".html" and so gave the engine
  // no-cache, which meant every portal entry pulled all 1.67 MB from the origin
  // in Frankfurt. They now stay fresh for an hour and may be served stale for a
  // week while revalidating, so Cloudflare answers repeat views from its edge.
  const ONE_HOUR = 3600;
  const ONE_WEEK = 604_800;

  app.use(
    express.static(distPath, {
      setHeaders: (res, filePath) => {
        // The portal guard marks gated assets before static serving runs, and
        // its decision is an access-control one. Never overwrite it.
        if (res.getHeader("Cache-Control")) return;

        if (path.basename(filePath) === "index.html") {
          res.setHeader("Cache-Control", "no-cache");
          return;
        }
        res.setHeader(
          "Cache-Control",
          `public, max-age=${ONE_HOUR}, stale-while-revalidate=${ONE_WEEK}`
        );
      },
    })
  );

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
