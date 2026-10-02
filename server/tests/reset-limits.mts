// Clears rate limit and lockout counters before a test run. They live in the
// database now, so they would otherwise carry over between runs (development only).
import path from "node:path";
import { pathToFileURL } from "node:url";

const { prisma } = await import(pathToFileURL(path.join(process.cwd(), "src/lib/prisma.ts")).href);
const { isProduction } = await import(pathToFileURL(path.join(process.cwd(), "src/lib/env.ts")).href);
if (isProduction) throw new Error("Refusing to clear rate limits in production");

const { count } = await prisma.rateLimit.deleteMany({});
console.log(`Cleared ${count} rate limit counters`);
await prisma.$disconnect();
