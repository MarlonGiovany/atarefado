import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../lib/http-error.js";
import { assertPasswordPolicy, hashPassword, verifyPassword } from "../lib/passwords.js";
import { prisma } from "../lib/prisma.js";
import { assertNotLockedOut, clearFailedLogins, recordFailedLogin } from "../lib/rateLimit.js";
import { endAllSessions } from "../lib/sessions.js";
import { currentSession, currentUser } from "../middleware/auth.js";

export const accountRouter = Router();

// Creating a first password (Google-only accounts) needs a fresh login, since
// there's no current password to confirm.
const RECENT_LOGIN_MS = 10 * 60_000;

/**
 * Sets or changes the account password.
 * - With a password: requires the current one.
 * - Google-only: requires a login in the last few minutes.
 * Other sessions are signed out afterwards; the current one stays.
 */
accountRouter.put("/password", async (req, res) => {
  const body = z
    .object({
      currentPassword: z.string().max(1000).optional(),
      newPassword: z.string().max(1000),
    })
    .parse(req.body);

  const user = await prisma.user.findUnique({ where: { id: currentUser(req) } });
  if (!user) throw new HttpError(401, "Usuário não encontrado");
  const session = currentSession(req);

  if (user.passwordHash) {
    assertNotLockedOut(user.email);
    if (!body.currentPassword || !(await verifyPassword(body.currentPassword, user.passwordHash))) {
      recordFailedLogin(user.email);
      throw new HttpError(400, "A senha atual está incorreta.");
    }
    clearFailedLogins(user.email);
  } else if (Date.now() - session.createdAt.getTime() > RECENT_LOGIN_MS) {
    res.status(403).json({
      code: "recent_login_required",
      error: "Por segurança, saia e entre novamente com o Google antes de criar uma senha.",
    });
    return;
  }

  await assertPasswordPolicy(body.newPassword, { email: user.email, currentHash: user.passwordHash });
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(body.newPassword) },
  });
  await endAllSessions(user.id, session.id);
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

  res.json({
    message: user.passwordHash ? "Senha alterada." : "Senha criada. Agora você também pode entrar com e-mail e senha.",
  });
});
