import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  // Migrations need a direct (non-pooled) connection. Neon, through the Vercel
  // integration, provides it as DATABASE_URL_UNPOOLED; elsewhere DATABASE_URL is used.
  datasource: { url: process.env.DATABASE_URL_UNPOOLED || env("DATABASE_URL") },
});
