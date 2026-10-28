import type {NextRequest} from "next/server";

export type AiModel =
  | "deepseek-v4-flash"
  | "deepseek-v4-pro"
  | "kimi-k3-high"
  | "kimi-k3-max"
  | "kimi-k3-official-high"
  | "kimi-k3-official-max";

export type DeepSeekModel = AiModel;
export const DEFAULT_AI_MODEL: AiModel = "deepseek-v4-pro";
export const DEFAULT_DEEPSEEK_MODEL = DEFAULT_AI_MODEL;
export const AI_MODEL_COOKIE = "loveu_ai_model";

// DeepSeek 官方 API 允许的 max_tokens 范围为 [1, 393216] (384K tokens)
export const DEEPSEEK_MAX_TOKENS = 393216;

const isAiModel = (value?: string): value is AiModel =>
  value === "deepseek-v4-flash" ||
  value === "deepseek-v4-pro" ||
  value === "kimi-k3-high" ||
  value === "kimi-k3-max" ||
  value === "kimi-k3-official-high" ||
  value === "kimi-k3-official-max";

export const resolveAiModel = (request: NextRequest, bodyModel?: string): AiModel => {
  if (isAiModel(bodyModel)) return bodyModel;
  const headerModel = request.headers.get("x-ai-model");
  if (isAiModel(headerModel)) return headerModel;
  const selected = request.cookies.get(AI_MODEL_COOKIE)?.value;
  if (isAiModel(selected)) return selected;
  const legacy = request.cookies.get("loveu_deepseek_model")?.value;
  if (legacy === "kimi-k3") return "kimi-k3-max";
  return isAiModel(legacy) ? legacy : DEFAULT_AI_MODEL;
};

export const resolveDeepSeekModel = resolveAiModel;

export const isDashscopeKimiModel = (model: AiModel) =>
  model === "kimi-k3-high" || model === "kimi-k3-max";

export const isOfficialKimiModel = (model: AiModel) =>
  model === "kimi-k3-official-high" || model === "kimi-k3-official-max";

export const isKimiModel = (model: AiModel) =>
  isDashscopeKimiModel(model) || isOfficialKimiModel(model);

export const getKimiLabel = (model: AiModel | string) => {
  if (model === "kimi-k3-high" || model === "kimi-k3-official-high") return "Kimi K3 High";
  if (model === "kimi-k3-max" || model === "kimi-k3-official-max") return "Kimi K3 Max";
  return "Kimi K3";
};

export const getModelDisplayName = (model: AiModel | string) => {
  if (model === "kimi-k3-high" || model === "kimi-k3-official-high") return "Kimi K3 High";
  if (model === "kimi-k3-max" || model === "kimi-k3-official-max") return "Kimi K3 Max";
  if (model === "deepseek-v4-flash") return "DeepSeek V4 Flash";
  if (model === "deepseek-v4-pro") return "DeepSeek V4 Pro";
  return model;
};

export const getModelApiKey = (model: AiModel) => {
  if (isOfficialKimiModel(model)) {
    return (process.env.KIMI_API_KEY || process.env.MOONSHOT_API_KEY || "").trim();
  }
  if (isDashscopeKimiModel(model)) {
    return (process.env.DASHSCOPE_API_KEY || "").trim();
  }
  return (process.env.DEEPSEEK_API_KEY || "").trim();
};

export const getMissingKeyMessage = (model: AiModel) => {
  if (isOfficialKimiModel(model)) {
    return "尚未配置 Kimi 官方 API Key（KIMI_API_KEY 或 MOONSHOT_API_KEY）。";
  }
  if (isDashscopeKimiModel(model)) {
    return "尚未配置千问云 API Key（DASHSCOPE_API_KEY）。";
  }
  return "尚未配置 DeepSeek API Key。";
};

export async function requestChatCompletions(
  model: AiModel,
  apiKey: string,
  input: {messages: Array<{role: string; content: string}>; temperature?: number; maxTokens?: number; json?: boolean},
  signal?: AbortSignal,
) {
  const dashscope = isDashscopeKimiModel(model);
  const official = isOfficialKimiModel(model);
  const kimi = dashscope || official;

  if (kimi) {
    const isDashPrimary = dashscope;
    const effort = (model === "kimi-k3-high" || model === "kimi-k3-official-high") ? "high" : "max";

    const dashConfig = {
      name: "dashscope" as const,
      url: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
      modelName: "kimi/kimi-k3",
      apiKey: isDashPrimary ? apiKey : (process.env.DASHSCOPE_API_KEY || "").trim(),
    };

    const moonshotConfig = {
      name: "moonshot" as const,
      url: process.env.KIMI_OFFICIAL_URL || process.env.MOONSHOT_BASE_URL || "https://api.moonshot.cn/v1/chat/completions",
      modelName: "kimi-k3",
      apiKey: official ? apiKey : (process.env.KIMI_API_KEY || process.env.MOONSHOT_API_KEY || "").trim(),
    };

    let activeEndpoints = isDashPrimary
      ? [dashConfig, moonshotConfig].filter((ep) => Boolean(ep.apiKey))
      : [moonshotConfig, dashConfig].filter((ep) => Boolean(ep.apiKey));

    const maxAttempts = activeEndpoints.length > 1 ? 4 : 3;
    let lastErrorText = "";
    let lastResponse: Response | null = null;
    let activePayload: Record<string, unknown> = {};

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      if (signal?.aborted) {
        throw signal.reason || new DOMException("请求已取消", "AbortError");
      }

      if (activeEndpoints.length === 0) break;

      if (attempt > 0) {
        const backoffMs = Math.min(6000, 1500 * attempt);
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, backoffMs + Math.floor(Math.random() * 300));
          signal?.addEventListener("abort", () => {
            clearTimeout(timer);
            reject(signal.reason || new DOMException("请求已取消", "AbortError"));
          }, {once: true});
        });
      }

      const ep = activeEndpoints[attempt % activeEndpoints.length];
      activePayload = {
        model: ep.modelName,
        messages: input.messages,
        reasoning_effort: effort,
        max_completion_tokens: input.maxTokens || (isKimiModel(model) ? 15000 : DEEPSEEK_MAX_TOKENS),
        ...(input.json ? {response_format: {type: "json_object" as const}} : {}),
        stream: true,
      };

      let response: Response;
      try {
        response = await fetch(ep.url, {
          method: "POST",
          headers: (ep.name === "dashscope" && process.env.DEEPSEEK_LOCAL_PROXY_URL)
            ? {"Content-Type": "application/json"}
            : {"Content-Type": "application/json", Authorization: `Bearer ${ep.apiKey}`},
          body: JSON.stringify(activePayload),
          signal,
        });
        lastResponse = response;
      } catch (fetchErr) {
        if (signal?.aborted) throw fetchErr;
        lastErrorText = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
        continue;
      }

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        lastErrorText = errText;

        const isBalanceExhausted =
          errText.includes("insufficient balance") ||
          errText.includes("suspended") ||
          errText.includes("欠费") ||
          errText.includes("余额不足");

        if (isBalanceExhausted) {
          activeEndpoints = activeEndpoints.filter((item) => item.name !== ep.name);
          if (activeEndpoints.length > 0 && attempt < maxAttempts - 1) {
            continue;
          }
          return {
            response: new Response(errText || "服务账户余额不足，请充值后重试", {
              status: 402,
              headers: {"Content-Type": "text/plain; charset=utf-8"},
            }),
            payload: activePayload,
          };
        }

        const isRetryable =
          response.status === 429 ||
          response.status === 502 ||
          response.status === 503 ||
          response.status === 504 ||
          errText.includes("网关超时") ||
          errText.includes("思考时间较长") ||
          errText.includes("EngineOverloaded") ||
          errText.includes("InternalError") ||
          errText.includes("timeout") ||
          errText.includes("upstream");

        if (isRetryable && attempt < maxAttempts - 1) {
          continue;
        }

        return {
          response: new Response(errText || "Kimi 服务响应异常", {
            status: response.status,
            headers: {"Content-Type": "text/plain; charset=utf-8"},
          }),
          payload: activePayload,
        };
      }

      // Stream handling with in-band error and drop detection
      try {
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("未能获取流式响应数据通道");
        }

        const decoder = new TextDecoder();
        let reasoning = "";
        let content = "";
        let finishReason = "stop";
        let id = "";
        let buffer = "";

        while (true) {
          const {done, value} = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, {stream: true});
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(":")) continue;
            if (trimmed === "data: [DONE]") continue;
            if (trimmed.startsWith("data: ")) {
              try {
                const parsed = JSON.parse(trimmed.slice(6));
                if (parsed.error) {
                  throw new Error(parsed.error.message || JSON.stringify(parsed.error));
                }
                if (parsed.id) id = parsed.id;
                const choice = parsed.choices?.[0];
                if (choice?.delta?.reasoning_content) reasoning += choice.delta.reasoning_content;
                if (choice?.delta?.content) content += choice.delta.content;
                if (choice?.finish_reason) finishReason = choice.finish_reason;
              } catch (pe) {
                if (pe instanceof Error && !pe.message.startsWith("Unexpected")) {
                  throw pe;
                }
              }
            }
          }
        }

        if (!content && !reasoning) {
          throw new Error("模型流式传输中断，未生成有效回复内容");
        }

        const simulatedData = {
          id: id || "stream-completed",
          choices: [
            {
              message: {
                role: "assistant",
                content,
                reasoning_content: reasoning,
              },
              finish_reason: finishReason,
            },
          ],
        };

        return {
          response: new Response(JSON.stringify(simulatedData), {
            status: 200,
            headers: {"Content-Type": "application/json"},
          }),
          payload: activePayload,
        };
      } catch (streamErr) {
        if (signal?.aborted) throw streamErr;
        const errMsg = streamErr instanceof Error ? streamErr.message : String(streamErr);
        lastErrorText = errMsg;
        const isRetryable =
          errMsg.includes("网关超时") ||
          errMsg.includes("思考时间较长") ||
          errMsg.includes("中断") ||
          errMsg.includes("timeout") ||
          errMsg.includes("stream");
        if (isRetryable && attempt < maxAttempts - 1) {
          continue;
        }
        throw streamErr;
      }
    }

    if (lastResponse && !lastResponse.ok) {
      return {
        response: new Response(lastErrorText || "Kimi 服务请求超时", {
          status: lastResponse.status,
          headers: {"Content-Type": "text/plain; charset=utf-8"},
        }),
        payload: activePayload,
      };
    }
    throw new Error(lastErrorText || "Kimi 请求重试后仍未收到响应");
  }

  // Non-Kimi (DeepSeek) logic
  const localProxy = process.env.DEEPSEEK_LOCAL_PROXY_URL;
  const actualModel = (!localProxy && model === "deepseek-v4-flash") ? "deepseek-chat" : model;
  const payload = {
    model: actualModel,
    messages: input.messages,
    temperature: input.temperature ?? 0.8,
    max_tokens: input.maxTokens ?? DEEPSEEK_MAX_TOKENS,
    ...(input.json ? {response_format: {type: "json_object" as const}} : {}),
    stream: false,
  };
  const url = localProxy || "https://api.deepseek.com/chat/completions";

  const response = await fetch(url, {
    method: "POST",
    headers: (dashscope && process.env.DEEPSEEK_LOCAL_PROXY_URL)
      ? {"Content-Type": "application/json"}
      : {"Content-Type": "application/json", Authorization: `Bearer ${apiKey}`},
    body: JSON.stringify(payload),
    signal,
  });

  return {response, payload};
}
