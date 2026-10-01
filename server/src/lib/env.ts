import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  PORT: z.coerce.number().default(3333),
  CLIENT_URL: z.string().default("http://localhost:5173"),
});

export const env = schema.parse(process.env);
