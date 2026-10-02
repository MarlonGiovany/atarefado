import type { CookieOptions, Response } from "express";
import { isProduction } from "./env.js";
import { prisma } from "./prisma.js";
import { hashToken, newToken } from "./tokens.js";

export const SESSION_COOKIE = "atarefado_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// HttpOnly: page scripts (and XSS) can't read it. SameSite=Lax: not sent on
// cross-site POSTs. Secure in production: HTTPS only. Path: only API requests.
const cookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: isProduction,
  path: "/api",
};

/** Always issues a brand-new session (no session fixation) and sets the cookie. */
export async function startSession(res: Response, userId: string) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  // Housekeeping: drop this user's expired sessions
  await prisma.session.deleteMany({ where: { userId, expiresAt: { lt: new Date() } } });
  await prisma.session.create({ data: { tokenHash: hashToken(token), userId, expiresAt } });
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions, expires: expiresAt });
}

export async function findSession(token: string) {
  const session = await prisma.session.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!session) return null;
  if (session.expiresAt <= new Date()) {
    await prisma.session.deleteMany({ where: { id: session.id } });
    return null;
  }
  return session;
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, cookieOptions);
}

export async function endSession(sessionId: string) {
  await prisma.session.deleteMany({ where: { id: sessionId } });
}

/** Signs the user out everywhere, optionally keeping the current session. */
export async function endAllSessions(userId: string, keepSessionId?: string) {
  await prisma.session.deleteMany({
    where: { userId, ...(keepSessionId && { id: { not: keepSessionId } }) },
  });
}
