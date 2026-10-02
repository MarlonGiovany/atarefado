// Serverless readiness: rate limits and lockouts must hold across server
// instances (on Vercel each function instance has its own memory), and the
// security headers Vercel adds to the static pages must match helmet's.
// Run from the server folder with `npm run dev` active: `npm run test:serverless`.
// This script starts a second, independent instance of the API in-process.
import type { AddressInfo } from "node:net";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const src = (p: string) => pathToFileURL(path.join(process.cwd(), "src", p)).href;
const { app } = await import(src("app.ts"));
const { prisma } = await import(src("lib/prisma.ts"));
const { hashToken } = await import(src("lib/tokens.ts"));

let ok = 0, fail = 0;
const check = (name: string, cond: boolean, extra = "") => {
  cond ? ok++ : fail++;
  console.log(`${cond ? "PASS" : "FAIL"} ${name} ${extra}`);
};

const ORIGIN = "http://localhost:5173";
const A = "http://localhost:3333/api"; // the dev server
const second = app.listen(0);
await new Promise((r) => second.once("listening", r));
const B = `http://localhost:${(second.address() as AddressInfo).port}/api`; // another instance

const post = async (base: string, p: string, body: object) => {
  const r = await fetch(base + p, {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN },
    body: JSON.stringify(body),
  });
  return { status: r.status, data: await r.json().catch(() => null) };
};

const stamp = Date.now();
const PW = "Ventilador-Azul-42";

try {
  // --- Account lockout is shared between instances
  const email = `sl-${stamp}@t.com`;
  await post(A, "/auth/register", { name: "Serverless", email, password: PW });
  const statuses: number[] = [];
  for (let i = 0; i < 5; i++) {
    // Alternate instances: each one alone sees fewer than 5 failures
    statuses.push((await post(i % 2 ? B : A, "/auth/login", { email, password: "Senha-Errada-" + i })).status);
  }
  check("wrong passwords counted on both instances", statuses.join(",") === "401,401,401,401,401", statuses.join(","));
  const lockedA = await post(A, "/auth/login", { email, password: PW });
  const lockedB = await post(B, "/auth/login", { email, password: PW });
  check("lockout applies on every instance", lockedA.status === 429 && lockedB.status === 429, `${lockedA.status}/${lockedB.status}`);

  // --- express-rate-limit counters are shared too (forgot-password: 3 per e-mail per hour)
  const target = `sl-forgot-${stamp}@t.com`;
  const flood: number[] = [];
  for (const base of [A, B, A, B]) flood.push((await post(base, "/auth/forgot-password", { email: target })).status);
  check("per-e-mail limit counts across instances", flood.join(",") === "202,202,202,429", flood.join(","));

  // --- Stored counters carry no personal data
  const rows = await prisma.rateLimit.findMany({ where: { resetAt: { gt: new Date() } } });
  const raw = JSON.stringify(rows);
  check("counters stored", rows.length > 0, `${rows.length} rows`);
  check("no e-mail or IP in stored keys", !raw.includes("@") && !raw.includes("127.0.0.1") && !raw.includes("::1"));
  check("lockout key is the SHA-256 of the e-mail key",
    rows.some((r: { key: string; hits: number }) => r.key === hashToken("lockout:" + email) && r.hits === 5));

  // --- A successful login clears the shared lockout counter
  await prisma.rateLimit.deleteMany({ where: { key: hashToken("lockout:" + email) } });
  const relogin = await post(B, "/auth/login", { email, password: PW });
  check("login works again once the counter is gone", relogin.status === 200, String(relogin.status));
  await post(A, "/auth/login", { email, password: "Senha-Errada-x" });
  await post(B, "/auth/login", { email, password: PW });
  check("successful login (other instance) clears the failure count",
    (await prisma.rateLimit.count({ where: { key: hashToken("lockout:" + email) } })) === 0);

  // --- vercel.json headers for the static pages match what helmet sends
  const vercel = JSON.parse(await readFile(path.join(process.cwd(), "..", "vercel.json"), "utf8"));
  const pageRule = vercel.headers.find((h: { source: string }) => h.source.includes("(?!api/)"));
  const configured = new Map<string, string>(
    pageRule.headers.map((h: { key: string; value: string }) => [h.key.toLowerCase(), h.value]),
  );
  const health = await fetch(A + "/health");
  const helmetHeaders = [
    "content-security-policy", "cross-origin-opener-policy", "cross-origin-resource-policy",
    "origin-agent-cluster", "referrer-policy", "strict-transport-security", "x-content-type-options",
    "x-dns-prefetch-control", "x-download-options", "x-frame-options", "x-permitted-cross-domain-policies",
    "x-xss-protection",
  ];
  const mismatched = helmetHeaders.filter((name) => {
    let expected = health.headers.get(name) ?? "";
    // Development omits upgrade-insecure-requests (http://localhost); production adds it
    if (name === "content-security-policy") expected += ";upgrade-insecure-requests";
    return configured.get(name) !== expected;
  });
  check("vercel.json page headers match helmet", mismatched.length === 0, mismatched.join(", "));
  check("vercel.json does not override API headers", !pageRule.source.startsWith("/(.*)"));
} finally {
  await prisma.user.deleteMany({ where: { email: { startsWith: "sl-" } } });
  second.close();
  await prisma.$disconnect();
}

console.log(`\n${ok} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
