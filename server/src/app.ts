import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { env, trustProxySetting } from "./lib/env.js";
import { requireAuth } from "./middleware/auth.js";
import { requireSameOrigin } from "./middleware/csrf.js";
import { errorHandler } from "./middleware/error.js";
import { accountRouter } from "./routes/account.js";
import { authRouter } from "./routes/auth.js";
import { boardsRouter } from "./routes/boards.js";
import { columnsRouter } from "./routes/columns.js";
import { cardsRouter } from "./routes/cards.js";

export const app = express();

// Behind a reverse proxy (production), so rate limits and req.ip see the real client
const trustProxy = trustProxySetting();
if (trustProxy !== undefined) app.set("trust proxy", trustProxy);

// Security headers (nosniff, frame denial, HSTS over HTTPS, no X-Powered-By, ...)
app.use(helmet());
app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());
// Cookie sessions need CSRF protection on every state-changing request
app.use("/api", requireSameOrigin);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRouter);
app.use("/api/account", requireAuth, accountRouter);
app.use("/api/boards", requireAuth, boardsRouter);
app.use("/api/columns", requireAuth, columnsRouter);
app.use("/api/cards", requireAuth, cardsRouter);

app.use(errorHandler);
