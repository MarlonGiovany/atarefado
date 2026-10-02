import { waitUntil } from "@vercel/functions";
import { Router } from "express";
import { z } from "zod";
import { env } from "../lib/env.js";
import { confirmGoogleLink, resolveGoogleSignIn, verifyGoogleCredential } from "../lib/google.js";
import { HttpError } from "../lib/http-error.js";
import { requestPasswordReset, resetPassword } from "../lib/passwordReset.js";
import { assertPasswordPolicy, hashPassword, needsRehash, verifyPassword } from "../lib/passwords.js";
import { prisma } from "../lib/prisma.js";
import {
  assertNotLockedOut,
  clearFailedLogins,
  forgotPasswordEmailLimiter,
  forgotPasswordLimiter,
  googleLimiter,
  googleLinkLimiter,
  loginLimiter,
  recordFailedLogin,
  registerLimiter,
  resetPasswordLimiter,
} from "../lib/rateLimit.js";
import {
  clearSessionCookie,
  endAllSessions,
  endSession,
  findSession,
  SESSION_COOKIE,
  startSession,
} from "../lib/sessions.js";
import { currentUser, requireAuth } from "../middleware/auth.js";

export const authRouter = Router();

const email = z.email().toLowerCase();
// Shape only; the password rules themselves live in assertPasswordPolicy
const password = z.string().max(1000);

const publicUser = (user: { id: string; name: string; email: string }) => ({
  id: user.id,
  name: user.name,
  email: user.email,
});

const INVALID_CREDENTIALS = "E-mail ou senha inválidos.";

authRouter.post("/register", registerLimiter, async (req, res) => {
  const body = z
    .object({ name: z.string().trim().min(1).max(80), email, password })
    .parse(req.body);
  await assertPasswordPolicy(body.password, { email: body.email });

  const exists = await prisma.user.findUnique({ where: { email: body.email } });
  if (exists) {
    // Sign-up can't hide that an e-mail is taken without e-mail verification; the
    // message stays neutral (no hint of how the account signs in) and the route
    // is rate limited.
    throw new HttpError(
      409,
      "Não foi possível criar a conta com este e-mail. Se você já tem cadastro, entre ou use “Esqueci minha senha”.",
    );
  }

  const user = await prisma.user.create({
    data: { name: body.name, email: body.email, passwordHash: await hashPassword(body.password) },
  });
  await startSession(res, user.id);
  res.status(201).json({ user: publicUser(user) });
});

authRouter.post("/login", loginLimiter, async (req, res) => {
  const body = z.object({ email, password: z.string().min(1).max(1000) }).parse(req.body);
  await assertNotLockedOut(body.email);

  const user = await prisma.user.findUnique({ where: { email: body.email } });
  // Same message and same bcrypt work for "no such e-mail", "wrong password" and
  // "account has no password", so none of them can be told apart. verifyPassword
  // runs first on purpose: `!user || ...` would skip it and answer faster.
  const passwordMatches = await verifyPassword(body.password, user?.passwordHash);
  if (!user || !passwordMatches) {
    await recordFailedLogin(body.email);
    throw new HttpError(401, INVALID_CREDENTIALS);
  }
  await clearFailedLogins(body.email);

  // Transparent migration of hashes made with an older, cheaper bcrypt cost
  if (user.passwordHash && needsRehash(user.passwordHash)) {
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(body.password) },
    });
  }

  await startSession(res, user.id);
  res.json({ user: publicUser(user) });
});

/** Ends the current session. Works even if it already expired. */
authRouter.post("/logout", async (req, res) => {
  const token: unknown = req.cookies?.[SESSION_COOKIE];
  if (typeof token === "string" && token) {
    const session = await findSession(token);
    if (session) await endSession(session.id);
  }
  clearSessionCookie(res);
  res.status(204).end();
});

/** "Sair de todos os dispositivos" */
authRouter.post("/logout-all", requireAuth, async (req, res) => {
  await endAllSessions(currentUser(req));
  clearSessionCookie(res);
  res.status(204).end();
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: currentUser(req) } });
  if (!user) throw new HttpError(401, "Usuário não encontrado");
  res.json({
    user: { ...publicUser(user), hasPassword: Boolean(user.passwordHash), hasGoogle: Boolean(user.googleId) },
  });
});

/** Tells the client whether to show "Sign in with Google" (the client id is public). */
authRouter.get("/config", (_req, res) => {
  res.json({ googleClientId: env.GOOGLE_CLIENT_ID ?? null });
});

authRouter.post("/google", googleLimiter, async (req, res) => {
  const { credential } = z.object({ credential: z.string().min(1).max(4096) }).parse(req.body);
  const result = await resolveGoogleSignIn(await verifyGoogleCredential(credential));

  if (result.status === "link-required") {
    res.status(409).json({
      code: "google_link_required",
      error: "Já existe uma conta com este e-mail. Confirme a senha dela para vincular o Google.",
      email: result.email,
      linkToken: result.linkToken,
    });
    return;
  }
  await startSession(res, result.user.id);
  res.json({ user: publicUser(result.user) });
});

authRouter.post("/google/link", googleLinkLimiter, async (req, res) => {
  const body = z
    .object({ linkToken: z.string().min(1).max(200), password: z.string().min(1).max(1000) })
    .parse(req.body);
  const user = await confirmGoogleLink(body.linkToken, body.password);
  await startSession(res, user.id);
  res.json({ user: publicUser(user) });
});

authRouter.post("/forgot-password", forgotPasswordLimiter, forgotPasswordEmailLimiter, async (req, res) => {
  const body = z.object({ email }).parse(req.body);
  // Answer first and send in the background: same response and timing whether
  // or not the e-mail exists.
  res.status(202).json({
    message: "Se existir uma conta associada a este e-mail, enviaremos instruções para redefinição da senha.",
  });
  const sending = requestPasswordReset(body.email).catch((err: unknown) => {
    // Never log the token or the e-mail body
    console.error("[forgot-password] could not send e-mail:", err instanceof Error ? err.name : err);
  });
  // On Vercel the function is frozen once the response is sent; this keeps it
  // running until the e-mail is out. Elsewhere it does nothing.
  waitUntil(sending);
});

authRouter.post("/reset-password", resetPasswordLimiter, async (req, res) => {
  const body = z.object({ token: z.string().min(1).max(200), password }).parse(req.body);
  await resetPassword(body.token, body.password);
  clearSessionCookie(res);
  res.json({ message: "Senha redefinida. Entre com a nova senha." });
});
