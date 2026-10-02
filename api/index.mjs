// Vercel Function: the whole Express API (server/) runs as this one function.
// vercel.json rewrites /api/* here; the front-end is served by Vercel's CDN.
// Imports the compiled server, built by `npm run vercel-build`.
import { app } from "../server/dist/src/app.js";

export default app;
