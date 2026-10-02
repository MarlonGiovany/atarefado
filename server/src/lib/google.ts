import { OAuth2Client } from "google-auth-library";
import { env } from "./env.js";
import { prisma } from "./prisma.js";
import { HttpError } from "./http-error.js";

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

/**
 * Finds the user for a Google profile: by Google id first, then by e-mail, linking
 * Google to an existing password account (safe because Google verified the e-mail).
 * Otherwise creates a new account without a password.
 */
export async function findOrCreateGoogleUser(profile: GoogleProfile) {
  const linked = await prisma.user.findUnique({ where: { googleId: profile.googleId } });
  if (linked) return linked;

  const sameEmail = await prisma.user.findUnique({ where: { email: profile.email } });
  if (sameEmail) {
    if (sameEmail.googleId) {
      throw new HttpError(409, "Este e-mail já está vinculado a outra conta Google");
    }
    return prisma.user.update({
      where: { id: sameEmail.id },
      data: { googleId: profile.googleId },
    });
  }

  return prisma.user.create({
    data: { name: profile.name, email: profile.email, googleId: profile.googleId },
  });
}
