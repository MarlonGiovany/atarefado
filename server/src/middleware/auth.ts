import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../lib/http-error.js";
import { findSession, SESSION_COOKIE } from "../lib/sessions.js";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      session?: { id: string; createdAt: Date };
    }
  }
}

/** Loads the session from the HttpOnly cookie; 401 if missing, unknown or expired. */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token: unknown = req.cookies?.[SESSION_COOKIE];
  if (typeof token !== "string" || !token) {
    throw new HttpError(401, "Não autenticado");
  }
  const session = await findSession(token);
  if (!session) throw new HttpError(401, "Sessão inválida ou expirada");

  req.userId = session.userId;
  req.session = { id: session.id, createdAt: session.createdAt };
  next();
}

/** Use after requireAuth: returns the authenticated user id. */
export function currentUser(req: Request) {
  if (!req.userId) throw new HttpError(401, "Não autenticado");
  return req.userId;
}

/** Use after requireAuth: the current session. */
export function currentSession(req: Request) {
  if (!req.session) throw new HttpError(401, "Não autenticado");
  return req.session;
}
