import "dotenv/config";
import { z } from "zod";

/** Optional setting where an empty value means "not set". */
const optional = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined);

// On Vercel (which sets VERCEL=1), defaults come from its system environment
// variables, so a deploy needs no per-environment URL setup. Explicit values win.
export const onVercel = Boolean(process.env.VERCEL);

/** Public address of this deployment on Vercel: the production domain or the preview's branch URL. */
function vercelUrl() {
  const host =
    process.env.VERCEL_ENV === "production"
      ? process.env.VERCEL_PROJECT_PRODUCTION_URL
      : (process.env.VERCEL_BRANCH_URL ?? process.env.VERCEL_URL);
  return host ? `https://${host}` : undefined;
}

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default(onVercel ? "production" : "development"),
    DATABASE_URL: z.string().min(1),
    // Connections per server instance (pg's default: 10). The local database from
    // `npm run db:local` (PGlite) handles a single connection, so use 1 there.
    DATABASE_POOL_MAX: z.coerce.number().int().positive().optional(),
    PORT: z.coerce.number().default(3333),
    // Front-end address: allowed CORS/CSRF origin and base for links in e-mails
    CLIENT_URL: z.url().default(vercelUrl() ?? "http://localhost:5173"),
    // Set when running behind a reverse proxy (e.g. "1"), so rate limits see the real client IP
    TRUST_PROXY: optional,
    // Serve the built front-end (client/dist) from this server, so app and API share
    // one origin. Defaults to on in production, off in development (Vite serves it).
    SERVE_CLIENT: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => (value === undefined ? undefined : value === "true")),
    // Path to the built front-end, relative to the server folder
    CLIENT_DIST: z.string().default("../client/dist"),
    // OAuth client id from Google Cloud Console; empty disables "Sign in with Google"
    GOOGLE_CLIENT_ID: optional,
    // SMTP for password reset e-mails. Without SMTP_HOST (development only),
    // e-mails are saved to server/.mail-outbox instead of being sent.
    SMTP_HOST: optional,
    SMTP_PORT: z.coerce.number().default(587),
    SMTP_SECURE: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    SMTP_USER: optional,
    SMTP_PASS: optional,
    MAIL_FROM: z.string().default("Atarefado <no-reply@atarefado.dev>"),
  })
  .superRefine((config, ctx) => {
    if (config.NODE_ENV !== "production") return;
    if (!config.CLIENT_URL.startsWith("https://")) {
      ctx.addIssue({ code: "custom", path: ["CLIENT_URL"], message: "must use https in production" });
    }
    if (!config.SMTP_HOST) {
      ctx.addIssue({ code: "custom", path: ["SMTP_HOST"], message: "is required in production" });
    }
  });

export const env = schema.parse(process.env);
export const isProduction = env.NODE_ENV === "production";
// On Vercel the CDN serves client/dist itself (see vercel.json)
export const serveClient = env.SERVE_CLIENT ?? (isProduction && !onVercel);

/** Express "trust proxy" value: a hop count, true/false, or a named preset. */
export function trustProxySetting(): number | boolean | string | undefined {
  // Vercel's edge is the one proxy in front of the function, and it overwrites
  // X-Forwarded-For with the real client IP
  const value = env.TRUST_PROXY ?? (onVercel ? "1" : undefined);
  if (value === undefined) return undefined;
  if (/^\d+$/.test(value)) return Number(value);
  if (value === "true" || value === "false") return value === "true";
  return value;
}
