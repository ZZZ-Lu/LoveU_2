import {NextRequest} from "next/server";
import {
  IMAGINE_PROMPT_VERSION,
} from "../imagine-prompt";
import promptVersionArchive from "../../../../fewshot-prompt-versions.json";
import {DEEPSEEK_MAX_TOKENS, getMissingKeyMessage, getModelApiKey, isKimiModel, requestChatCompletions, resolveDeepSeekModel} from "../model";

export const runtime = "nodejs";

const globalTasks = globalThis as Record<string, unknown>;
globalTasks.fewshotTasks = globalTasks.fewshotTasks || new Map<string, unknown>();
const tasks = globalTasks.fewshotTasks as Map<string, unknown>;

const parseOutput = (raw: string) => {
  let shotIndex = raw.lastIndexOf("【分镜1】");
  if (shotIndex < 0) {
    const match = /【\s*分镜\s*([1一1]|\d+)\s*】/.exec(raw);
    if (match) shotIndex = match.index;
  }
  if (shotIndex < 0) {
    return {imagination: raw.trim(), prompt: ""};
  }

  let promptCutIndex = shotIndex;
  const beforeText = raw.slice(0, shotIndex);
  if (/(\*\*|#+\s*|\*)\s*$/u.test(beforeText)) {
    const prefixMatch = beforeText.match(/(\*\*|#+\s*|\*)\s*$/u);
    if (prefixMatch && prefixMatch.index !== undefined) {
      promptCutIndex = prefixMatch.index;
    }
  }

  let imagination = raw.slice(0, promptCutIndex).trim();
  imagination = imagination
    .replace(/(?:最终提示词|意识流推演|思考过程|提示词)[：:]?\s*$/ui, "")
    .replace(/[\*\#\_]+\s*$/g, "")
    .trim();

  if (/^[\*\#\_\s\:\：\-\=]*$/.test(imagination)) {
    imagination = "";
  }

  const prompt = raw.slice(promptCutIndex).trim();
  return {imagination, prompt};
};

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const taskId = url.searchParams.get("taskId");
  if (taskId) {
    const task = tasks.get(taskId);
    if (!task) return Response.json({status: "not_found"}, {status: 404});
    return Response.json(task);
  }

  const versions = promptVersionArchive.versions.map((item) => ({
    id: item.id,
    version: item.id.startsWith("builtin-") ? item.id.slice("builtin-".length) : item.id,
    name: item.label.replace(/\s*·\s*内置\s*$/u, ""),
    note: item.id.startsWith("builtin-") ? "内置版本" : "GitHub Prompt 版本归档",
    template: item.prompt,
  }));
  const latestArchived = versions.find((item) => !item.id.startsWith("builtin-"));

  return Response.json({
    current: latestArchived?.id || `builtin-${IMAGINE_PROMPT_VERSION}`,
    versions,
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as {template?: string; script?: string; taskId?: string; model?: string} | null;
  const model = resolveDeepSeekModel(request, body?.model);
  const apiKey = getModelApiKey(model);
  if (!apiKey) return Response.json({error: getMissingKeyMessage(model)}, {status: 503});
  const template = body?.template?.trim();
  const script = body?.script?.trim();
  const taskId = body?.taskId;

  if (!template || !script) return Response.json({error: "提示词版本或测试剧本为空。"}, {status: 400});
  if (template.length > 60000 || script.length > 12000) return Response.json({error: "测试内容过长。"}, {status: 400});

  const system = template.includes("{{插入剧本片段}}")
    ? template.replace("{{插入剧本片段}}", script)
    : `${template}\n\n剧本片段：\n${script}`;
  const messages = [
    {role: "system", content: system},
    {role: "user", content: `当前剧本：\n${script}\n\n任务：\n从头想象并撰写这个片段的视频提示词。`},
  ];

  const startedAt = Date.now();

  if (taskId) {
    tasks.set(taskId, {status: "running"});
    (async () => {
      try {
        const {response, payload} = await requestChatCompletions(model, apiKey, {
          messages,
          temperature: 0.8,
          maxTokens: isKimiModel(model) ? 15000 : DEEPSEEK_MAX_TOKENS,
        });
        if (!response.ok) throw new Error(`${isKimiModel(model) ? "Kimi" : "DeepSeek"} 请求失败（${response.status}）：${(await response.text()).slice(0, 240)}`);
        const data = await response.json();
        const content = String(data.choices?.[0]?.message?.content || "").trim();
        const reasoning = String(data.choices?.[0]?.message?.reasoning_content || "").trim();
        const rawOutput = reasoning ? `思考过程：\n${reasoning}\n\n${content}` : content;
        if (!rawOutput) throw new Error("模型没有返回内容。");
        const parsed = parseOutput(rawOutput);
        const resultPayload = {
          rawInput: JSON.stringify(payload),
          rawOutput,
          imagination: parsed.imagination,
          prompt: parsed.prompt,
          durationMs: Date.now() - startedAt,
          shotCount: (parsed.prompt.match(/【分镜\d+】/g) || []).length,
          model,
        };
        tasks.set(taskId, {status: "done", result: resultPayload});
        setTimeout(() => tasks.delete(taskId), 3600000);
      } catch (error) {
        tasks.set(taskId, {status: "error", error: error instanceof Error ? error.message : "测试失败。"});
        setTimeout(() => tasks.delete(taskId), 3600000);
      }
    })();
    return Response.json({status: "running", taskId}, {status: 202});
  }

  try {
    const {response, payload} = await requestChatCompletions(model, apiKey, {
      messages,
      temperature: 0.8,
      maxTokens: isKimiModel(model) ? 15000 : DEEPSEEK_MAX_TOKENS,
    });
    if (!response.ok) throw new Error(`${isKimiModel(model) ? "Kimi" : "DeepSeek"} 请求失败（${response.status}）：${(await response.text()).slice(0, 240)}`);
    const data = await response.json();
    const content = String(data.choices?.[0]?.message?.content || "").trim();
    const reasoning = String(data.choices?.[0]?.message?.reasoning_content || "").trim();
    const rawOutput = reasoning ? `思考过程：\n${reasoning}\n\n${content}` : content;
    if (!rawOutput) throw new Error("模型没有返回内容。");
    const parsed = parseOutput(rawOutput);
    const resultPayload = {
      rawInput: JSON.stringify(payload),
      rawOutput,
      imagination: parsed.imagination,
      prompt: parsed.prompt,
      durationMs: Date.now() - startedAt,
      shotCount: (parsed.prompt.match(/【分镜\d+】/g) || []).length,
      model,
    };

    return Response.json(resultPayload);
  } catch (error) {
    return Response.json({error: error instanceof Error ? error.message : "测试失败。"}, {status: 500});
  }
}
