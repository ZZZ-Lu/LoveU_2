import type {NextRequest} from "next/server";

export type AiModel = "deepseek-v4-flash" | "deepseek-v4-pro" | "kimi-k3-high" | "kimi-k3-max";
export type DeepSeekModel = AiModel;
export const DEFAULT_AI_MODEL: AiModel = "deepseek-v4-pro";
export const DEFAULT_DEEPSEEK_MODEL = DEFAULT_AI_MODEL;
export const AI_MODEL_COOKIE = "loveu_ai_model";

const isAiModel = (value?: string): value is AiModel =>
  value === "deepseek-v4-flash" || value === "deepseek-v4-pro" ||
  value === "kimi-k3-high" || value === "kimi-k3-max";

export const resolveAiModel = (request: NextRequest): AiModel => {
  const selected = request.cookies.get(AI_MODEL_COOKIE)?.value;
  if (isAiModel(selected)) return selected;
  const legacy = request.cookies.get("loveu_deepseek_model")?.value;
  if (legacy === "kimi-k3") return "kimi-k3-max";
  return isAiModel(legacy) ? legacy : DEFAULT_AI_MODEL;
};

export const resolveDeepSeekModel = resolveAiModel;
export const isKimiModel = (model: AiModel) => model === "kimi-k3-high" || model === "kimi-k3-max";
export const getModelApiKey = (model: AiModel) => isKimiModel(model)
  ? (process.env.DASHSCOPE_API_KEY || "").trim()
  : (process.env.DEEPSEEK_API_KEY || "").trim();
export const getMissingKeyMessage = (model: AiModel) => isKimiModel(model)
  ? "尚未配置千问云 API Key（DASHSCOPE_API_KEY）。"
  : "尚未配置 DeepSeek API Key。";

export async function requestChatCompletions(
  model: AiModel,
  apiKey: string,
  input: {messages: Array<{role: string; content: string}>; temperature?: number; maxTokens?: number; json?: boolean},
  signal?: AbortSignal,
) {
  const kimi = isKimiModel(model);
  const payload = kimi
    ? {model: "kimi/kimi-k3", messages: input.messages, reasoning_effort: model === "kimi-k3-high" ? "high" : "max", max_completion_tokens: 15000, ...(input.json ? {response_format: {type: "json_object" as const}} : {}), stream: false}
    : {model, messages: input.messages, temperature: input.temperature ?? 0.8, thinking: {type: "disabled" as const}, max_tokens: input.maxTokens ?? 7000, ...(input.json ? {response_format: {type: "json_object" as const}} : {}), stream: false};
  const localProxy = !kimi ? process.env.DEEPSEEK_LOCAL_PROXY_URL : "";
  const url = kimi ? "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions" : localProxy || "https://api.deepseek.com/chat/completions";
  const attempts = kimi ? 6 : 1;
  let response: Response | null = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    response = await fetch(url, {
      method: "POST",
      headers: localProxy ? {"Content-Type": "application/json"} : {"Content-Type": "application/json", Authorization: `Bearer ${apiKey}`},
      body: JSON.stringify(payload),
      signal,
    });
    if (response.ok || !kimi || response.status !== 429) break;
    const detail = await response.clone().text();
    if (!detail.includes("EngineOverloadedError") || attempt === attempts - 1) break;
    await new Promise<void>((resolve, reject) => {
      const backoffMs = Math.min(30000, 3000 * (2 ** attempt));
      const timer = setTimeout(resolve, backoffMs + Math.floor(Math.random() * 750));
      signal?.addEventListener("abort", () => {
        clearTimeout(timer);
        reject(signal.reason || new DOMException("请求已取消", "AbortError"));
      }, {once: true});
    });
  }
  return {response: response as Response, payload};
}
