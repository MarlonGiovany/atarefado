import type { ClientRateLimitInfo, Options, Store } from "express-rate-limit";
import { prisma } from "./prisma.js";
import { hashToken } from "./tokens.js";

// Counters live in the database (RateLimit table) instead of process memory, so
// limits hold across every server instance, including Vercel's serverless
// functions, which share nothing between invocations.

type Counter = { hits: number; resetAt: Date };

// Keys contain e-mails and IPs; only their hash is stored
const storedKey = (key: string) => hashToken(key);

/**
 * Counts one hit for `key` in a fixed window of `windowMs`. A single atomic
 * statement, so concurrent requests on different instances can't lose counts.
 */
export async function hit(key: string, windowMs: number): Promise<Counter> {
  const [counter] = await prisma.$queryRaw<Counter[]>`
    INSERT INTO "RateLimit" ("key", "hits", "resetAt")
    VALUES (${storedKey(key)}, 1, now() + ${windowMs}::integer * interval '1 millisecond')
    ON CONFLICT ("key") DO UPDATE SET
      "hits" = CASE WHEN "RateLimit"."resetAt" <= now() THEN 1 ELSE "RateLimit"."hits" + 1 END,
      "resetAt" = CASE WHEN "RateLimit"."resetAt" <= now() THEN EXCLUDED."resetAt" ELSE "RateLimit"."resetAt" END
    RETURNING "hits", "resetAt"`;

  // Expired counters are useless; clear them out now and then instead of
  // running a background job (there's no long-lived process on serverless)
  if (Math.random() < 0.01) {
    await prisma.rateLimit.deleteMany({ where: { resetAt: { lt: new Date() } } });
  }
  return counter;
}

/** The current count for `key`, or null if there is none in the active window. */
export async function peek(key: string): Promise<Counter | null> {
  return prisma.rateLimit.findFirst({
    where: { key: storedKey(key), resetAt: { gt: new Date() } },
    select: { hits: true, resetAt: true },
  });
}

export async function reset(key: string) {
  await prisma.rateLimit.deleteMany({ where: { key: storedKey(key) } });
}

/** express-rate-limit store backed by the RateLimit table. One instance per limiter. */
export class DatabaseStore implements Store {
  windowMs = 60_000;
  // Kept apart from other limiters' counters for the same IP
  constructor(readonly prefix: string) {}

  init(options: Options) {
    this.windowMs = options.windowMs;
  }

  async get(key: string): Promise<ClientRateLimitInfo | undefined> {
    const counter = await peek(this.prefix + key);
    return counter ? { totalHits: counter.hits, resetTime: counter.resetAt } : undefined;
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    const counter = await hit(this.prefix + key, this.windowMs);
    return { totalHits: counter.hits, resetTime: counter.resetAt };
  }

  async decrement(key: string) {
    await prisma.rateLimit.updateMany({
      where: { key: storedKey(this.prefix + key), hits: { gt: 0 } },
      data: { hits: { decrement: 1 } },
    });
  }

  async resetKey(key: string) {
    await reset(this.prefix + key);
  }
}
