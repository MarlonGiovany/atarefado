import type { Request } from "express";
import { rateLimit } from "express-rate-limit";
import { isProduction } from "./env.js";
import { HttpError } from "./http-error.js";

// Local development (and the automated tests) run many requests from one IP;
// IP-based limits are relaxed there. Per-account limits stay strict everywhere.
const ipMultiplier = isProduction ? 1 : 10;

const TOO_MANY = "Muitas tentativas. Aguarde alguns minutos e tente novamente.";

function limiter(options: {
  windowMinutes: number;
  max: number;
  key?: (req: Request) => string;
  perIp?: boolean;
}) {
  const perIp = options.perIp ?? !options.key;
  return rateLimit({
    windowMs: options.windowMinutes * 60_000,
    limit: perIp ? options.max * ipMultiplier : options.max,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    ...(options.key && { keyGenerator: options.key }),
    handler: (_req, res) => {
      res.status(429).json({ error: TOO_MANY });
    },
  });
}

const emailKey = (req: Request) =>
  "email:" + String(req.body?.email ?? "").trim().toLowerCase();

export const loginLimiter = limiter({ windowMinutes: 15, max: 20 });
export const registerLimiter = limiter({ windowMinutes: 60, max: 10 });
export const googleLimiter = limiter({ windowMinutes: 15, max: 30 });
export const googleLinkLimiter = limiter({ windowMinutes: 15, max: 10 });
export const forgotPasswordLimiter = limiter({ windowMinutes: 15, max: 5 });
export const forgotPasswordEmailLimiter = limiter({ windowMinutes: 60, max: 3, key: emailKey });
export const resetPasswordLimiter = limiter({ windowMinutes: 15, max: 10 });

// --- Failed password attempts per account ---
// Counts wrong passwords per e-mail regardless of IP, so one account can't be
// brute-forced from many addresses. Unknown e-mails are counted the same way, so
// the lockout doesn't reveal which accounts exist. In-memory: fine for a single
// server; use a shared store (e.g. Redis) when running several instances.

const MAX_FAILURES = 5;
const FAILURE_WINDOW_MS = 15 * 60_000;
const failures = new Map<string, { count: number; firstAt: number }>();

export function assertNotLockedOut(email: string) {
  const entry = failures.get(email);
  if (!entry) return;
  const remaining = entry.firstAt + FAILURE_WINDOW_MS - Date.now();
  if (remaining <= 0) {
    failures.delete(email);
    return;
  }
  if (entry.count >= MAX_FAILURES) {
    const minutes = Math.ceil(remaining / 60_000);
    throw new HttpError(
      429,
      `Muitas tentativas com senha incorreta. Tente novamente em ${minutes} min ou use “Esqueci minha senha”.`,
    );
  }
}

export function recordFailedLogin(email: string) {
  const entry = failures.get(email);
  if (!entry || entry.firstAt + FAILURE_WINDOW_MS <= Date.now()) {
    failures.set(email, { count: 1, firstAt: Date.now() });
  } else {
    entry.count += 1;
  }
}

export function clearFailedLogins(email: string) {
  failures.delete(email);
}
