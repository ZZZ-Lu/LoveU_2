import {NextRequest} from "next/server";
import {getMissingKeyMessage, getModelApiKey, requestChatCompletions, resolveDeepSeekModel} from "../model";

export const runtime = "nodejs";

type DurationRequest = {
  prompt?: string;
};

const SYSTEM_PROMPT = `你是短剧分镜时长估算员。阅读一段已经完成的视频提示词，为每个编号分镜估算实际可播放时长。

估算时在脑中按正常成片速度播放画面：
- 台词按中国短剧偏快但仍清晰自然的语速计算。
- 人物动作、表情变化、视线转移和运镜可以同时发生，不要简单累加。
- 快切、快速推拉摇移通常较短；复杂动作、长台词和需要观众看清的信息需要更长。
- 按提示词实际内容估算，不要为了把总时长凑成15秒而压缩或拉长。

只返回 JSON：
{"shots":[{"shot":1,"seconds":2},{"shot":2,"seconds":3}]}

必须覆盖提示词中的每个分镜，shot 使用原分镜编号。seconds 必须是大于等于1的整数秒，不得返回小数。先在脑中完成精确估算，再四舍五入为最接近的整数。`;

export async function POST(request: NextRequest) {
  const model = resolveDeepSeekModel(request);
  const apiKey = getModelApiKey(model);
  if (!apiKey) return Response.json({error: getMissingKeyMessage(model)}, {status: 503});

  let body: DurationRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({error: "请求内容无效。"}, {status: 400});
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim().slice(0, 40000) : "";
  if (!prompt) return Response.json({shots: []});

  try {
    const {response} = await requestChatCompletions(model, apiKey, {
        messages: [
          {role: "system", content: SYSTEM_PROMPT},
          {role: "user", content: prompt},
        ],
        temperature: 0.1, maxTokens: 1600, json: true,
      }, request.signal);

    if (!response.ok) throw new Error(`模型请求失败（${response.status}）`);
    const data = await response.json();
    const raw = String(data.choices?.[0]?.message?.content || "");
    const parsed = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
    const shots = Array.isArray(parsed.shots)
      ? parsed.shots
          .map((item: unknown) => {
            const value = item as {shot?: unknown; seconds?: unknown};
            const shot = Number(value.shot);
            const seconds = Number(value.seconds);
            if (!Number.isInteger(shot) || shot < 1 || !Number.isFinite(seconds) || seconds <= 0) return null;
            return {shot, seconds: Math.max(1, Math.round(Math.min(seconds, 60)))};
          })
          .filter((item: {shot: number; seconds: number} | null): item is {shot: number; seconds: number} => Boolean(item))
      : [];
    return Response.json({shots});
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : "分镜时长估算失败",
    }, {status: 502});
  }
}
