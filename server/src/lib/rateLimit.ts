import type { Request } from "express";
import { rateLimit } from "express-rate-limit";
import { isProduction } from "./env.js";
import { HttpError } from "./http-error.js";
import { DatabaseStore, hit, peek, reset } from "./rateLimitStore.js";

// Local development (and the automated tests) run many requests from one IP;
// IP-based limits are relaxed there. Per-account limits stay strict everywhere.
const ipMultiplier = isProduction ? 1 : 10;

const TOO_MANY = "Muitas tentativas. Aguarde alguns minutos e tente novamente.";

function limiter(
  name: string,
  options: {
    windowMinutes: number;
    max: number;
    key?: (req: Request) => string;
    perIp?: boolean;
  },
) {
  const perIp = options.perIp ?? !options.key;
  return rateLimit({
    windowMs: options.windowMinutes * 60_000,
    limit: perIp ? options.max * ipMultiplier : options.max,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    // Shared by all instances (see rateLimitStore.ts)
    store: new DatabaseStore(`${name}:`),
    ...(options.key && { keyGenerator: options.key }),
    handler: (_req, res) => {
      res.status(429).json({ error: TOO_MANY });
    },
  });
}

const emailKey = (req: Request) =>
  "email:" + String(req.body?.email ?? "").trim().toLowerCase();

export const loginLimiter = limiter("login", { windowMinutes: 15, max: 20 });
export const registerLimiter = limiter("register", { windowMinutes: 60, max: 10 });
export const googleLimiter = limiter("google", { windowMinutes: 15, max: 30 });
export const googleLinkLimiter = limiter("google-link", { windowMinutes: 15, max: 10 });
export const forgotPasswordLimiter = limiter("forgot", { windowMinutes: 15, max: 5 });
export const forgotPasswordEmailLimiter = limiter("forgot-email", { windowMinutes: 60, max: 3, key: emailKey });
export const resetPasswordLimiter = limiter("reset", { windowMinutes: 15, max: 10 });

// --- Failed password attempts per account ---
// Counts wrong passwords per e-mail regardless of IP, so one account can't be
// brute-forced from many addresses. Unknown e-mails are counted the same way, so
// the lockout doesn't reveal which accounts exist. Stored in the database, so the
// lockout holds across server instances.

const MAX_FAILURES = 5;
const FAILURE_WINDOW_MS = 15 * 60_000;
const lockoutKey = (email: string) => "lockout:" + email;

export async function assertNotLockedOut(email: string) {
  const counter = await peek(lockoutKey(email));
  if (!counter || counter.hits < MAX_FAILURES) return;
  const minutes = Math.max(1, Math.ceil((counter.resetAt.getTime() - Date.now()) / 60_000));
  throw new HttpError(
    429,
    `Muitas tentativas com senha incorreta. Tente novamente em ${minutes} min ou use “Esqueci minha senha”.`,
  );
}

export async function recordFailedLogin(email: string) {
  await hit(lockoutKey(email), FAILURE_WINDOW_MS);
}

export async function clearFailedLogins(email: string) {
  await reset(lockoutKey(email));
}
