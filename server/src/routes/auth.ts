import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { env } from "../lib/env.js";
import { findOrCreateGoogleUser, verifyGoogleCredential } from "../lib/google.js";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http-error.js";
import { currentUser, requireAuth, signToken } from "../middleware/auth.js";

export const authRouter = Router();

const publicUser = { id: true, name: true, email: true } as const;

const registerSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.email().toLowerCase(),
  password: z.string().min(8).max(128),
});

const loginSchema = z.object({
  email: z.email().toLowerCase(),
  password: z.string().min(1),
});

authRouter.post("/register", async (req, res) => {
  const { name, email, password } = registerSchema.parse(req.body);

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists && !exists.passwordHash) {
    throw new HttpError(409, "Este e-mail já tem uma conta. Use “Continuar com o Google”.");
  }
  if (exists) throw new HttpError(409, "Este e-mail já está em uso");

  const user = await prisma.user.create({
    data: { name, email, passwordHash: await bcrypt.hash(password, 10) },
    select: publicUser,
  });

  res.status(201).json({ token: signToken(user.id), user });
});

authRouter.post("/login", async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { email } });
  if (user && !user.passwordHash) {
    throw new HttpError(401, "Esta conta entra com o Google. Use “Continuar com o Google”.");
  }
  const valid = user?.passwordHash && (await bcrypt.compare(password, user.passwordHash));
  if (!user || !valid) throw new HttpError(401, "E-mail ou senha inválidos");

  res.json({
    token: signToken(user.id),
    user: { id: user.id, name: user.name, email: user.email },
  });
});

/** Tells the client whether to show "Sign in with Google" (the client id is public). */
authRouter.get("/config", (_req, res) => {
  res.json({ googleClientId: env.GOOGLE_CLIENT_ID ?? null });
});

authRouter.post("/google", async (req, res) => {
  const { credential } = z.object({ credential: z.string().min(1).max(4096) }).parse(req.body);
  const user = await findOrCreateGoogleUser(await verifyGoogleCredential(credential));

  res.json({
    token: signToken(user.id),
    user: { id: user.id, name: user.name, email: user.email },
  });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: currentUser(req) },
    select: publicUser,
  });
  if (!user) throw new HttpError(401, "Usuário não encontrado");
  res.json({ user });
});
