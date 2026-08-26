import {NextRequest} from "next/server";
import {getMissingKeyMessage, getModelApiKey, requestChatCompletions, resolveDeepSeekModel} from "../model";

export const runtime = "nodejs";

type ContinuityRequest = {
  segmentText?: string;
  prompt?: string;
};

const clip = (value: unknown, limit: number) =>
  typeof value === "string" ? value.trim().slice(0, limit) : "";

const SYSTEM_PROMPT = `你是影视画面连续性记录器。
阅读剧本片段和已经完成的视频提示词，提取片段最后一个分镜结束时仍然成立、并会影响下一段画面衔接的明确视觉事实。

按分镜发生顺序判断。同一信息发生变化时，只保留最后状态。只记录能够从文本直接确定的信息，不推测，不补写剧情，不评价创作。
重点记录：
- 场景和仍在场的人物
- 人物最终的站、坐、跪、躺等姿态，以及所处位置、面向、视线和正在进行的动作
- 人物外观、伤痕、衣物状态和明显情绪
- 人物持有或接触的物品，以及重要道具、门窗等最终状态
- 最后一个镜头的主体、景别、观察方向和动作落点

省略无法确定、已经结束或不会影响后续画面的信息。
只返回 JSON：
{"continuityState":"简洁、可直接提供给下一次分镜创作的中文状态记录"}
如果没有可提取的信息，continuityState 返回空字符串。`;

export async function POST(request: NextRequest) {
  const model = resolveDeepSeekModel(request);
  const apiKey = getModelApiKey(model);
  if (!apiKey) return Response.json({error: getMissingKeyMessage(model)}, {status: 503});

  let body: ContinuityRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({error: "请求内容无效。"}, {status: 400});
  }

  const segmentText = clip(body.segmentText, 12000);
  const prompt = clip(body.prompt, 30000);
  if (!prompt) return Response.json({continuityState: ""});

  try {
    const {response} = await requestChatCompletions(model, apiKey, {
        messages: [
          {role: "system", content: SYSTEM_PROMPT},
          {role: "user", content: `【剧本片段】\n${segmentText}\n\n【最终视频提示词】\n${prompt}`},
        ],
        temperature: 0.1, maxTokens: 1400, json: true,
      }, request.signal);

    if (!response.ok) {
      throw new Error(`模型请求失败（${response.status}）`);
    }

    const data = await response.json();
    const raw = String(data.choices?.[0]?.message?.content || "");
    const parsed = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
    return Response.json({
      continuityState: typeof parsed.continuityState === "string"
        ? parsed.continuityState.trim().slice(0, 4000)
        : "",
    });
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : "连续性状态提取失败",
    }, {status: 502});
  }
}
