import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import nodemailer from "nodemailer";
import { env, isProduction } from "./env.js";

export type Mail = { to: string; subject: string; text: string; html: string };

const transport = env.SMTP_HOST
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    })
  : null;

// Development without SMTP: e-mails are written here (git-ignored) so the reset
// link can be opened locally. Production refuses to start without SMTP (see env.ts).
export const DEV_OUTBOX = path.join(process.cwd(), ".mail-outbox");

export async function sendMail(mail: Mail) {
  if (transport) {
    await transport.sendMail({ from: env.MAIL_FROM, ...mail });
    return;
  }
  if (isProduction) throw new Error("SMTP is not configured");

  await mkdir(DEV_OUTBOX, { recursive: true });
  const name = `${Date.now()}-${mail.to.replace(/[^a-z0-9]+/gi, "-")}`;
  const saved = { from: env.MAIL_FROM, date: new Date().toISOString(), ...mail };
  await writeFile(path.join(DEV_OUTBOX, `${name}.json`), JSON.stringify(saved, null, 2));
  await writeFile(path.join(DEV_OUTBOX, `${name}.html`), mail.html);
  // Only the file name is logged, never the link or token inside the e-mail
  console.info(`[mail] Development e-mail saved to .mail-outbox/${name}.html`);
}
