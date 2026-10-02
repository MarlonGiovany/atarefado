// Serverless readiness: rate limits and lockouts must hold across server
// instances (on Vercel each function instance has its own memory), and the
// security headers Vercel adds to the static pages must match helmet's.
// Run from the server folder: `npm run test:serverless` (the dev server may stay on).
//
// Two independent API instances are started as separate processes. The local
// database accepts only one connection at a time, so they use very short idle
// timeouts and the requests below are spaced out, taking turns on it; against a
// real Postgres (Neon) they would run side by side.
import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import pg from "pg";
import "dotenv/config";

process.env.DATABASE_IDLE_TIMEOUT_MS = "150";
const TURN_MS = 500; // longer than the idle timeout plus a reconnect

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let ok = 0, fail = 0;
const check = (name: string, cond: boolean, extra = "") => {
  cond ? ok++ : fail++;
  console.log(`${cond ? "PASS" : "FAIL"} ${name} ${extra}`);
};

/** Waits until the database takes a connection (e.g. the dev server's idle one has closed). */
async function waitForFreeDatabase() {
  for (let i = 0; i < 60; i++) {
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
    client.on("error", () => {});
    try {
      await client.connect();
      await client.query("select 1");
      await client.end();
      return;
    } catch {
      await client.end().catch(() => {});
      await sleep(500);
    }
  }
  throw new Error("The database never became free");
}

const tsx = path.join(process.cwd(), "node_modules/tsx/dist/cli.mjs");
const children: ChildProcess[] = [];
function startInstance(port: number) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(process.execPath, [tsx, "src/index.ts"], {
      env: { ...process.env, PORT: String(port) },
      stdio: ["ignore", "pipe", "inherit"],
    });
    children.push(child);
    child.once("exit", (code) => reject(new Error(`instance on :${port} exited with ${code}`)));
    child.stdout!.on("data", (chunk: Buffer) => {
      if (chunk.toString().includes("running on")) resolve(`http://localhost:${port}/api`);
    });
  });
}

const ORIGIN = "http://localhost:5173";
const post = async (base: string, p: string, body: object) => {
  const r = await fetch(base + p, {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN },
    body: JSON.stringify(body),
  });
  const result = { status: r.status, data: await r.json().catch(() => null) };
  await sleep(TURN_MS);
  return result;
};

await waitForFreeDatabase();
const [A, B] = await Promise.all([startInstance(4101), startInstance(4102)]);
await waitForFreeDatabase();

const { prisma } = await import(pathToFileURL(path.join(process.cwd(), "src/lib/prisma.ts")).href);
const { hashToken } = await import(pathToFileURL(path.join(process.cwd(), "src/lib/tokens.ts")).href);

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

  // --- A successful login on another instance clears the shared failure count
  await prisma.rateLimit.deleteMany({ where: { key: hashToken("lockout:" + email) } });
  await sleep(TURN_MS);
  const relogin = await post(B, "/auth/login", { email, password: PW });
  check("login works again once the counter is gone", relogin.status === 200, String(relogin.status));
  await post(A, "/auth/login", { email, password: "Senha-Errada-x" });
  await post(B, "/auth/login", { email, password: PW });
  await sleep(TURN_MS);
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
  await sleep(TURN_MS);
  await prisma.user.deleteMany({ where: { email: { startsWith: "sl-" } } });
  await prisma.$disconnect();
  for (const child of children) {
    child.removeAllListeners("exit");
    child.kill();
  }
}

console.log(`\n${ok} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
