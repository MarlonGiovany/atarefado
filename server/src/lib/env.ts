import "dotenv/config";
import { z } from "zod";

/** Optional setting where an empty value means "not set". */
const optional = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined);

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    DATABASE_URL: z.string().min(1),
    PORT: z.coerce.number().default(3333),
    // Front-end address: allowed CORS/CSRF origin and base for links in e-mails
    CLIENT_URL: z.url().default("http://localhost:5173"),
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
export const serveClient = env.SERVE_CLIENT ?? isProduction;

/** Express "trust proxy" value: a hop count, true/false, or a named preset. */
export function trustProxySetting(): number | boolean | string | undefined {
  const value = env.TRUST_PROXY;
  if (value === undefined) return undefined;
  if (/^\d+$/.test(value)) return Number(value);
  if (value === "true" || value === "false") return value === "true";
  return value;
}
