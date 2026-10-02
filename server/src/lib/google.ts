import { OAuth2Client } from "google-auth-library";
import type { User } from "../generated/prisma/client.js";
import { env } from "./env.js";
import { prisma } from "./prisma.js";
import { HttpError } from "./http-error.js";
import { verifyPassword } from "./passwords.js";
import { assertNotLockedOut, clearFailedLogins, recordFailedLogin } from "./rateLimit.js";
import { hashToken, newToken } from "./tokens.js";

const client = env.GOOGLE_CLIENT_ID ? new OAuth2Client(env.GOOGLE_CLIENT_ID) : null;

export type GoogleProfile = { googleId: string; email: string; name: string };

/**
 * Checks the ID token sent by Google's "Sign in with Google" button: signature,
 * expiry, issuer and that it was issued for our client id.
 */
export async function verifyGoogleCredential(credential: string): Promise<GoogleProfile> {
  if (!client || !env.GOOGLE_CLIENT_ID) {
    throw new HttpError(503, "O login com Google não está configurado");
  }

  let payload;
  try {
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch {
    throw new HttpError(401, "Não foi possível validar o login com Google");
  }

  if (!payload?.sub || !payload.email || !payload.email_verified) {
    throw new HttpError(401, "A conta Google precisa ter um e-mail verificado");
  }
  const email = payload.email.toLowerCase();
  return {
    googleId: payload.sub,
    email,
    name: (payload.name?.trim() || email.split("@")[0]).slice(0, 80),
  };
}

const LINK_REQUEST_TTL_MS = 10 * 60_000;
const MAX_LINK_ATTEMPTS = 5;

export type GoogleSignInResult =
  | { status: "signed-in"; user: User }
  | { status: "link-required"; linkToken: string; email: string };

/**
 * Resolves a verified Google profile to a user. The Google identity is matched by
 * its stable id (`sub`), never by name or e-mail alone:
 * - already linked: sign in;
 * - no account with that e-mail: create one without a password;
 * - an existing password account has that e-mail: don't link yet. Return a
 *   short-lived link request that needs that account's password
 *   (confirmGoogleLink), so controlling an e-mail address at Google isn't enough
 *   to take over an account here.
 */
export async function resolveGoogleSignIn(profile: GoogleProfile): Promise<GoogleSignInResult> {
  const linked = await prisma.user.findUnique({ where: { googleId: profile.googleId } });
  if (linked) return { status: "signed-in", user: linked };

  const sameEmail = await prisma.user.findUnique({ where: { email: profile.email } });
  if (!sameEmail) {
    const user = await prisma.user.create({
      data: { name: profile.name, email: profile.email, googleId: profile.googleId },
    });
    return { status: "signed-in", user };
  }

  // Linked to a different Google account (or, defensively, no way to verify ownership)
  if (sameEmail.googleId || !sameEmail.passwordHash) {
    throw new HttpError(409, "Não foi possível entrar com esta conta Google.");
  }

  const linkToken = newToken();
  await prisma.googleLinkRequest.deleteMany({ where: { userId: sameEmail.id } });
  await prisma.googleLinkRequest.create({
    data: {
      tokenHash: hashToken(linkToken),
      userId: sameEmail.id,
      googleId: profile.googleId,
      expiresAt: new Date(Date.now() + LINK_REQUEST_TTL_MS),
    },
  });
  return { status: "link-required", linkToken, email: sameEmail.email };
}

/** Links Google to the existing account once its password is confirmed. */
export async function confirmGoogleLink(linkToken: string, password: string) {
  const request = await prisma.googleLinkRequest.findUnique({
    where: { tokenHash: hashToken(linkToken) },
    include: { user: true },
  });
  if (!request || request.expiresAt <= new Date()) {
    throw new HttpError(400, "O pedido de vínculo expirou. Entre com o Google novamente.");
  }

  const { user } = request;
  await assertNotLockedOut(user.email);
  if (!(await verifyPassword(password, user.passwordHash))) {
    await recordFailedLogin(user.email);
    if (request.attempts + 1 >= MAX_LINK_ATTEMPTS) {
      await prisma.googleLinkRequest.delete({ where: { id: request.id } });
    } else {
      await prisma.googleLinkRequest.update({
        where: { id: request.id },
        data: { attempts: { increment: 1 } },
      });
    }
    throw new HttpError(401, "Senha incorreta.");
  }

  const takenBy = await prisma.user.findUnique({ where: { googleId: request.googleId } });
  if (user.googleId || (takenBy && takenBy.id !== user.id)) {
    await prisma.googleLinkRequest.delete({ where: { id: request.id } });
    throw new HttpError(409, "Não foi possível vincular esta conta Google.");
  }

  await clearFailedLogins(user.email);
  const [linked] = await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { googleId: request.googleId } }),
    prisma.googleLinkRequest.deleteMany({ where: { userId: user.id } }),
  ]);
  return linked;
}
