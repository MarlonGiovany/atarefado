import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
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
  if (exists) throw new HttpError(409, "Email already in use");

  const user = await prisma.user.create({
    data: { name, email, passwordHash: await bcrypt.hash(password, 10) },
    select: publicUser,
  });

  res.status(201).json({ token: signToken(user.id), user });
});

authRouter.post("/login", async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { email } });
  const valid = user && (await bcrypt.compare(password, user.passwordHash));
  if (!user || !valid) throw new HttpError(401, "Invalid email or password");

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
  if (!user) throw new HttpError(401, "User no longer exists");
  res.json({ user });
});
