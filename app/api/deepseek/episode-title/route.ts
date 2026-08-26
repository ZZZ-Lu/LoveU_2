import {NextRequest} from "next/server";
import {getMissingKeyMessage, getModelApiKey, requestChatCompletions, resolveDeepSeekModel} from "../model";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const model = resolveDeepSeekModel(request);
  const apiKey = getModelApiKey(model);
  if (!apiKey) return Response.json({error: getMissingKeyMessage(model)}, {status: 503});

  const body = await request.json().catch(() => null) as {script?: string} | null;
  const script = body?.script?.trim().slice(0, 8000);
  if (!script || script.length < 20) return Response.json({error: "剧本内容太短，暂时无法命名。"}, {status: 400});

  const messages = [
      {
        role: "system",
        content: `你是中国短剧项目的剧本命名编辑。根据用户粘贴的整部剧本开头，为这个剧本项目生成一个准确、简洁、有记忆点的名称。
名称使用4到12个中文字符，抓住作品的核心人物、关系、冲突或悬念，不使用“未命名”“精彩剧情”等空泛词。
只返回JSON：{"title":"剧本名称"}`,
      },
      {role: "user", content: script},
    ];

  try {
    const {response} = await requestChatCompletions(model, apiKey, {messages, temperature: 0.45, maxTokens: 120, json: true}, request.signal);
    if (!response.ok) throw new Error(`模型命名请求失败（${response.status}）`);
    const data = await response.json();
    const raw = String(data.choices?.[0]?.message?.content || "").trim();
    const parsed = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)) as {title?: unknown};
    const title = String(parsed.title || "").replace(/[\r\n]/g, " ").trim().slice(0, 30);
    if (!title) throw new Error("模型没有返回剧集名称");
    return Response.json({title});
  } catch (error) {
    if (request.signal.aborted) return Response.json({error: "命名已取消。"}, {status: 499});
    return Response.json({error: error instanceof Error ? error.message : "自动命名失败。"}, {status: 502});
  }
}
