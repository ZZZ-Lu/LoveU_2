import {NextRequest} from "next/server";
import {getMissingKeyMessage, getModelApiKey, isKimiModel, requestChatCompletions, resolveDeepSeekModel, type DeepSeekModel} from "../model";

export const runtime = "nodejs";

type NodeRequest = {nodeId?: string; script?: string; storyboard?: string; performanceStoryboard?: string; systemPrompt?: string};
type Stage = {id: string; name: string; input: string; output: string; result: string; durationMs: number};

const SHOT_SPLIT = `你是短剧分镜的镜头原子性检查师。

你的任务是检查每个【分镜】能否由同一台摄影机，在一次连续拍摄中自然完成。你不能因为景别变化、主体变化或运镜较长就机械拆分。

只有当原分镜内部存在必须通过剪辑才能完成的机位跳变时，才进行拆分。

必须拆分：明确出现“切到、反打、另一个角度、画面切换”；摄影机位置瞬间改变；构图无法通过所写运镜连续抵达；互相矛盾的机位或角度；时间、空间或动作不连续。

不要拆分：连续推、拉、摇、移、跟随、环绕带来的变化；沿明确路径从一个主体移到另一个主体；同一人物的连续动作；同一空间内可以连续调度的多人动作。

边界案例默认保留，不重新设计导演方案，不增加动作、表情、场景、灯光或台词。拆分后重新连续编号。如果全部可以连续拍摄，则原样输出。只输出整理后的完整分镜。`;

const SPATIAL_CORRECTION = `你是分镜空间矛盾纠正师。先连续阅读全部分镜，只检查以下事实是否前后矛盾：角色和重要道具的位置、前景背景、朝向、视线、持有关系及出入画状态。

发现明确矛盾时，必须删除错误的空间描述并替换为与原剧本、前一镜和人物动作一致的描述。不得改变台词、剧情、动作、人物、道具、景别、运镜、镜头顺序和分镜数量。不要补充缺失信息；没有明确矛盾的分镜保持原样。

只返回合法JSON：{"changes":[{"shot":2,"replacement":"【分镜2】\\n纠正后的完整单个分镜"}]}。没有矛盾时返回{"changes":[]}。`;

const SPATIAL_COMPLETION = `你是分镜空间信息完善师。输入已经完成空间矛盾纠正。逐镜检查并补齐：每个入画角色的前景/中景/背景层次、画面左/中/右位置、身体朝向、视线方向、画面展示的身体部位；背对镜头时必须说明。重要道具必须说明位置和朝向。

被注视对象在当前画面内时，可写画面方向加对象；对象不在画面内时，必须只写看向画面左、右、上、下、镜头方向或画面深处。环境背景只有原剧本或现有分镜提供明确依据时才描述。

只补齐有原剧本、当前分镜或前后镜头依据的信息。不得新增人物、道具、动作、表情、台词、剧情、布景、景别、运镜或分镜。

只返回合法JSON：{"changes":[{"shot":2,"replacement":"【分镜2】\\n修订后的完整单个分镜"}]}。全部完整时返回{"changes":[]}。`;

const FRAME_MANIFEST = `你是坐在监视器前逐镜复盘的短剧导演。在内部把每个分镜从第一帧播放到最后一帧，确定摄影机、画框边界，以及前景、中景、背景中真正可见的全部人物和关键物件。

画面里有的必须进入清单；画面里没有的不能进入清单。每个可见元素都必须注明来源，source只能是“剧本”“当前分镜”“前序状态”或“机位必然”。如果一个编号中包含无法由一次连续运镜完成的第二套构图，atomic设为false。

只返回合法JSON：{"shots":[{"shot":1,"atomic":true,"camera":"景别、机位和方向","visible":[{"name":"人物或物件","plane":"前景/中景/背景","state":"可证明的位置、姿态和动作","source":"当前分镜"}],"excluded":[],"missing":[]}]}。`;

const FRAME_CLOSURE = `你是画面闭合修订导演。你会收到原剧本、原分镜和已经审核过的画框清单。只修订atomic为true且missing或excluded非空的分镜。画框清单是封闭集合：replacement中出现的可见人物和关键物件必须来自visible。

missing中的画内元素必须用最短文字补入。excluded中的画外内容必须删除或改成不声称其可见的表达。保留原镜头的景别、机位、运镜、剧情、台词、人物格式和表演意图。不拆分、合并或重排镜头。

只返回合法JSON：{"changes":[{"shot":2,"replacement":"【分镜2】\\n修订后的完整单个分镜"}]}。没有安全修改时返回{"changes":[]}。`;

const SHOT_SPLIT_RECHECK = `上一轮镜头原子性检查仍遗留了明确的内部剪辑。重新检查输入中的每个分镜：只要同一编号内部出现“切回、切到、反打、另一个角度、画面切换”等必须剪辑的表达，就必须在该处拆成两个分镜。不得用删除剪辑词来掩盖机位跳变。连续推、拉、摇、移、跟随和有明确路径的运镜不要拆。不得新增剧情、动作、表情、台词或布景。完成后重新连续编号，只输出修订后的完整分镜。`;

const DIALOGUE_DEDUP = `你是分镜台词验收编辑。对照原剧本逐镜检查台词，删除跨分镜重复说出的整句或句子片段，并纠正台词归属。原剧本中的每段台词只能在时间顺序正确的一个位置说出一次，原剧本本身重复时除外。不得改写台词文字，不得新增台词，不得改变分镜数量、顺序、景别、机位、动作或其它描述。

只返回合法JSON：{"changes":[{"shot":2,"replacement":"【分镜2】\\n清理重复台词后的完整单个分镜"}]}。无需修改时返回{"changes":[]}。`;

const STRUCTURE_PERFORMANCE_FUSION = `你坐在监视器前，要把同一段剧本生成的两个版本放在一起看。V14-5已经给出了准备保留的分镜设计，V7-2测试版里可能藏着更有感染力的表演。你的工作不是重新想一套分镜，而是先真正看懂两版各自在做什么，再把值得保留的表演放回V14-5的画面里。

先完整读一遍原剧本，记住人物、台词、动作和事情发生的先后。然后从V14-5的分镜1开始，一个镜头一个镜头往下看。每看到一个V14-5镜头，就去V7-2测试版里寻找同一段剧情正在怎样表演；两边分镜数量不同时，不要按编号机械配对，而要按台词、动作和情绪发生的时刻寻找对应关系。

这个逐镜对照过程要全部写出来。说清楚V14-5这一镜原本拍什么，V7-2在同一时刻多看见了哪些呼吸、停顿、眼神、面部变化、身体重心或动作力度；再把画面放进脑中播放，判断这些表演在V14-5现有景别和构图中能不能真的被镜头看见，加入后会不会改变原剧本、人物位置、动作顺序或镜头边界。能让画面更有感染力而且拍得到的，记为准备添加；只是心理解释、画面看不见、与剧本冲突或会把镜头结构带乱的，就在推演中说明为什么不采用。

全部镜头对比完以后，再单独做一次总结，明确列出最终准备从V7-2测试版添加到V14-5中的表演细节，并注明它们分别进入V14-5的哪一个分镜。如果没有值得添加的细节，也要如实说明。

完成逐镜对比和添加总结之后，才开始写最终分镜。最终结果沿用V14-5的分镜骨架，把刚才总结中确定的表演细节自然写入对应画面，不要在这一步临时产生总结之外的新设计。

最终稿必须保持V14-5的分镜数量、顺序、景别、机位和台词归属，不新增、删除或合并分镜。写完后再默读一次最终稿，删除跨分镜重复的台词与动作。

按下面的分段显式输出：
<FUSION_ANALYSIS>
逐镜对比

待添加表演细节总结
</FUSION_ANALYSIS>
<VIDEO_PROMPT>
【分镜1】……
【分镜2】……
</VIDEO_PROMPT>
`;

const presets = [
  {id: "shot-split", name: "分镜拆分节点", note: "检查一个编号内是否存在必须剪辑的机位跳变", prompt: SHOT_SPLIT},
  {id: "spatial-correction", name: "空间矛盾纠正", note: "只修正前后矛盾，不补写缺失信息", prompt: SPATIAL_CORRECTION},
  {id: "spatial-completion", name: "空间信息完善", note: "补齐画面层次、位置、朝向、视线和身体部位", prompt: SPATIAL_COMPLETION},
  {id: "spatial-pipeline", name: "空间连续性完整流程", note: "先纠正矛盾，再完善缺失信息，显示两步输出", prompt: SPATIAL_CORRECTION},
  {id: "frame-manifest", name: "画框清单", note: "逐镜列出真正入画与应排除的元素", prompt: FRAME_MANIFEST},
  {id: "frame-closure", name: "画面闭合完整流程", note: "先生成画框清单，再进行闭合修订", prompt: FRAME_CLOSURE},
  {id: "structure-performance-fusion", name: "V14-5验收后融合", note: "先修订V14-5的镜头原子性、空间与画面闭合，再吸收V7-2表演细节", prompt: STRUCTURE_PERFORMANCE_FUSION},
];

const extractContent = async (apiKey: string, model: DeepSeekModel, system: string, user: string, signal: AbortSignal, json = false) => {
  const {response} = await requestChatCompletions(model, apiKey, {messages: [{role: "system", content: system}, {role: "user", content: user}], temperature: 0.1, maxTokens: 5200, json}, signal);
  if (!response.ok) throw new Error(`${isKimiModel(model) ? "Kimi" : "DeepSeek"} 请求失败（${response.status}）：${(await response.text()).slice(0, 240)}`);
  const data = await response.json();
  const content = String(data.choices?.[0]?.message?.content || "").trim();
  const reasoning = String(data.choices?.[0]?.message?.reasoning_content || "").trim();
  return reasoning ? `思考过程：\n${reasoning}\n\n${content}` : content;
};

const splitShots = (value: string) => {
  const matches = [...value.matchAll(/【\s*分镜\s*(\d+)\s*】/g)];
  return matches.map((match, index) => value.slice(match.index || 0, matches[index + 1]?.index ?? value.length).trim());
};

const overlappingDialogue = (value: string) => {
  const quotes = [...value.matchAll(/“([^”]{4,})”/g)].map((match) => match[1].trim());
  const overlaps: string[] = [];
  for (let left = 0; left < quotes.length; left += 1) for (let right = left + 1; right < quotes.length; right += 1) {
    if (quotes[left] === quotes[right] || quotes[left].includes(quotes[right]) || quotes[right].includes(quotes[left])) overlaps.push(`“${quotes[left]}” / “${quotes[right]}”`);
  }
  return [...new Set(overlaps)];
};

const applyChanges = (storyboard: string, raw: string) => {
  const shots = splitShots(storyboard);
  const parsed = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)) as {changes?: Array<{shot?: number; replacement?: string}>};
  for (const change of parsed.changes || []) if (Number.isInteger(change.shot) && change.replacement && shots[(change.shot || 0) - 1]) shots[(change.shot || 0) - 1] = change.replacement.trim();
  return shots.join("\n\n") || storyboard;
};

const extractVideoPrompt = (raw: string) => {
  const tagged = raw.match(/<VIDEO_PROMPT>([\s\S]*?)<\/VIDEO_PROMPT>/i)?.[1]?.trim();
  if (tagged && splitShots(tagged).length) return tagged;
  const openTag = raw.match(/<VIDEO_PROMPT>/i);
  if (openTag?.index !== undefined) {
    const afterOpenTag = raw.slice(openTag.index + openTag[0].length).replace(/<\/VIDEO_PROMPT>[\s\S]*$/i, "").trim();
    if (splitShots(afterOpenTag).length) return afterOpenTag;
  }
  const firstShot = raw.search(/【\s*分镜\s*1\s*】/);
  if (firstShot >= 0) return raw.slice(firstShot).replace(/<\/VIDEO_PROMPT>[\s\S]*$/i, "").trim();
  throw new Error("融合节点没有返回可识别的最终分镜");
};

export async function GET() {return Response.json({presets});}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as NodeRequest;
    const model = resolveDeepSeekModel(request);
    const apiKey = getModelApiKey(model);
    if (!apiKey) return Response.json({error: getMissingKeyMessage(model)}, {status: 503});
    const storyboard = String(body.storyboard || "").trim().slice(0, 50000);
    const performanceStoryboard = String(body.performanceStoryboard || "").trim().slice(0, 50000);
    const script = String(body.script || "").trim().slice(0, 30000);
    const preset = presets.find((item) => item.id === body.nodeId);
    if (!preset || !storyboard) return Response.json({error: "请选择节点并输入待检查分镜。"}, {status: 400});
    if (preset.id === "structure-performance-fusion" && !performanceStoryboard) return Response.json({error: "结构表演融合节点需要同时输入V14-5结构版和V7-2表演版。"}, {status: 400});
    const stages: Stage[] = [];
    const run = async (id: string, name: string, system: string, input: string, json: boolean, current: string) => {
      const started = Date.now();
      const output = await extractContent(apiKey, model, system, input, request.signal, json);
      let result = output;
      if (json && id !== "frame-manifest") result = applyChanges(current, output);
      stages.push({id, name, input, output, result, durationMs: Date.now() - started});
      return result;
    };
    const context = (value: string, label = "待检查分镜") => `原剧本：\n${script || "（未提供）"}\n\n${label}：\n${value}`;
    const custom = String(body.systemPrompt || "").trim();
    let finalResult = storyboard;

    if (preset.id === "shot-split") finalResult = await run("shot-split", preset.name, custom || SHOT_SPLIT, `待检查分镜：\n${storyboard}`, false, storyboard);
    else if (preset.id === "spatial-correction") finalResult = await run("spatial-correction", preset.name, custom || SPATIAL_CORRECTION, context(storyboard), true, storyboard);
    else if (preset.id === "spatial-completion") finalResult = await run("spatial-completion", preset.name, custom || SPATIAL_COMPLETION, context(storyboard, "已纠正分镜"), true, storyboard);
    else if (preset.id === "spatial-pipeline") {
      finalResult = await run("spatial-correction", "第一步 · 空间矛盾纠正", custom || SPATIAL_CORRECTION, context(storyboard), true, storyboard);
      finalResult = await run("spatial-completion", "第二步 · 空间信息完善", SPATIAL_COMPLETION, context(finalResult, "已纠正分镜"), true, finalResult);
    } else if (preset.id === "frame-manifest") finalResult = await run("frame-manifest", preset.name, custom || FRAME_MANIFEST, context(storyboard), true, storyboard);
    else if (preset.id === "frame-closure") {
      const manifest = await run("frame-manifest", "第一步 · 画框清单", FRAME_MANIFEST, context(storyboard), true, storyboard);
      const closureInput = `${context(storyboard)}\n\n画框清单：\n${manifest}`;
      finalResult = await run("frame-closure", "第二步 · 画面闭合修订", custom || FRAME_CLOSURE, closureInput, true, storyboard);
    } else if (preset.id === "structure-performance-fusion") {
      let checkedStructure = await run("fusion-shot-split", "验收1 · 分镜拆分", SHOT_SPLIT, context(storyboard, "V14-5原始分镜"), false, storyboard);
      if (/(?:镜头|画面)?(?:迅速|快速|随后|再)?切回/u.test(checkedStructure)) {
        checkedStructure = await run("fusion-shot-split-recheck", "验收1B · 明确剪辑复检", SHOT_SPLIT_RECHECK, context(checkedStructure, "仍含明确内部剪辑的V14-5分镜"), false, checkedStructure);
        if (/(?:镜头|画面)?(?:迅速|快速|随后|再)?切回/u.test(checkedStructure)) throw new Error("V14-5分镜复检后仍存在明确的内部切镜，已停止融合。请先在分镜拆分节点中修订。");
      }
      checkedStructure = await run("fusion-spatial-correction", "验收2 · 空间矛盾纠正", SPATIAL_CORRECTION, context(checkedStructure, "已拆分V14-5分镜"), true, checkedStructure);
      checkedStructure = await run("fusion-spatial-completion", "验收3 · 空间信息完善", SPATIAL_COMPLETION, context(checkedStructure, "已纠错V14-5分镜"), true, checkedStructure);
      const manifest = await run("fusion-frame-manifest", "验收4 · 画框清单", FRAME_MANIFEST, context(checkedStructure, "已完善V14-5分镜"), true, checkedStructure);
      checkedStructure = await run("fusion-frame-closure", "验收5 · 画面闭合", FRAME_CLOSURE, `${context(checkedStructure, "已完善V14-5分镜")}\n\n画框清单：\n${manifest}`, true, checkedStructure);
      checkedStructure = await run("fusion-dialogue-dedup", "验收6 · 台词归属与去重", DIALOGUE_DEDUP, context(checkedStructure, "画面闭合后的V14-5分镜"), true, checkedStructure);
      const dialogueConflicts = overlappingDialogue(checkedStructure);
      if (dialogueConflicts.length) {
        const targetedInput = `${context(checkedStructure, "仍有台词重复的V14-5分镜")}\n\n已检测到以下整句或包含式重复，必须删除后一个镜头中的重复部分：\n${dialogueConflicts.join("\n")}`;
        checkedStructure = await run("fusion-dialogue-dedup-recheck", "验收6B · 重复台词复检", DIALOGUE_DEDUP, targetedInput, true, checkedStructure);
        if (overlappingDialogue(checkedStructure).length) throw new Error("V14-5复检后仍存在跨分镜重复台词，已停止融合。请先修订台词归属。");
      }
      const fusionInput = `原剧本：\n${script || "（未提供）"}\n\n验收后V14-5结构版分镜：\n${checkedStructure}\n\nV7-2测试版表演版分镜：\n${performanceStoryboard}`;
      const started = Date.now();
      const output = await extractContent(apiKey, model, custom || STRUCTURE_PERFORMANCE_FUSION, fusionInput, request.signal, false);
      finalResult = extractVideoPrompt(output);
      if (overlappingDialogue(finalResult).length) throw new Error("融合结果重新引入了跨分镜重复台词，已拒绝该结果，请重新运行。");
      stages.push({id: "structure-performance-fusion", name: "验收7 · 结构表演融合", input: fusionInput, output, result: finalResult, durationMs: Date.now() - started});
    }
    return Response.json({nodeId: preset.id, finalResult, stages, durationMs: stages.reduce((sum, stage) => sum + stage.durationMs, 0)});
  } catch (error) {return Response.json({error: error instanceof Error ? error.message : "节点测试失败"}, {status: 502});}
}
