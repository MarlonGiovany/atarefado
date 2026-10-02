import type { NextFunction, Request, Response } from "express";
import { env } from "../lib/env.js";
import { HttpError } from "../lib/http-error.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const allowedOrigins = new Set([new URL(env.CLIENT_URL).origin]);

function originOf(url: string | undefined) {
  try {
    return url ? new URL(url).origin : undefined;
  } catch {
    return undefined;
  }
}

/**
 * CSRF protection for cookie sessions. Browsers send an Origin header (Referer as a
 * fallback) on every state-changing request, and another site can't forge it, so
 * we only accept those coming from our own front-end. Together with SameSite=Lax
 * cookies this blocks cross-site form posts and fetches.
 */
export function requireSameOrigin(req: Request, _res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method)) return next();
  const source = req.get("origin") ?? originOf(req.get("referer"));
  if (!source || !allowedOrigins.has(source)) {
    throw new HttpError(403, "Origem da requisição não permitida");
  }
  next();
}
