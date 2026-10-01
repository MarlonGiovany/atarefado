import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../lib/env.js";
import { HttpError } from "../lib/http-error.js";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function signToken(userId: string) {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string) {
  const payload = jwt.verify(token, env.JWT_SECRET);
  if (typeof payload === "string" || !payload.sub) {
    throw new HttpError(401, "Invalid token");
  }
  return payload.sub;
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new HttpError(401, "Missing token");
  }
  try {
    req.userId = verifyToken(header.slice(7));
  } catch {
    throw new HttpError(401, "Invalid or expired token");
  }
  next();
}

/** Use after requireAuth: returns the authenticated user id. */
export function currentUser(req: Request) {
  if (!req.userId) throw new HttpError(401, "Not authenticated");
  return req.userId;
}
