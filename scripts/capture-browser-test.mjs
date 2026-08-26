import { createServer } from "node:http";
import { writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const targets = {
  prompt: path.join(root, "test-results", "v7-2-imitation-v14-5-browser-export.json"),
  results: path.join(root, "test-results", "dance-handoff-v14-4-vs-v14-5-2026-08-22.json"),
};

createServer(async (request, response) => {
  response.setHeader("Access-Control-Allow-Origin", "http://localhost:3000");
  response.setHeader("Access-Control-Allow-Headers", "content-type");
  if (request.method === "OPTIONS") {
    response.writeHead(204);
    return response.end();
  }
  const kind = new URL(request.url, "http://127.0.0.1:3333").pathname.slice(1);
  if (request.method !== "POST" || !targets[kind]) {
    response.writeHead(404);
    return response.end("not found");
  }
  let body = "";
  for await (const chunk of request) body += chunk;
  JSON.parse(body);
  await writeFile(targets[kind], body, "utf8");
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ ok: true, file: targets[kind] }));
}).listen(3333, "127.0.0.1", () => {
  console.log("Browser capture server listening on http://127.0.0.1:3333");
});
