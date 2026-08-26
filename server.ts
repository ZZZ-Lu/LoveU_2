import { startProdServer } from "vinext/server/prod-server";
import { join } from "node:path";
import fs from "node:fs";

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const host = process.env.HOST ?? "0.0.0.0";

const outDir = fs.existsSync(join(process.cwd(), "dist/standalone/dist"))
  ? join(process.cwd(), "dist/standalone/dist")
  : join(process.cwd(), "dist");

startProdServer({
  port,
  host,
  outDir,
}).catch((error) => {
  console.error("[server] Failed to start server:", error);
  process.exit(1);
});
