import {NextRequest} from "next/server";
import {getMissingKeyMessage, getModelApiKey, requestChatCompletions, resolveDeepSeekModel} from "../model";

export const runtime = "nodejs";

const clip = (value: unknown, limit: number) => typeof value === "string" ? value.slice(0, limit) : "";

export async function POST(request: NextRequest) {
  const model = resolveDeepSeekModel(request);
  const apiKey = getModelApiKey(model);
  if (!apiKey) return Response.json({error: getMissingKeyMessage(model)}, {status: 503});

  const body = await request.json().catch(() => null) as {
    beforeText?: string;
    beforeLabel?: string;
    afterText?: string;
    afterLabel?: string;
  } | null;
  if (!body) return Response.json({error: "请求内容为空。"}, {status: 400});

  const beforeText = clip(body.beforeText, 6000);
  const afterText = clip(body.afterText, 6000);
  const beforeLabel = clip(body.beforeLabel, 100) || "片段之前";
  const afterLabel = clip(body.afterLabel, 100) || "片段之后";
  const summarizeOneSide = async (label: string, text: string, side: "前文" | "后文") => {
    if (!text.trim()) return `${label}：无`;
    const system = `你是短剧剧本的${side}概要整理员。你只能看到${side}原文，也只能总结这段原文中已经发生或明确写出的内容。不得猜测当前片段，不得描述另一侧剧情，不得创作新事件或台词。保留人物位置、动作、情绪、关系和关键事件。只输出“${label}：”开头的一段简洁中文概要，最多120字。`;
    const {response} = await requestChatCompletions(model, apiKey, {messages: [{role: "system", content: system}, {role: "user", content: text}], temperature: 0.1, maxTokens: 260}, request.signal);
    if (!response.ok) throw new Error(`模型请求失败（${response.status}）`);
    const data = await response.json();
    const summary = String(data.choices?.[0]?.message?.content || "").trim();
    if (!summary) throw new Error(`模型没有返回${side}概要。`);
    return summary.startsWith(`${label}：`) ? summary : `${label}：${summary}`;
  };

  try {
    const [beforeSummary, afterSummary] = await Promise.all([
      summarizeOneSide(beforeLabel, beforeText, "前文"),
      summarizeOneSide(afterLabel, afterText, "后文"),
    ]);
    return Response.json({beforeSummary, afterSummary});
  } catch (error) {
    if (request.signal.aborted) return Response.json({error: "请求已停止。"}, {status: 499});
    return Response.json({error: error instanceof Error ? error.message : "概要生成失败。"}, {status: 500});
  }
}
