import { PrismaPg } from "@prisma/adapter-pg";
import { attachDatabasePool } from "@vercel/functions";
import pg from "pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { env } from "./env.js";

const pool = new pg.Pool({ connectionString: env.DATABASE_URL, max: env.DATABASE_POOL_MAX });
// On Vercel, keeps a suspended function from holding idle connections open
// (no-op anywhere else)
attachDatabasePool(pool);

const adapter = new PrismaPg(pool);
export const prisma = new PrismaClient({ adapter });
