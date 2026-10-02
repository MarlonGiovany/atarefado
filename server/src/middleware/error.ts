import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { HttpError } from "../lib/http-error.js";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err instanceof ZodError) {
    // Only field and message: never echo submitted values (they may be passwords)
    const issues = err.issues.map(({ path, message }) => ({ path, message }));
    res.status(400).json({ error: "Dados inválidos", issues });
    return;
  }
  // Errors from express.json(): malformed or oversized bodies
  const bodyError = err as { type?: string };
  if (bodyError?.type === "entity.parse.failed") {
    res.status(400).json({ error: "JSON inválido" });
    return;
  }
  if (bodyError?.type === "entity.too.large") {
    res.status(413).json({ error: "Requisição grande demais" });
    return;
  }
  // Log only the error itself (stack), never the request body or headers
  console.error(err instanceof Error ? err.stack : err);
  res.status(500).json({ error: "Erro interno do servidor" });
}
