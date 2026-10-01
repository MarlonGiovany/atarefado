import { app } from "./app.js";
import { env } from "./lib/env.js";

app.listen(env.PORT, () => {
  console.log(`Atarefado API running on http://localhost:${env.PORT}`);
});
