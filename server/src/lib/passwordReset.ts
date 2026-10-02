import { env } from "./env.js";
import { googleAccountEmail, passwordResetEmail } from "./emails.js";
import { HttpError } from "./http-error.js";
import { sendMail } from "./mailer.js";
import { assertPasswordPolicy, hashPassword } from "./passwords.js";
import { prisma } from "./prisma.js";
import { clearFailedLogins } from "./rateLimit.js";
import { hashToken, newToken } from "./tokens.js";

const RESET_TTL_MINUTES = 30;
const INVALID_LINK = "Este link de redefinição é inválido ou expirou. Peça um novo e-mail.";

/**
 * Handles "Esqueci minha senha" for an e-mail. The caller answers with the same
 * generic message whatever happens here, so it can't be used to discover accounts.
 * - account with a password: invalidate earlier links, e-mail a new single-use link;
 * - Google-only account: no reset link (there is no password to reset), just an
 *   e-mail explaining how to sign in;
 * - no account: nothing.
 */
export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return;

  if (!user.passwordHash) {
    await sendMail(googleAccountEmail(user.email, user.name, `${env.CLIENT_URL}/login`));
    return;
  }

  const token = newToken();
  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
    prisma.passwordResetToken.create({
      data: {
        tokenHash: hashToken(token),
        userId: user.id,
        expiresAt: new Date(Date.now() + RESET_TTL_MINUTES * 60_000),
      },
    }),
  ]);

  // The token goes in the URL fragment (#), which browsers never send to servers,
  // so it doesn't end up in access logs or Referer headers.
  const link = `${env.CLIENT_URL}/redefinir-senha#token=${token}`;
  await sendMail(passwordResetEmail(user.email, user.name, link, RESET_TTL_MINUTES));
}

/** Sets a new password from a reset link, then signs the user out everywhere. */
export async function resetPassword(token: string, newPassword: string) {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!record || record.usedAt || record.expiresAt <= new Date() || !record.user.passwordHash) {
    throw new HttpError(400, INVALID_LINK);
  }

  const { user } = record;
  await assertPasswordPolicy(newPassword, { email: user.email, currentHash: user.passwordHash });
  const passwordHash = await hashPassword(newPassword);

  // Claim the token atomically: if two requests race, only one gets usedAt set
  const claimed = await prisma.passwordResetToken.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (claimed.count === 0) throw new HttpError(400, INVALID_LINK);

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id, id: { not: record.id } } }),
    prisma.session.deleteMany({ where: { userId: user.id } }),
    prisma.googleLinkRequest.deleteMany({ where: { userId: user.id } }),
  ]);
  clearFailedLogins(user.email);
}
