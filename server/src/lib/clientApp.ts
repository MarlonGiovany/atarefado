import { existsSync } from "node:fs";
import path from "node:path";
import express from "express";
import type { Express } from "express";
import { env } from "./env.js";

/**
 * Serves the built React app (client/dist) from the API server, so in production
 * the site and the API share one origin: the session cookie and the CSRF origin
 * check then work without any cross-site setup.
 */
export function serveClientApp(app: Express) {
  const dist = path.resolve(env.CLIENT_DIST);
  const indexHtml = path.join(dist, "index.html");
  if (!existsSync(indexHtml)) {
    throw new Error(`Built front-end not found at ${dist}. Run the client build first.`);
  }

  app.use(
    express.static(dist, {
      index: false,
      setHeaders(res, file) {
        // Vite puts content-hashed files in assets/: safe to cache "forever"
        if (file.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      },
    }),
  );

  // Client-side routes (/login, /boards/…, /redefinir-senha …) all load index.html
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) return next();
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(indexHtml);
  });
}
