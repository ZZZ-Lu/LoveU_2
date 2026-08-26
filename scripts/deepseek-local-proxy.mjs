import {createServer} from "node:http";
import {readFileSync} from "node:fs";

const PORT = Number(process.env.DEEPSEEK_PROXY_PORT || 8788);
const readLocalKey = () => {
  if (process.env.DEEPSEEK_API_KEY) return process.env.DEEPSEEK_API_KEY.trim();
  try {
    return (readFileSync(".env.local", "utf8").match(/^DEEPSEEK_API_KEY=(.+)$/m)?.[1] || "").trim();
  } catch { return ""; }
};
const apiKey = readLocalKey();

const send = (response, status, body, type = "application/json; charset=utf-8") => {
  response.writeHead(status, {"Content-Type": type, "Cache-Control": "no-store"});
  response.end(body);
};

createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/health") return send(response, 200, JSON.stringify({ok: true}));
  if (request.method !== "POST" || request.url !== "/chat/completions") return send(response, 404, JSON.stringify({error: "Not found"}));
  if (!apiKey) return send(response, 503, JSON.stringify({error: "DEEPSEEK_API_KEY is not configured for the local proxy."}));

  try {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const upstream = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {"Content-Type": "application/json", Authorization: `Bearer ${apiKey}`},
      body: Buffer.concat(chunks),
    });
    send(response, upstream.status, await upstream.text());
  } catch (error) {
    send(response, 502, JSON.stringify({error: error instanceof Error ? error.message : "Local DeepSeek proxy failed."}));
  }
}).listen(PORT, "127.0.0.1", () => console.log(`DeepSeek local proxy listening on http://127.0.0.1:${PORT}`));
