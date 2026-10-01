import express from "express";
import cors from "cors";
import { env } from "./lib/env.js";
import { requireAuth } from "./middleware/auth.js";
import { errorHandler } from "./middleware/error.js";
import { authRouter } from "./routes/auth.js";
import { boardsRouter } from "./routes/boards.js";
import { columnsRouter } from "./routes/columns.js";
import { cardsRouter } from "./routes/cards.js";

export const app = express();

app.use(cors({ origin: env.CLIENT_URL }));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRouter);
app.use("/api/boards", requireAuth, boardsRouter);
app.use("/api/columns", requireAuth, columnsRouter);
app.use("/api/cards", requireAuth, cardsRouter);

app.use(errorHandler);
