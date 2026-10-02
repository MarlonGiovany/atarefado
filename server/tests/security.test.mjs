// Security checks against the running dev server (sessions, cookies, CSRF,
// enumeration, lockout, password policy, password reset, access control).
// Run from the server folder with `npm run dev` active: `npm run test:security`.
// Needs development mode without SMTP (reads reset links from .mail-outbox).
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const SERVER_DIR = process.argv[2] ?? process.cwd();
const OUTBOX = path.join(SERVER_DIR, ".mail-outbox");
const B = "http://localhost:3333/api";
const ORIGIN = "http://localhost:5173";
const stamp = Date.now();
const PW = "Ventilador-Azul-42";
let ok = 0, fail = 0;
const check = (name, cond, extra = "") => {
  cond ? ok++ : fail++;
  console.log(`${cond ? "PASS" : "FAIL"} ${name} ${extra}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(method, p, body, session, headers = { origin: ORIGIN }) {
  const r = await fetch(B + p, {
    method,
    headers: { "content-type": "application/json", ...headers, ...(session && { cookie: session }) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  const setCookie = r.headers.get("set-cookie") ?? "";
  return {
    status: r.status,
    data: text ? JSON.parse(text) : null,
    raw: text,
    setCookie,
    cookie: setCookie.match(/atarefado_session=[^;]+/)?.[0],
  };
}
const register = (name, email, password = PW) => call("POST", "/auth/register", { name, email, password });
const login = (email, password = PW) => call("POST", "/auth/login", { email, password });

/** Newest dev-outbox e-mail sent to `to` after `since` (waits for the async send). */
async function latestMail(to, since) {
  for (let i = 0; i < 40; i++) {
    const files = (await readdir(OUTBOX).catch(() => [])).filter((f) => f.endsWith(".json")).sort();
    for (const f of files.reverse()) {
      const mail = JSON.parse(await readFile(path.join(OUTBOX, f), "utf8"));
      if (mail.to === to && Date.parse(mail.date) >= since) return mail;
    }
    await sleep(100);
  }
  return null;
}
const tokenFrom = (mail) => mail?.text.match(/#token=([A-Za-z0-9_-]+)/)?.[1];

// ---------------------------------------------------------------- sessions/cookies
const u1 = `sec-a-${stamp}@t.com`;
const reg = await register("Seg A", u1);
check("register sets a session cookie", reg.status === 201 && !!reg.cookie);
check("cookie is HttpOnly", /HttpOnly/i.test(reg.setCookie));
check("cookie is SameSite=Lax", /SameSite=Lax/i.test(reg.setCookie));
check("cookie scoped to /api", /Path=\/api/i.test(reg.setCookie));
check("no token in JSON body", reg.data.token === undefined && !reg.raw.includes(reg.cookie.split("=")[1]));
check("no password data in responses", !/password/i.test(reg.raw) && !/password/i.test((await call("GET", "/auth/me", null, reg.cookie)).raw.replace(/hasPassword/g, "")));
check("garbage cookie -> 401", (await call("GET", "/auth/me", null, "atarefado_session=forjado")).status === 401);

const s1 = (await login(u1)).cookie;
const s2 = (await login(u1)).cookie;
check("each login creates a new session", s1 && s2 && s1 !== s2 && s1 !== reg.cookie);
const out = await call("POST", "/auth/logout", null, s1);
check("logout -> 204 and clears cookie", out.status === 204 && /atarefado_session=;/.test(out.setCookie));
check("logged-out session is invalid server-side", (await call("GET", "/auth/me", null, s1)).status === 401);
check("other session still valid", (await call("GET", "/auth/me", null, s2)).status === 200);
await call("POST", "/auth/logout-all", null, s2);
check("logout-all invalidates every session",
  (await call("GET", "/auth/me", null, s2)).status === 401 && (await call("GET", "/auth/me", null, reg.cookie)).status === 401);

// ---------------------------------------------------------------- CSRF
const s3 = (await login(u1)).cookie;
check("POST without Origin -> 403", (await call("POST", "/boards", { title: "x" }, s3, {})).status === 403);
check("POST from another site -> 403", (await call("POST", "/boards", { title: "x" }, s3, { origin: "https://evil.example" })).status === 403);
check("DELETE from another site -> 403", (await call("DELETE", "/boards/qualquer", null, s3, { origin: "https://evil.example" })).status === 403);
check("POST with same-site Referer only -> allowed", (await call("POST", "/boards", { title: "via referer" }, s3, { referer: ORIGIN + "/" })).status === 201);
check("GET without Origin still works", (await call("GET", "/boards", null, s3, {})).status === 200);
check("login from another site -> 403", (await call("POST", "/auth/login", { email: u1, password: PW }, null, { origin: "https://evil.example" })).status === 403);

// ---------------------------------------------------------------- enumeration & lockout
const ghost = `nao-existe-${stamp}@t.com`;
const wrong = await login(u1, "Senha-Errada-99");
const unknown = await login(ghost, "Senha-Errada-99");
check("same status/message for wrong password and unknown e-mail",
  wrong.status === 401 && unknown.status === 401 && wrong.data.error === unknown.data.error, wrong.data.error);
const t0 = performance.now(); await login(u1, "Senha-Errada-98"); const tWrong = performance.now() - t0;
const t1 = performance.now(); await login(ghost, "Senha-Errada-98"); const tUnknown = performance.now() - t1;
check("unknown e-mail takes comparable time (bcrypt still runs)", tUnknown > tWrong * 0.5, `${Math.round(tUnknown)}ms vs ${Math.round(tWrong)}ms`);
// u1 now has 2 failures in the window; 3 more reach the limit of 5
await login(u1, "Senha-Errada-97"); await login(u1, "Senha-Errada-96"); await login(u1, "Senha-Errada-95");
const locked = await login(u1); // correct password, but locked
check("account locked after 5 wrong passwords (even with the right one)", locked.status === 429, locked.data.error);
const ghostTries = [];
for (let i = 0; i < 6; i++) ghostTries.push((await login(ghost, "Senha-Errada-0" + i)).status);
check("unknown e-mails lock the same way (no enumeration)", ghostTries.at(-1) === 429, ghostTries.join(","));

// ---------------------------------------------------------------- password policy
const pol = async (password, label) => {
  const r = await register("Pol", `pol-${label}-${stamp}@t.com`, password);
  return { status: r.status, error: r.data?.error };
};
let r;
r = await pol("", "empty"); check("empty password rejected", r.status === 400, r.error);
r = await pol("Abc-123", "short"); check("7 chars rejected", r.status === 400, r.error);
r = await pol("12345678", "common"); check("common password rejected", r.status === 400, r.error);
r = await pol("Senha123", "common2"); check("common password (case-insensitive) rejected", r.status === 400, r.error);
r = await pol("a".repeat(65), "long"); check("65 chars rejected", r.status === 400, r.error);
r = await pol("🔒".repeat(20), "bytes"); check(">72 bytes rejected (bcrypt limit)", r.status === 400, r.error);
r = await register("Pol", `pol-same-${stamp}@t.com`, `pol-same-${stamp}`); check("password equal to e-mail name rejected", r.status === 400, r.data?.error);
r = await pol("Çàfé #2026 — ünïcode!", "special"); check("special characters and spaces allowed", r.status === 201);
r = await pol("x".repeat(9) + "Y".repeat(55), "max"); check("64 chars accepted", r.status === 201);

// ---------------------------------------------------------------- forgot / reset password
const u2 = `sec-b-${stamp}@t.com`;
const reg2 = await register("Seg B", u2);
const sessB = (await login(u2)).cookie;
const generic = "Se existir uma conta associada a este e-mail, enviaremos instruções para redefinição da senha.";
let since = Date.now();
const f1 = await call("POST", "/auth/forgot-password", { email: u2 });
const fUnknown = await call("POST", "/auth/forgot-password", { email: `ninguem-${stamp}@t.com` });
check("forgot: generic 202 for existing e-mail", f1.status === 202 && f1.data.message === generic);
check("forgot: identical response for unknown e-mail", fUnknown.status === 202 && fUnknown.data.message === generic);
const mail1 = await latestMail(u2, since);
const token1 = tokenFrom(mail1);
check("reset e-mail sent with link in URL fragment", !!token1 && mail1.text.includes("/redefinir-senha#token="));
check("token is long and random (>= 43 chars base64url)", token1?.length >= 43, `${token1?.length} chars`);
check("e-mail never contains a password", !/password|senha atual/i.test(mail1.text.replace(/redefinir-senha/g, "")));
since = Date.now();
await call("POST", "/auth/forgot-password", { email: u2 });
const token2 = tokenFrom(await latestMail(u2, since));
check("new request issues a different token", token2 && token2 !== token1);
check("previous token invalidated by new request", (await call("POST", "/auth/reset-password", { token: token1, password: "Outra-Senha-Nova-1" })).status === 400);
const sameAsOld = await call("POST", "/auth/reset-password", { token: token2, password: PW });
check("reset rejects the current password", sameAsOld.status === 400, sameAsOld.data.error);
check("reset rejects weak password", (await call("POST", "/auth/reset-password", { token: token2, password: "12345678" })).status === 400);
const NEW_PW = "Girassol-Laranja-77";
const done = await call("POST", "/auth/reset-password", { token: token2, password: NEW_PW });
check("reset succeeds", done.status === 200, done.data.message);
check("reset is single-use", (await call("POST", "/auth/reset-password", { token: token2, password: "Mais-Uma-Senha-55" })).status === 400);
check("sessions invalidated after reset",
  (await call("GET", "/auth/me", null, sessB)).status === 401 && (await call("GET", "/auth/me", null, reg2.cookie)).status === 401);
check("old password no longer works", (await login(u2, PW)).status === 401);
const after = await login(u2, NEW_PW);
check("new password works", after.status === 200);
check("forged token rejected", (await call("POST", "/auth/reset-password", { token: "a".repeat(43), password: "Valida-Senha-123" })).status === 400);
const flood = [];
for (let i = 0; i < 4; i++) flood.push((await call("POST", "/auth/forgot-password", { email: `flood-${stamp}@t.com` })).status);
check("forgot-password limited per e-mail (3/hour)", flood.join(",") === "202,202,202,429", flood.join(","));

// ---------------------------------------------------------------- change password
const sB1 = after.cookie;
const sB2 = (await login(u2, NEW_PW)).cookie;
check("change password requires auth", (await call("PUT", "/account/password", { newPassword: "Qualquer-Coisa-1" })).status === 401);
check("change password requires current password", (await call("PUT", "/account/password", { newPassword: "Nova-Senha-Forte-2" }, sB1)).status === 400);
check("change password rejects wrong current", (await call("PUT", "/account/password", { currentPassword: "errada-errada", newPassword: "Nova-Senha-Forte-2" }, sB1)).status === 400);
check("change password rejects same password", (await call("PUT", "/account/password", { currentPassword: NEW_PW, newPassword: NEW_PW }, sB1)).status === 400);
const changed = await call("PUT", "/account/password", { currentPassword: NEW_PW, newPassword: "Nova-Senha-Forte-2" }, sB1);
check("change password succeeds", changed.status === 200, changed.data.message);
check("current session kept, other sessions revoked",
  (await call("GET", "/auth/me", null, sB1)).status === 200 && (await call("GET", "/auth/me", null, sB2)).status === 401);

// ---------------------------------------------------------------- access control (IDOR)
const owner = (await register("Dono", `dono-${stamp}@t.com`)).cookie;
const member = await register("Membro", `membro-${stamp}@t.com`);
const outsider = (await register("Intruso", `intruso-${stamp}@t.com`)).cookie;
const board = (await call("POST", "/boards", { title: "Privado" }, owner)).data.board;
const cols = (await call("GET", `/boards/${board.id}`, null, owner)).data.board.columns;
const card = (await call("POST", `/columns/${cols[0].id}/cards`, { title: "segredo", date: "2026-10-02" }, owner)).data.card;
await call("POST", `/boards/${board.id}/members`, { email: `membro-${stamp}@t.com` }, owner);
check("outsider can't rename board", (await call("PATCH", `/boards/${board.id}`, { title: "hack" }, outsider)).status === 404);
check("outsider can't delete board", (await call("DELETE", `/boards/${board.id}`, null, outsider)).status === 404);
check("outsider can't add column", (await call("POST", `/boards/${board.id}/columns`, { title: "x" }, outsider)).status === 404);
check("outsider can't rename column", (await call("PATCH", `/columns/${cols[0].id}`, { title: "x" }, outsider)).status === 404);
check("outsider can't delete column", (await call("DELETE", `/columns/${cols[0].id}`, null, outsider)).status === 404);
check("outsider can't add card", (await call("POST", `/columns/${cols[0].id}/cards`, { title: "x" }, outsider)).status === 404);
check("outsider can't move card", (await call("POST", `/cards/${card.id}/move`, { columnId: cols[1].id, position: 1 }, outsider)).status === 404);
check("outsider can't reschedule card", (await call("POST", `/boards/${board.id}/cards/reschedule`, { cards: [{ id: card.id, date: "2026-01-01" }] }, outsider)).status === 404);
check("outsider can't add self as member", (await call("POST", `/boards/${board.id}/members`, { email: `intruso-${stamp}@t.com` }, outsider)).status === 404);
check("outsider can't carry over pending", (await call("POST", `/boards/${board.id}/pending/move`, { to: "2026-10-03" }, outsider)).status === 404);
check("member can't delete board (owner only)", (await call("DELETE", `/boards/${board.id}`, null, member.cookie)).status === 403);
check("member can't remove owner", (await call("DELETE", `/boards/${board.id}/members/${(await call("GET", "/auth/me", null, owner)).data.user.id}`, null, member.cookie)).status === 403);
check("board data doesn't leak password fields", !/password/i.test((await call("GET", `/boards/${board.id}`, null, member.cookie)).raw));
const big = await fetch(B + "/boards", { method: "POST", headers: { "content-type": "application/json", origin: ORIGIN, cookie: owner }, body: JSON.stringify({ title: "x".repeat(200_000) }) });
check("oversized body rejected (413)", big.status === 413);
const broken = await fetch(B + "/auth/login", { method: "POST", headers: { "content-type": "application/json", origin: ORIGIN }, body: "{not json" });
check("malformed JSON -> 400, not 500", broken.status === 400);

console.log(`\n${ok} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
