import { createHash, randomBytes } from "node:crypto";

/** 256-bit random token from the OS CSPRNG, safe to put in URLs and cookies. */
export function newToken() {
  return randomBytes(32).toString("base64url");
}

/**
 * What we store instead of the token itself. The tokens are long and random, so a
 * fast hash is enough: nothing usable is kept in the database.
 */
export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
