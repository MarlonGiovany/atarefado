import bcrypt from "bcryptjs";
import { HttpError } from "./http-error.js";

// bcrypt work factor. Hashes made with a lower cost are upgraded on the next login.
const BCRYPT_COST = 12;

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 64;
// bcrypt only uses the first 72 bytes of the input; longer passwords would be
// silently truncated, so they are rejected instead.
const BCRYPT_MAX_BYTES = 72;

// Compared against when the account doesn't exist (or has no password), so the
// response takes as long as a real check and doesn't reveal which e-mails exist.
const DUMMY_HASH = bcrypt.hashSync("atarefado-timing-equalizer", BCRYPT_COST);

export function hashPassword(password: string) {
  return bcrypt.hash(password, BCRYPT_COST);
}

/** Constant-work check: always runs bcrypt, even without a stored hash. */
export async function verifyPassword(password: string, hash: string | null | undefined) {
  const matches = await bcrypt.compare(password, hash ?? DUMMY_HASH);
  return Boolean(hash) && matches;
}

export function needsRehash(hash: string) {
  return bcrypt.getRounds(hash) < BCRYPT_COST;
}

// A short list of the most used passwords (international and Brazilian) that
// attackers try first. Not exhaustive; it blocks the obvious ones.
const COMMON_PASSWORDS = new Set([
  "12345678", "123456789", "1234567890", "12345678910", "123123123", "11111111",
  "00000000", "88888888", "87654321", "11223344", "12341234", "123321123",
  "password", "password1", "password123", "passw0rd", "qwerty123", "qwertyuiop",
  "iloveyou", "sunshine", "princess", "football", "baseball", "superman",
  "starwars", "whatever", "trustno1", "letmein1", "welcome1", "admin123",
  "administrator", "abc12345", "abcd1234", "1q2w3e4r", "1q2w3e4r5t", "q1w2e3r4",
  "zaq12wsx", "asdfghjk", "asdf1234", "senha123", "senha1234", "senha12345",
  "minhasenha", "mudar123", "mudar1234", "brasil123", "brasil2026", "flamengo",
  "flamengo123", "corinthians", "palmeiras", "saopaulo", "gremio123", "vasco123",
  "botafogo", "cruzeiro", "internacional", "santos123", "amor1234", "teamo123",
  "eusouodono", "deusefiel", "jesus123", "jesuscristo", "familia123", "felicidade",
  "abacaxi123", "naruto123", "pokemon123", "minecraft", "batman123", "dragonball",
  "atarefado", "atarefado123", "taskflow", "taskflow123",
]);

type PolicyOptions = {
  email?: string;
  /** Current hash, to reject a new password equal to the old one */
  currentHash?: string | null;
};

/**
 * Password rules for new passwords (sign-up, reset, change). Kept simple on
 * purpose: length plus a block on obvious choices, no composition rules.
 * Throws an HttpError with a message the user can act on.
 */
export async function assertPasswordPolicy(password: string, options: PolicyOptions = {}) {
  const length = [...password].length; // counts emoji/accents as one character
  if (length === 0) throw new HttpError(400, "Digite uma senha.");
  if (length < PASSWORD_MIN_LENGTH) {
    throw new HttpError(400, `A senha precisa ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`);
  }
  if (length > PASSWORD_MAX_LENGTH || Buffer.byteLength(password, "utf8") > BCRYPT_MAX_BYTES) {
    throw new HttpError(400, `A senha pode ter no máximo ${PASSWORD_MAX_LENGTH} caracteres.`);
  }
  const normalized = password.toLowerCase();
  if (COMMON_PASSWORDS.has(normalized)) {
    throw new HttpError(400, "Essa senha é muito comum e fácil de adivinhar. Escolha outra.");
  }
  if (options.email) {
    const email = options.email.toLowerCase();
    if (normalized === email || normalized === email.split("@")[0]) {
      throw new HttpError(400, "A senha não pode ser igual ao seu e-mail.");
    }
  }
  if (options.currentHash && (await bcrypt.compare(password, options.currentHash))) {
    throw new HttpError(400, "A nova senha precisa ser diferente da senha atual.");
  }
}
