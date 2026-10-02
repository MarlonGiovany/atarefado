// Google account matching/linking, Google-only accounts, hash migration and token
// storage. Uses the database directly plus the running dev server (no real Google
// login). Run from the server folder with `npm run dev` active: `npm run test:google`.
// Cleans up the users it creates.
import { pathToFileURL } from "node:url";
import path from "node:path";
import { readdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";

// Resolve packages from the server folder (this script lives outside it)
const bcrypt = createRequire(path.join(process.cwd(), "package.json"))("bcryptjs");

process.env.GOOGLE_CLIENT_ID ||= "1234567890-test.apps.googleusercontent.com";
const lib = (p: string) => pathToFileURL(path.join(process.cwd(), "src/lib", p)).href;
const { resolveGoogleSignIn, verifyGoogleCredential } = await import(lib("google.ts"));
const { prisma } = await import(lib("prisma.ts"));
const { hashToken } = await import(lib("tokens.ts"));

let ok = 0, fail = 0;
const check = (name: string, cond: boolean, extra = "") => {
  cond ? ok++ : fail++;
  console.log(`${cond ? "PASS" : "FAIL"} ${name} ${extra}`);
};
const status = async (p: Promise<unknown>) => p.then(() => 200, (e: { status?: number }) => e.status ?? -1);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const API = "http://localhost:3333/api";
const ORIGIN = "http://localhost:5173";
const post = async (p: string, body: object, cookie?: string) => {
  const r = await fetch(API + p, {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN, ...(cookie && { cookie }) },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  return { status: r.status, data: text ? JSON.parse(text) : null, cookie: r.headers.get("set-cookie")?.match(/atarefado_session=[^;]+/)?.[0] };
};

const stamp = Date.now();
const PW = "Ventilador-Azul-42";
const emails = [`g1-${stamp}@t.com`, `g2-${stamp}@t.com`, `g3-${stamp}@t.com`, `g4-${stamp}@t.com`, `g5-${stamp}@t.com`];

try {
  // --- New Google user
  const r1 = await resolveGoogleSignIn({ googleId: `sub-1-${stamp}`, email: emails[0], name: "Gi Um" });
  check("new Google user: account created without password",
    r1.status === "signed-in" && r1.user.passwordHash === null && r1.user.googleId === `sub-1-${stamp}`);
  const r1b = await resolveGoogleSignIn({ googleId: `sub-1-${stamp}`, email: emails[0], name: "Gi Um" });
  check("same Google id (sub) signs into the same user", r1b.status === "signed-in" && r1b.user.id === r1.user.id);
  const r1c = await resolveGoogleSignIn({ googleId: `sub-1-${stamp}`, email: `trocou-${stamp}@t.com`, name: "Outro" });
  check("identity follows sub, not e-mail (e-mail changed at Google)", r1c.status === "signed-in" && r1c.user.id === r1.user.id);

  // --- Existing password account with the same e-mail: never auto-link
  const reg = await post("/auth/register", { name: "Senha", email: emails[1], password: PW });
  const victimId = (await prisma.user.findUnique({ where: { email: emails[1] } }))!.id;
  const r2 = await resolveGoogleSignIn({ googleId: `sub-2-${stamp}`, email: emails[1], name: "Atacante" });
  const afterAttempt = await prisma.user.findUnique({ where: { id: victimId } });
  check("matching e-mail does NOT link automatically", r2.status === "link-required" && afterAttempt!.googleId === null);
  check("no duplicate account created", (await prisma.user.count({ where: { email: emails[1] } })) === 1);
  const linkToken = r2.status === "link-required" ? r2.linkToken : "";
  const stored = await prisma.googleLinkRequest.findFirst({ where: { userId: victimId } });
  check("link request stored as hash only", stored!.tokenHash === hashToken(linkToken) && stored!.tokenHash !== linkToken);

  const wrongPw = await post("/auth/google/link", { linkToken, password: "Senha-Errada-1" });
  check("link with wrong password -> 401, not linked",
    wrongPw.status === 401 && (await prisma.user.findUnique({ where: { id: victimId } }))!.googleId === null);
  const linked = await post("/auth/google/link", { linkToken, password: PW });
  check("link with the account's password -> session + linked",
    linked.status === 200 && !!linked.cookie && (await prisma.user.findUnique({ where: { id: victimId } }))!.googleId === `sub-2-${stamp}`);
  check("linking keeps password and name",
    (await prisma.user.findUnique({ where: { id: victimId } }))!.name === "Senha" && (await post("/auth/login", { email: emails[1], password: PW })).status === 200);
  check("link request is single-use", (await post("/auth/google/link", { linkToken, password: PW })).status === 400);
  const r2b = await resolveGoogleSignIn({ googleId: `sub-2-${stamp}`, email: emails[1], name: "x" });
  check("after linking, Google signs in directly", r2b.status === "signed-in" && r2b.user.id === victimId);

  // --- Link request expiry and attempt limit
  await post("/auth/register", { name: "Quatro", email: emails[3], password: PW });
  const r4 = await resolveGoogleSignIn({ googleId: `sub-4-${stamp}`, email: emails[3], name: "x" });
  const t4 = r4.status === "link-required" ? r4.linkToken : "";
  await prisma.googleLinkRequest.updateMany({ where: { tokenHash: hashToken(t4) }, data: { expiresAt: new Date(Date.now() - 1000) } });
  check("expired link request rejected", (await post("/auth/google/link", { linkToken: t4, password: PW })).status === 400);
  await post("/auth/register", { name: "Cinco", email: emails[4], password: PW });
  const r5 = await resolveGoogleSignIn({ googleId: `sub-5-${stamp}`, email: emails[4], name: "x" });
  const t5 = r5.status === "link-required" ? r5.linkToken : "";
  const tries: number[] = [];
  for (let i = 0; i < 6; i++) tries.push((await post("/auth/google/link", { linkToken: t5, password: `Errada-${i}-xyz` })).status);
  check("link request dies after 5 wrong passwords", tries.slice(0, 4).every((s) => s === 401) && tries.at(-1) !== 200, tries.join(","));
  check("...and the right password no longer links", (await post("/auth/google/link", { linkToken: t5, password: PW })).status !== 200);

  // --- E-mail linked to another Google account
  await prisma.user.create({ data: { name: "G3", email: emails[2], googleId: `sub-3-${stamp}` } });
  check("e-mail tied to a different Google sub -> 409",
    (await status(resolveGoogleSignIn({ googleId: `sub-X-${stamp}`, email: emails[2], name: "X" }))) === 409);

  // --- Google-only account: no enumeration, no reset link
  const wrongReal = await post("/auth/login", { email: emails[1], password: "Senha-Errada-2" });
  const googleOnly = await post("/auth/login", { email: emails[0], password: "Senha-Errada-2" });
  check("password login on Google-only account looks like any wrong password",
    googleOnly.status === 401 && googleOnly.data.error === wrongReal.data.error, googleOnly.data.error);
  const regTaken = await post("/auth/register", { name: "X", email: emails[0], password: PW });
  check("sign-up message doesn't reveal the account is Google-only", regTaken.status === 409 && !/google/i.test(regTaken.data.error));
  const since = Date.now();
  const forgot = await post("/auth/forgot-password", { email: emails[0] });
  let notice: { text: string } | null = null;
  for (let i = 0; i < 40 && !notice; i++) {
    const dir = path.join(process.cwd(), ".mail-outbox");
    for (const f of (await readdir(dir).catch(() => [])).filter((n) => n.endsWith(".json")).sort().reverse()) {
      const mail = JSON.parse(await readFile(path.join(dir, f), "utf8"));
      if (mail.to === emails[0] && Date.parse(mail.date) >= since) { notice = mail; break; }
    }
    if (!notice) await sleep(100);
  }
  check("forgot on Google-only: same generic response", forgot.status === 202);
  check("forgot on Google-only: e-mail explains Google login, no reset link",
    !!notice && /Google/.test(notice.text) && !notice.text.includes("#token="));
  check("forgot on Google-only: no reset token created",
    (await prisma.passwordResetToken.count({ where: { user: { email: emails[0] } } })) === 0);
  check("Google-only account keeps no password", (await prisma.user.findUnique({ where: { email: emails[0] } }))!.passwordHash === null);

  // --- Hash migration: old cost-10 hash upgraded to cost 12 on login
  const legacyEmail = `legacy-${stamp}@t.com`;
  await prisma.user.create({ data: { name: "Legado", email: legacyEmail, passwordHash: bcrypt.hashSync(PW, 10) } });
  const legacyLogin = await post("/auth/login", { email: legacyEmail, password: PW });
  const upgraded = (await prisma.user.findUnique({ where: { email: legacyEmail } }))!.passwordHash!;
  check("legacy cost-10 hash still logs in", legacyLogin.status === 200);
  check("hash upgraded to cost 12 after login", bcrypt.getRounds(upgraded) === 12 && bcrypt.compareSync(PW, upgraded));
  emails.push(legacyEmail);

  // --- Sessions and reset tokens are stored only as hashes
  const sessionToken = decodeURIComponent(reg.cookie!.split("=")[1]);
  check("session stored as hash, not raw token",
    (await prisma.session.count({ where: { tokenHash: sessionToken } })) === 0 &&
    (await prisma.session.count({ where: { tokenHash: hashToken(sessionToken) } })) === 1);
  const passwords = await prisma.user.findMany({ where: { passwordHash: { not: null } }, select: { passwordHash: true } });
  check("every stored password is a bcrypt hash", passwords.every((u) => /^\$2[aby]\$\d{2}\$.{53}$/.test(u.passwordHash!)), `${passwords.length} users`);

  // --- Google-only account creating a password (needs a recent login)
  const { newToken } = await import(lib("tokens.ts"));
  const sessionFor = async (userId: string, ageMinutes: number) => {
    const token = newToken();
    await prisma.session.create({
      data: {
        tokenHash: hashToken(token), userId,
        createdAt: new Date(Date.now() - ageMinutes * 60_000),
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    return `atarefado_session=${token}`;
  };
  const put = async (body: object, cookie: string) => {
    const r = await fetch(API + "/account/password", {
      method: "PUT", headers: { "content-type": "application/json", origin: ORIGIN, cookie }, body: JSON.stringify(body),
    });
    return { status: r.status, data: await r.json() };
  };
  const googleUserId = r1.status === "signed-in" ? r1.user.id : "";
  const oldSession = await sessionFor(googleUserId, 30);
  const stale = await put({ newPassword: "Primeira-Senha-Local-1" }, oldSession);
  check("Google-only: creating a password with an old session -> 403 recent_login_required",
    stale.status === 403 && stale.data.code === "recent_login_required", stale.data.error);
  const otherDevice = await sessionFor(googleUserId, 60);
  const fresh = await sessionFor(googleUserId, 1);
  const created = await put({ newPassword: "Primeira-Senha-Local-1" }, fresh);
  check("Google-only: creating a password right after login works", created.status === 200, created.data.message);
  check("password created as bcrypt hash and Google still linked", await (async () => {
    const u = (await prisma.user.findUnique({ where: { id: googleUserId } }))!;
    return !!u.passwordHash && bcrypt.compareSync("Primeira-Senha-Local-1", u.passwordHash) && u.googleId === `sub-1-${stamp}`;
  })());
  const me = async (cookie: string) => (await fetch(API + "/auth/me", { headers: { cookie } })).status;
  check("other sessions signed out after creating a password", (await me(otherDevice)) === 401 && (await me(fresh)) === 200);

  // --- Sign-up stores only a hash; the original password can't be read back
  const plainEmail = `plain-${stamp}@t.com`;
  const PLAIN = "Original-Nao-Recuperavel-7";
  await post("/auth/register", { name: "Plain", email: plainEmail, password: PLAIN });
  emails.push(plainEmail);
  const plainRow = (await prisma.user.findUnique({ where: { email: plainEmail } }))!;
  check("sign-up: password stored as bcrypt hash, never in plain text",
    plainRow.passwordHash !== PLAIN && !plainRow.passwordHash!.includes(PLAIN) && /^\$2[aby]\$12\$/.test(plainRow.passwordHash!));
  check("sign-up: no column anywhere holds the plain password",
    !JSON.stringify(await prisma.user.findMany({ where: { email: plainEmail } })).includes(PLAIN));

  // --- Session expiry
  const expiring = await sessionFor(plainRow.id, 1);
  check("session valid before expiry", (await me(expiring)) === 200);
  await prisma.session.updateMany({
    where: { tokenHash: hashToken(expiring.split("=")[1]) },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
  check("expired session -> 401", (await me(expiring)) === 401);
  check("expired session removed from the database",
    (await prisma.session.count({ where: { tokenHash: hashToken(expiring.split("=")[1]) } })) === 0);

  // --- Expired password reset token
  const resetSince = Date.now();
  await post("/auth/forgot-password", { email: plainEmail });
  let resetToken: string | undefined;
  for (let i = 0; i < 40 && !resetToken; i++) {
    const dir = path.join(process.cwd(), ".mail-outbox");
    for (const f of (await readdir(dir).catch(() => [])).filter((n) => n.endsWith(".json")).sort().reverse()) {
      const mail = JSON.parse(await readFile(path.join(dir, f), "utf8"));
      if (mail.to === plainEmail && Date.parse(mail.date) >= resetSince) {
        resetToken = mail.text.match(/#token=([A-Za-z0-9_-]+)/)?.[1];
        break;
      }
    }
    if (!resetToken) await sleep(100);
  }
  check("reset token stored only as hash",
    !!resetToken && (await prisma.passwordResetToken.count({ where: { tokenHash: resetToken } })) === 0 &&
    (await prisma.passwordResetToken.count({ where: { tokenHash: hashToken(resetToken!) } })) === 1);
  await prisma.passwordResetToken.updateMany({
    where: { tokenHash: hashToken(resetToken!) },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
  const expiredReset = await post("/auth/reset-password", { token: resetToken!, password: "Nova-Senha-Expirada-3" });
  check("expired reset token -> 400", expiredReset.status === 400, expiredReset.data.error);
  check("password unchanged after expired token", (await post("/auth/login", { email: plainEmail, password: PLAIN })).status === 200);

  // --- Token verification
  check("garbage Google token -> 401", (await status(verifyGoogleCredential("not-a-jwt"))) === 401);
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const forged = [
    b64({ alg: "RS256", kid: "forged", typ: "JWT" }),
    b64({
      iss: "https://accounts.google.com", aud: process.env.GOOGLE_CLIENT_ID, sub: "attacker",
      email: emails[1], email_verified: true,
      iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600,
    }),
    Buffer.from("fake-signature").toString("base64url"),
  ].join(".");
  check("forged Google token with valid-looking claims -> 401", (await status(verifyGoogleCredential(forged))) === 401);
  check("forged token over HTTP -> 401", (await post("/auth/google", { credential: forged })).status === 401);
} finally {
  const extra = [`trocou-${stamp}@t.com`];
  await prisma.board.deleteMany({ where: { members: { some: { role: "OWNER", user: { email: { in: [...emails, ...extra] } } } } } });
  await prisma.user.deleteMany({ where: { email: { in: [...emails, ...extra] } } });
  await prisma.$disconnect();
}

console.log(`\n${ok} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
