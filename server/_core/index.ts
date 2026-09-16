import "dotenv/config";
import express from "express";
import compression from "compression";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { protectPortalAsset } from "../portalAccess";
import { registerAuthRoutes } from "../authRoutes";
import { registerCopilotStreamRoute } from "../copilotStreamRoute";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Compress at the origin. Cloudflare already compresses what it proxies, but
  // that only helps traffic that goes through it: a direct origin hit, a health
  // check, or a deployment without the CDN in front got the full uncompressed
  // bundle. First in the chain so it covers every response below.
  app.use(compression({ threshold: 1024 }));

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerAuthRoutes(app);
  app.use("/app.html", protectPortalAsset);
  // Streamed Copilot answers. Registered before the tRPC middleware because it
  // holds the connection open, which a JSON-body transport cannot.
  registerCopilotStreamRoute(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Managed platforms (DigitalOcean App Platform, Render, Railway, Fly) health-check
  // the container on $PORT exactly. Scanning for a free port silently binds a port the
  // platform is not probing, so the deploy fails its health check for no visible reason.
  // Honour $PORT verbatim when it is set; only scan for local development.
  const envPort = process.env.PORT ? parseInt(process.env.PORT, 10) : null;
  const port =
    envPort && Number.isInteger(envPort)
      ? envPort
      : await findAvailablePort(3000);

  server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on port ${port}`);
  });
}

startServer().catch(console.error);
