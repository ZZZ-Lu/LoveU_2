import {NextRequest} from "next/server";
import {addDebugRound, completeDebugRun, createDebugRun, failDebugRun, setFinalDebugInput} from "./debug-store";
import {getMissingKeyMessage, getModelApiKey, isKimiModel, requestChatCompletions, resolveDeepSeekModel, type DeepSeekModel} from "./model";
import {
  ARCHIVED_PROMPT_OPTIONS,
  DEFAULT_ARCHIVED_PROMPT_VERSION,
  FUSION_PROMPT_VERSION,
  V14_5_PROMPT_VERSION,
  V7_2_TEST_PROMPT_VERSION,
  getArchivedPromptTemplate,
} from "./prompt-archive";

export const runtime = "nodejs";

type GenerateRequest = {
  segmentText?: string; previousText?: string; previousPrompt?: string;
  nextText?: string; nextPrompt?: string; existingPrompt?: string;
  contextSummary?: string;
  beforeContextSummary?: string;
  afterContextSummary?: string;
  continuityState?: string;
  selectedPromptText?: string;
  selectionPrefix?: string;
  selectionSuffix?: string;
  editInstruction?: string;
  allowShotExpansion?: boolean;
  mode?: "replace" | "improve" | "selection";
  promptVersion?: string;
  promptTemplate?: string;
  settings?: {reviewEnabled?: boolean};
};
type Review = {mustFix: string[]; shouldFix: string[]; optional: string[]};
type FrameManifestItem = {
  shot: number;
  atomic: boolean;
  camera: string;
  visible: Array<{name: string; plane: string; state: string; source: string}>;
  excluded: string[];
  missing: string[];
};
type FrameManifest = {shots: FrameManifestItem[]};
type FramePatch = {shot: number; replacement: string};

const clip = (value: unknown, limit = 18000) => typeof value === "string" ? value.slice(0, limit) : "";
const emptyReview = (): Review => ({mustFix: [], shouldFix: [], optional: []});
const splitShots = (prompt: string) => {
  const marker = /【\s*分镜\s*(\d+)\s*】/g;
  const matches = [...prompt.matchAll(marker)];
  return matches.map((match, index) => ({
    number: Number(match[1]),
    text: prompt.slice(match.index || 0, index + 1 < matches.length ? matches[index + 1].index : prompt.length).trim(),
  }));
};
const extractJson = (raw: string) => {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("模型没有返回JSON对象");
  return JSON.parse(raw.slice(start, end + 1)) as unknown;
};
const parseFrameManifest = (raw: string, shotCount: number): FrameManifest => {
  const parsed = extractJson(raw) as {shots?: unknown};
  if (!Array.isArray(parsed.shots) || parsed.shots.length !== shotCount) throw new Error("画框清单与分镜数量不一致");
  const shots = parsed.shots.map((value, index) => {
    const item = value as Partial<FrameManifestItem>;
    if (item.shot !== index + 1 || typeof item.atomic !== "boolean" || !Array.isArray(item.visible)) {
      throw new Error(`画框清单的分镜${index + 1}结构无效`);
    }
    return {
      shot: item.shot,
      atomic: item.atomic,
      camera: typeof item.camera === "string" ? item.camera : "",
      visible: item.visible.slice(0, 12).map((entry) => ({
        name: String(entry?.name || ""),
        plane: String(entry?.plane || ""),
        state: String(entry?.state || ""),
        source: String(entry?.source || ""),
      })).filter((entry) => entry.name),
      excluded: Array.isArray(item.excluded) ? item.excluded.map(String).slice(0, 12) : [],
      missing: Array.isArray(item.missing) ? item.missing.map(String).slice(0, 12) : [],
    };
  });
  return {shots};
};
const parseFramePatches = (raw: string) => {
  let parsed: {changes?: unknown};
  try {
    parsed = extractJson(raw) as {changes?: unknown};
  } catch {
    const start = raw.indexOf("{");
    if (start < 0) throw new Error("画面节点没有返回JSON对象");
    let repaired = raw.slice(start).trim()
      .replace(/},\s*,\s*{/g, "},{")
      .replace(/,\s*([}\]])/g, "$1");
    if (!repaired.endsWith("}")) repaired += "}";
    try { parsed = JSON.parse(repaired) as {changes?: unknown}; }
    catch { throw new Error("画面节点返回的JSON无法解析或安全修复"); }
  }
  if (!Array.isArray(parsed.changes)) throw new Error("画面闭合节点没有返回changes数组");
  return parsed.changes.map((value) => {
    const item = value as Partial<FramePatch>;
    return {shot: Number(item.shot), replacement: String(item.replacement || "").trim()};
  }).filter((item) => Number.isInteger(item.shot) && item.replacement);
};
const parseAtomicPrompt = (raw: string, original: string, script: string) => {
  const firstShot = raw.search(/【\s*分镜\s*1\s*】/);
  const candidate = (firstShot >= 0 ? raw.slice(firstShot) : raw).trim();
  const before = splitShots(original);
  const after = splitShots(candidate);
  if (!candidate || !after.length || after.some((shot, index) => shot.number !== index + 1)) {
    throw new Error("分镜原子化节点没有返回编号连续的完整分镜");
  }
  if (after.length < before.length) throw new Error("分镜原子化节点错误合并了分镜");
  if (candidate.length > original.length * 2.5 + 800) throw new Error("分镜原子化节点改写幅度过大");
  if (quotedText(original).some((line) => !candidate.includes(line))) throw new Error("分镜原子化节点删除或改写了原台词");
  if (characterTags(original).some((name) => !candidate.includes(`【${name}】`))) throw new Error("分镜原子化节点删除了原有人物标记");
  const allowedNames = new Set([...characterTags(original), ...characterTags(script)]);
  if (characterTags(candidate).some((name) => !allowedNames.has(name))) throw new Error("分镜原子化节点增加了未授权人物");
  return candidate;
};
const quotedText = (value: string) => [...value.matchAll(/[“"]([^”"]+)[”"]/g)].map((match) => match[1].trim()).filter(Boolean);
const characterTags = (value: string) => [...value.matchAll(/【([^】]+)】/g)]
  .map((match) => match[1].trim())
  .filter((name) => !/^分镜\s*\d+$/.test(name));
const applyFramePatches = (prompt: string, manifest: FrameManifest, patches: FramePatch[], script: string) => {
  const shots = splitShots(prompt);
  if (!shots.length || shots.some((shot, index) => shot.number !== index + 1)) throw new Error("原分镜编号无法用于画面闭合");
  const allowedNames = new Set([...characterTags(prompt), ...characterTags(script)]);
  const accepted: number[] = [];
  const rejected: Array<{shot: number; reason: string}> = [];
  const replacements = new Map<number, string>();
  for (const patch of patches) {
    const original = shots[patch.shot - 1]?.text;
    const frame = manifest.shots[patch.shot - 1];
    let reason = "";
    if (!original || !frame) reason = "分镜不存在";
    else if (!frame.atomic) reason = "分镜不是单一连续镜头";
    else if (!patch.replacement.startsWith(`【分镜${patch.shot}】`)) reason = "分镜编号或格式被改变";
    else if ((patch.replacement.match(/【\s*分镜\s*\d+\s*】/g) || []).length !== 1) reason = "replacement包含多个分镜";
    else if (patch.replacement.length > original.length * 2.5 + 300) reason = "补写幅度过大";
    else if (quotedText(original).some((line) => !patch.replacement.includes(line))) reason = "原台词被删除或改写";
    else if (characterTags(original).some((name) => !patch.replacement.includes(`【${name}】`))) reason = "原有人物标记被删除";
    else if (characterTags(patch.replacement).some((name) => !allowedNames.has(name))) reason = "增加了未授权人物";
    if (reason) rejected.push({shot: patch.shot, reason});
    else {
      replacements.set(patch.shot, patch.replacement);
      accepted.push(patch.shot);
    }
  }
  return {
    prompt: shots.map((shot) => replacements.get(shot.number) || shot.text).join("\n\n"),
    accepted,
    rejected,
  };
};
const chineseNumber = (value: string) => {
  if (/^\d+$/.test(value)) return Number(value);
  const digits: Record<string, number> = {"零": 0, "〇": 0, "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9};
  if (value === "十") return 10;
  const ten = value.indexOf("十");
  if (ten >= 0) return (ten === 0 ? 1 : digits[value[ten - 1]] || 0) * 10 + (ten === value.length - 1 ? 0 : digits[value[ten + 1]] || 0);
  return digits[value] || NaN;
};
const parseDirectorOutput = (raw: string) => {
  const tagged = /<VIDEO_PROMPT>([\s\S]*?)<\/VIDEO_PROMPT>/i.exec(raw);
  const openTag = /<VIDEO_PROMPT>/i.exec(raw);
  const scope = tagged?.[1] || (openTag?.index !== undefined ? raw.slice(openTag.index + openTag[0].length) : raw);
  const marker = /【\s*分镜\s*([0-9一二三四五六七八九十〇零]+)\s*】/g;
  const markers = [...scope.matchAll(marker)];
  if (!markers.length || chineseNumber(markers[0][1]) !== 1) throw new Error("模型未返回有效分镜：没有找到分镜1。原始输出已保存在调试日志中。");
  const numbers = markers.map((item) => chineseNumber(item[1]));
  if (numbers.some((number, index) => number !== index + 1)) throw new Error("模型返回的分镜编号不连续。原始输出已保存在调试日志中。");
  const shotIndex = markers[0].index || 0;
  const prompt = scope.slice(shotIndex).replace(/\s*```\s*$/u, "").trim();
  if (!prompt) throw new Error("模型未返回有效的视频提示词。原始输出已保存在调试日志中。");
  const beforeTag = tagged?.index ? raw.slice(0, tagged.index) : "";
  const imagination = [beforeTag, scope.slice(0, shotIndex)].filter(Boolean).join("\n").trim();
  return {imagination, prompt};
};

const parseSelectionOutput = (raw: string, _original?: string, _allowShotExpansion?: boolean) => {
  const imagination = raw.match(/<analysis>([\s\S]*?)<\/analysis>/i)?.[1]?.trim() || "";
  const tagged = raw.match(/<replacement>([\s\S]*?)<\/replacement>/i)?.[1]?.trim();
  const fallback = raw.split(/最终提示词\s*[：:]?/).at(-1)?.trim() || raw.trim();
  const prompt = (tagged || fallback).trim();
  return {prompt, imagination, cropped: false};
};

const parseReview = (raw: string): Review => {
  try {
    const parsed = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
    const list = (value: unknown) => Array.isArray(value) ? value.map(String).filter(Boolean).slice(0, 8) : [];
    return {mustFix: list(parsed.mustFix), shouldFix: list(parsed.shouldFix), optional: list(parsed.optional)};
  } catch {return {mustFix: ["验收输出无法解析，请导演自行重新检查剧本与提示词。"], shouldFix: [], optional: []};}
};

async function callDeepSeek(apiKey: string, model: DeepSeekModel, messages: Array<{role: string; content: string}>, signal: AbortSignal, json = false, temperature = 0.8, maxTokens = 7000) {
  if (isKimiModel(model)) {
    const {response, payload} = await requestChatCompletions(model, apiKey, {messages, json, temperature, maxTokens}, signal);
    if (!response.ok) throw new Error(`Kimi 请求失败（${response.status}）：${(await response.text()).slice(0, 300)}`);
    const data = await response.json();
    const content = String(data.choices?.[0]?.message?.content || "").trim();
    const reasoning = String(data.choices?.[0]?.message?.reasoning_content || "").trim();
    const rawOutput = reasoning ? `思考过程：\n${reasoning}\n\n${content}` : content;
    return {rawInput: JSON.stringify(payload), rawOutput};
  }
  // 普通文本是 API 默认输出模式；仅结构化节点声明 json_object。
  // 部分 DeepSeek 网关会将 response_format: {type: "text"} 视为非标准参数并直接报内部错误。
  const payload = {model, messages, temperature, thinking: {type: "disabled"}, max_tokens: maxTokens, ...(json ? {response_format: {type: "json_object" as const}} : {}), stream: false};
  const localProxy = process.env.DEEPSEEK_LOCAL_PROXY_URL;
  // 本地预览优先走代理；代理网络短暂失败时，服务端会自动直连官方接口。
  // 上游偶发 5xx 时重试，避免把 DeepSeek 的临时 internal error 直接暴露给用户。
  const endpoints: Array<{url: string; headers: Record<string, string>}> = localProxy
    ? [
        {url: localProxy, headers: {"Content-Type": "application/json"}},
        {url: "https://api.deepseek.com/chat/completions", headers: {"Content-Type": "application/json", Authorization: `Bearer ${apiKey}`}},
      ]
    : [{url: "https://api.deepseek.com/chat/completions", headers: {"Content-Type": "application/json", Authorization: `Bearer ${apiKey}`}}];
  let lastError = "";

  for (let attempt = 0; attempt < 3; attempt += 1) {
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint.url, {
          method: "POST",
          headers: endpoint.headers,
          body: JSON.stringify(payload),
          signal,
        });
        if (response.ok) {
          const data = await response.json();
          return {rawInput: JSON.stringify(payload), rawOutput: String(data.choices?.[0]?.message?.content || "").trim()};
        }
        const detail = (await response.text()).slice(0, 300);
        // 请求本身不合法、鉴权失效或余额权限问题不应被重试掩盖。
        if ([400, 401, 403].includes(response.status)) {
          throw new Error(`DeepSeek 请求失败（${response.status}）：${detail}`);
        }
        lastError = `DeepSeek 请求失败（${response.status}）：${detail}`;
      } catch (error) {
        if (signal.aborted) throw error;
        const message = error instanceof Error ? error.message : "网络请求失败";
        if (/DeepSeek 请求失败（(400|401|403)）/.test(message)) throw error;
        lastError = message;
      }
    }
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
  }

  throw new Error(`DeepSeek 暂时不可用，已自动重试后仍未成功。${lastError ? `原因：${lastError}` : ""}`);
}

const REVIEW_FORMAT = `只返回JSON，不使用Markdown：{"mustFix":[],"shouldFix":[],"optional":[]}。每条必须指出具体分镜、证据和修改方向，但不要重写提示词。没有问题就返回空数组。`;
const FIDELITY_REVIEW = `你是短剧提示词的剧本忠实度验收员。只检查原台词是否完整、说话人是否正确、标点语气是否被改变、是否补写台词、是否增加会改变剧情阶段的重大动作或提前演完后续情绪。合理的微表情、视线、运镜和强因果视觉补充不是错误。${REVIEW_FORMAT}`;
const RHYTHM_REVIEW = `你是中国竖屏短剧的镜头节奏验收员。检查台词节拍与编号分镜是否匹配、是否把多次发言或多个情绪击点挤在一个编号里。短剧允许并鼓励9个或更多镜头、频繁切镜和自然的复合运镜，不要把高密度本身当成问题。${REVIEW_FORMAT}`;
const VISUAL_REVIEW = `你是短剧画面连续性验收员。检查左右位置、朝向、视线、姿势、景别能否拍到所述动作、运镜是否符合自然空间、相邻镜头是否重复，以及人物微动作是否真正传达潜台词。只指出可以从剧本和提示词中证明的问题，不因个人审美强迫重写。${REVIEW_FORMAT}`;
const RECHECK_REVIEW = `你是最终复验员。综合检查剧本忠实度、镜头节奏密度、画面连续性和提示词格式。短剧允许9个以上镜头、频繁切镜和复合运镜。只报告仍然存在的明确问题，不重写提示词。${REVIEW_FORMAT}`;
const FRAME_MANIFEST_SYSTEM = `你是坐在监视器前逐镜复盘的短剧导演。不要先背规则；在内部把每个分镜从第一帧播放到最后一帧，确定摄影机、画框边界，以及前景、中景、背景中真正可见的全部人物和关键物件。

画面里有的必须进入清单；画面里没有的不能进入清单。特写默认只包含主体局部，除非原文明确建立肩膀、倒影、前景或背景人物。过肩镜头必须确认前景属于谁。中景、全景和多人构图要检查所有落入画框的人物。画外音不代表说话者可见。

每个可见元素都必须注明来源，source只能是“剧本”“当前分镜”“前序状态”或“机位必然”。没有来源的内容不能加入。原文没有给背景人物新动作时，只能沿用前序状态；没有前序状态时写“保持原位”，不能创造表情、手势、视线、具体距离、左右位置、环境装饰或道具。

如果一个编号中明确包含切到另一个独立机位、时间跳跃或无法由一次连续运镜完成的第二套构图，将atomic设为false。此时只记录已有画面，不尝试修订。

只返回合法JSON：
{"shots":[{"shot":1,"atomic":true,"camera":"景别、机位和方向","visible":[{"name":"人物或物件","plane":"前景/中景/背景","state":"可证明的位置、姿态和动作","source":"当前分镜"}],"excluded":["原文提到但画框外不可见的内容"],"missing":["画框内必然可见却漏写的内容"]}]}
不得输出Markdown、解释或清单之外的文字。`;
const FRAME_CLOSURE_SYSTEM = `你是画面闭合修订导演。你会收到原剧本、原分镜和已经审核过的画框清单。

先在内部按清单重新播放画面。只修订atomic为true且missing或excluded非空的分镜。画框清单是封闭集合：replacement中出现的可见人物和关键物件必须来自visible；不得加入清单之外的表情、动作、手势、视线、距离、左右位置、环境、装饰、灯光或道具。

missing中的画框内元素必须用最短文字补入。excluded中的画框外内容必须删除或改成不声称其可见的表达；画外人物除必要的画外音外不要提及。保留原镜头的景别、机位、运镜、剧情、台词、人物格式和表演意图。不拆分、合并或重排镜头。不修改没有问题的分镜。

只返回合法JSON：
{"changes":[{"shot":2,"replacement":"【分镜2】\\n修订后的完整单个分镜"}]}
没有安全修改时返回{"changes":[]}。不得输出Markdown、分析或整篇分镜。`;
const SHOT_SPLIT_SYSTEM = `你是短剧分镜的镜头原子性检查师。

你的任务是检查每个【分镜】能否由同一台摄影机，在一次连续拍摄中自然完成。你不能因为景别变化、主体变化或运镜较长就机械拆分。

只有当原分镜内部存在必须通过剪辑才能完成的机位跳变时，才进行拆分。

【必须拆分】

1. 明确出现“切到、反打、另一个角度、画面切换”等剪辑指令。

2. 摄影机位置瞬间改变。
例如：正面特写人物 → 俯拍人物全身；门外视角 → 房间内部视角；人物左侧过肩 → 人物右侧反打。

3. 构图无法通过所写运镜连续抵达。
例如：刀锋大特写 → 沈淮青正面脸部特写，但没有说明摄影机如何从刀锋移动到人物正面。

4. 同一时刻使用了相互矛盾的机位或角度。
例如：同一个连续镜头先俯拍人物，又在没有环绕、下降或机位移动说明的情况下变成低位仰拍。

5. 前后画面存在时间跳跃、空间跳跃或动作不连续。

【不要拆分】

1. 连续推、拉、摇、移、跟随、环绕带来的景别变化。

2. 摄影机沿明确路径从一个主体移动到另一个主体。
例如：从地上的母子上摇到站立的萧綦；从萧綦收刀的手部上摇到他的脸；从刀锋下摇到刀锋下方的沈淮青。

3. 同一人物的连续动作。
例如：腿软、跌坐、撑地、喘气。

4. 同一空间内能够通过一次连续调度完成的多人动作。

5. 虽然内容较长，但摄影机位置、拍摄方向和时间始终连续。

【判断方法】

检查每个分镜时，在内部回答以下问题，但不要输出判断过程：
- 摄影机从哪里开始？
- 摄影机经过什么路径？
- 摄影机最后停在哪里？
- 这个路径在真实空间中是否连续可拍？
- 中间是否必须停机、剪辑或瞬间换机位？

只有最后一个问题的答案是“是”，才允许拆分。

【修改原则】

- 只修复必须剪辑却被写成一个分镜的情况。
- 边界案例默认保留，不拆分。
- 不重新设计导演方案。
- 不增加动作、表情、场景、灯光或台词。
- 保持原有信息与镜头顺序。
- 拆分后重新连续编号。
- 如果全部可以连续拍摄，则原样输出。
- 只输出整理后的完整分镜，不输出分析、修改说明、JSON或Markdown。`;
const SPATIAL_CORRECTION_SYSTEM = `你是分镜空间矛盾纠正师。先连续阅读全部分镜，只检查以下事实是否前后矛盾：角色和重要道具的位置、前景背景、朝向、视线、持有关系及出入画状态。

发现明确矛盾时，必须删除错误的空间描述并替换为与原剧本、前一镜和人物动作一致的描述。纠正空间错误的权限高于“保留原文”，但不得改变台词、剧情、动作、人物、道具、景别、运镜、镜头顺序和分镜数量。不要补充缺失信息；没有明确矛盾的分镜保持原样。

只返回合法JSON：
{"changes":[{"shot":2,"replacement":"【分镜2】\\n纠正后的完整单个分镜"}]}
只有真正纠正了矛盾的分镜才进入changes；没有矛盾时返回{"changes":[]}。不得输出Markdown、分析或整篇分镜。`;

const SPATIAL_COMPLETION_SYSTEM = `你是分镜空间信息完善师。输入已经完成空间矛盾纠正。逐镜检查并补齐以下信息：

1. 环境背景：只有原剧本或现有分镜提供明确依据时才描述。没有依据时可以省略环境背景，不得使用“模糊的室内陈设”“普通房间”等占位内容。
2. 角色画面层次：每个入画角色都必须明确说明位于画面纵深的前景、中景或背景。这项要求与环境背景无关，即使不写环境，也不能省略角色的画面层次。镜头景别和角色层次是两回事；例如“中景镜头”不能自动代表角色位于画面中景。为避免歧义，描述中必须写明“角色位于画面层次的前景、中景或背景”。
3. 角色画面位置：每个入画角色都必须说明位于画面左侧、中央还是右侧。
4. 身体朝向：每个入画角色、每个分镜都必须说明身体朝向画面上方、下方、左侧、右侧、镜头或画面深处。
5. 视线方向：每个入画角色、每个分镜都必须单独说明视线看向哪里，不得省略，也不能只写“注视”“望着”或“看向前方”。
   - 被注视的角色或道具同时出现在当前画面内时，可以写“视线看向画面左侧的某角色/道具”等画面方向加对象。
   - 被注视的角色或道具没有出现在当前画面内时，绝对不能写“看向某角色/道具”；必须改写为“视线看向画面左侧、右侧、上方、下方、镜头方向或画面深处”等可见的画面方向。
   - 不能因为台词正在对某人说，就默认对方在画面中。只有当前分镜文字明确写出该对象入画，才允许把对象写进视线描述。
6. 画面展示角色的哪些部位，例如全身、上半身、肩背、侧脸或脸部。
7. 角色背对镜头时必须明确写出；角色面对镜头时无需特别说明。
8. 每个重要道具位于画面哪里，以及道具的朝向。

只补齐有原剧本、当前分镜或前后镜头依据的信息，不得凭空猜测环境，不得推翻或改变输入中已经确定的空间事实。不得新增人物、道具、动作、表情、台词、剧情、布景、景别、运镜或分镜；不得删除或改写原有内容。没有缺失的分镜保持原样。

只返回合法JSON：
{"changes":[{"shot":2,"replacement":"【分镜2】\\n修订后的完整单个分镜"}]}
只有发生必要补全的分镜才进入changes；全部完整时返回{"changes":[]}。必须保证JSON完整闭合，不得使用尾随逗号或重复逗号。不得输出Markdown、分析或整篇分镜。`;
const OUTPUT_GATE = `你可以在最终结果之前自由分析和想象画面，但最终视频提示词必须单独放在以下标记内：
<VIDEO_PROMPT>
【分镜1】
……
</VIDEO_PROMPT>
标记内部只能出现从【分镜1】开始、编号连续的最终视频提示词，不得放入分析、解释、创作过程或总结。`;
const FUSION_SYSTEM = `你坐在监视器前，要把同一段剧本生成的两个版本放在一起看。V14-5已经给出了准备保留的分镜设计，V7-2测试版里可能藏着更有感染力的表演。你的工作不是重新想一套分镜，而是先真正看懂两版各自在做什么，再把值得保留的表演放回V14-5的画面里。

先完整读一遍原剧本，记住人物、台词、动作和事情发生的先后。然后从V14-5的分镜1开始，一个镜头一个镜头往下看。每看到一个V14-5镜头，就去V7-2测试版里寻找同一段剧情正在怎样表演；两边分镜数量不同时，不要按编号机械配对，而要按台词、动作和情绪发生的时刻寻找对应关系。

这个逐镜对照过程要全部写出来。说清楚V14-5这一镜原本拍什么，V7-2在同一时刻多看见了哪些呼吸、停顿、眼神、面部变化、身体重心或动作力度；再把画面放进脑中播放，判断这些表演在V14-5现有景别和构图中能不能真的被镜头看见，加入后会不会改变原剧本、人物位置、动作顺序或镜头边界。能让画面更有感染力而且拍得到的，记为准备添加；只是心理解释、画面看不见、与剧本冲突或会把镜头结构带乱的，就在推演中说明为什么不采用。

全部镜头对比完以后，再单独做一次总结，明确列出最终准备从V7-2测试版添加到V14-5中的表演细节，并注明它们分别进入V14-5的哪一个分镜。如果没有值得添加的细节，也要如实说明。

完成逐镜对比和添加总结之后，才开始写最终分镜。最终结果沿用V14-5的分镜骨架，把刚才总结中确定的表演细节自然写入对应画面，不要在这一步临时产生总结之外的新设计。

最终稿必须保持V14-5的分镜数量、顺序、景别、机位和台词归属，不新增、删除或合并分镜。写完后再默读一次最终稿，删除跨分镜重复的台词与动作。`;

export async function GET() {
  const exposedOptions = ARCHIVED_PROMPT_OPTIONS;
  return Response.json({
    current: DEFAULT_ARCHIVED_PROMPT_VERSION,
    options: exposedOptions.map(({value, label, note}) => ({value, label, note})),
  });
}

export async function POST(request: NextRequest) {
  const model = resolveDeepSeekModel(request); console.log("Received cookies:", request.cookies.getAll(), "Resolved model:", model);
  const apiKey = getModelApiKey(model);
  if (!apiKey) return Response.json({error: getMissingKeyMessage(model)}, {status: 503});
  let body: GenerateRequest;
  try {body = await request.json();} catch {return Response.json({error: "请求内容无效。"}, {status: 400});}
  const segmentText = clip(body.segmentText).trim();
  if (!segmentText) return Response.json({error: "片段内容为空。"}, {status: 400});
  const allowedPromptOptions = ARCHIVED_PROMPT_OPTIONS;
  const promptVersion = typeof body.promptVersion === "string" && allowedPromptOptions.some((item) => item.value === body.promptVersion)
    ? body.promptVersion
    : DEFAULT_ARCHIVED_PROMPT_VERSION;
  const debugRun = createDebugRun(segmentText, model);
  let logIndex = 0;
  const allowShotExpansion = body.mode === "selection" && body.allowShotExpansion === true;
  const logNode = (name: string, startedAt: number, rawInput: string, rawOutput: string, observation: unknown, imagination = "") => {
    addDebugRound(debugRun.id, {index: ++logIndex, sentenceIndex: 1, reactStep: logIndex, scriptUnit: segmentText, startedAt, durationMs: Date.now() - startedAt, rawModelInput: rawInput, rawModelOutput: rawOutput, workingNote: imagination, action: name, actionInput: {segmentText, promptVersion}, observation, workspaceAfter: null, imaginationRawInput: name.startsWith("director") ? rawInput : undefined, imaginationRawOutput: imagination || undefined});
  };

  try {
    const task = body.mode === "selection"
      ? `执行一次精准的局部修改推演。针对 <selection> 内的文字进行修改，<before> 与 <after> 只是边界参照。\n\n<before>\n${clip(body.selectionPrefix, 500)}\n</before>\n\n<selection>\n${clip(body.selectedPromptText)}\n</selection>\n\n<after>\n${clip(body.selectionSuffix, 500)}\n</after>\n\n<comment>\n${clip(body.editInstruction)}\n</comment>\n\n先像导演一样在脑中连续播放选区前、选区和选区后的画面，围绕用户批注进行局部意识流推演：检查动作承接、人物位置、朝向、视线、情绪和运镜是否顺畅；想清楚后再给出修改结果。`
      : body.mode === "improve" ? `在现有提示词基础上重新想象并改进：\n${clip(body.existingPrompt)}` : "从头想象并撰写这个片段的视频提示词。";
    const context = [
      clip(body.beforeContextSummary, 2000) ? `前文原文（当前片段之前最近5行正文）：\n${clip(body.beforeContextSummary, 2000)}` : "",
      clip(body.continuityState, 4000) ? `上一片段结束时的画面状态：\n${clip(body.continuityState, 4000)}` : "",
      `当前选中片段：\n${segmentText}`,
      clip(body.afterContextSummary, 2000) ? `后文原文（当前片段之后最近5行正文）：\n${clip(body.afterContextSummary, 2000)}` : "",
      clip(body.previousPrompt) ? `上一片段提示词（仅用于画面衔接）：\n${clip(body.previousPrompt)}` : "",
      clip(body.nextPrompt) ? `下一片段提示词（仅用于画面衔接）：\n${clip(body.nextPrompt)}` : "",
      `任务：\n${task}`,
    ].filter(Boolean).join("\n\n");
    const customPromptTemplate = typeof body.promptTemplate === "string" ? body.promptTemplate.trim().slice(0, 120000) : "";
    const localEditGate = `你正在执行有边界的导演式局部修改。必须先进行自然连续的局部意识流推演，再给出修改结果。输出格式必须且只能是：<analysis>局部意识流推演</analysis><replacement>修改后的分镜提示词</replacement>。`;
    const useFusionPipeline = promptVersion === FUSION_PROMPT_VERSION && body.mode !== "selection" && !customPromptTemplate;
    const basePromptVersion = promptVersion === FUSION_PROMPT_VERSION ? V14_5_PROMPT_VERSION : promptVersion;
    let directorSystem = `${(customPromptTemplate || getArchivedPromptTemplate(basePromptVersion)).replace("{{插入剧本片段}}", segmentText)}\n\n${body.mode === "selection" ? localEditGate : OUTPUT_GATE}`;
    let draftStarted = Date.now();
    let draftCall: Awaited<ReturnType<typeof callDeepSeek>>;
    let localEditWarning = "";
    let revisionContext = context;
    let draft: ReturnType<typeof parseDirectorOutput>;
    if (useFusionPipeline) {
      const parallelStarted = Date.now();
      const v14System = `${getArchivedPromptTemplate(V14_5_PROMPT_VERSION).replace("{{插入剧本片段}}", segmentText)}\n\n${OUTPUT_GATE}`;
      const v72System = `${getArchivedPromptTemplate(V7_2_TEST_PROMPT_VERSION).replace("{{插入剧本片段}}", segmentText)}\n\n${OUTPUT_GATE}`;
      const [v14Call, v72Call] = await Promise.all([
        callDeepSeek(apiKey, model, [
          {role: "system", content: v14System},
          {role: "user", content: `${context}\n\n你位于双路生成流程的“分镜结构”节点。按当前提示词完整生成，重点保证镜头设计、人物调度和空间连续性。`},
        ], request.signal),
        callDeepSeek(apiKey, model, [
          {role: "system", content: v72System},
          {role: "user", content: `${context}\n\n你位于双路生成流程的“表演设计”节点。按当前提示词完整生成，重点让人物表演、情绪递进和动作力度具有感染力。`},
        ], request.signal),
      ]);
      if (!v14Call.rawOutput || !v72Call.rawOutput) throw new Error("并行生成节点没有返回完整结果");

      let v14Draft: ReturnType<typeof parseDirectorOutput>;
      let v72Draft: ReturnType<typeof parseDirectorOutput>;
      try {
        v14Draft = parseDirectorOutput(v14Call.rawOutput);
        logNode("director_v14_5", parallelStarted, v14Call.rawInput, v14Call.rawOutput, {prompt: v14Draft.prompt}, v14Draft.imagination);
      } catch (error) {
        logNode("director_v14_5_invalid", parallelStarted, v14Call.rawInput, v14Call.rawOutput, {parseError: error instanceof Error ? error.message : "V14-5分镜解析失败"}, v14Call.rawOutput);
        throw error;
      }
      try {
        v72Draft = parseDirectorOutput(v72Call.rawOutput);
        logNode("director_v7_2_performance", parallelStarted, v72Call.rawInput, v72Call.rawOutput, {prompt: v72Draft.prompt}, v72Draft.imagination);
      } catch (error) {
        logNode("director_v7_2_performance_invalid", parallelStarted, v72Call.rawInput, v72Call.rawOutput, {parseError: error instanceof Error ? error.message : "V7-2分镜解析失败"}, v72Call.rawOutput);
        throw error;
      }

      directorSystem = `${FUSION_SYSTEM}\n\n${OUTPUT_GATE}`;
      const fusionInput = `原剧本：\n${segmentText}\n\n<V14_5_STRUCTURE>\n${v14Draft.prompt}\n</V14_5_STRUCTURE>\n\n<V7_2_PERFORMANCE>\n${v72Draft.prompt}\n</V7_2_PERFORMANCE>`;
      revisionContext = fusionInput;
      draftStarted = Date.now();
      draftCall = await callDeepSeek(apiKey, model, [
        {role: "system", content: directorSystem},
        {role: "user", content: fusionInput},
      ], request.signal, false, 0.3, 7000);
      if (!draftCall.rawOutput) throw new Error("融合节点没有返回结果");
      try {
        draft = parseDirectorOutput(draftCall.rawOutput);
      } catch (error) {
        logNode("director_fusion_invalid", draftStarted, draftCall.rawInput, draftCall.rawOutput, {parseError: error instanceof Error ? error.message : "融合分镜解析失败"}, draftCall.rawOutput);
        throw error;
      }
      logNode("director_fusion", draftStarted, draftCall.rawInput, draftCall.rawOutput, {prompt: draft.prompt}, draft.imagination);
    } else {
      draftCall = await callDeepSeek(apiKey, model, [{role: "system", content: directorSystem}, {role: "user", content: context}], request.signal);
      if (!draftCall.rawOutput) throw new Error("DeepSeek 没有返回初稿");
      try {
        if (body.mode === "selection") {
        const original = clip(body.selectedPromptText);
        let parsed: ReturnType<typeof parseSelectionOutput>;
        try {
          parsed = parseSelectionOutput(draftCall.rawOutput, original, allowShotExpansion);
        } catch (firstError) {
          logNode("director_selection_out_of_bounds", draftStarted, draftCall.rawInput, draftCall.rawOutput, {
            parseError: firstError instanceof Error ? firstError.message : "局部修改越过选区",
          }, draftCall.rawOutput);
          const retryStarted = Date.now();
          const retryInstruction = `上一次输出不符合局部修改格式。请重新输出，严格使用 <analysis>...</analysis><replacement>...</replacement>。`;
          draftCall = await callDeepSeek(apiKey, model, [
            {role: "system", content: directorSystem},
            {role: "user", content: context},
            {role: "assistant", content: draftCall.rawOutput},
            {role: "user", content: retryInstruction},
          ], request.signal);
          draftStarted = retryStarted;
          if (!draftCall.rawOutput) throw new Error("DeepSeek 没有返回局部修改结果");
          parsed = parseSelectionOutput(draftCall.rawOutput, original, allowShotExpansion);
        }
        if (parsed.cropped) localEditWarning = "模型误带的相邻分镜已被自动移除，预览中仅保留当前选区。";
        if (!allowShotExpansion && parsed.prompt.length > Math.max(original.length * 3, original.length + 120) && !localEditWarning) {
          localEditWarning = "修改结果比原选区长得多，请确认后再接受。";
        }
        draft = parsed;
        } else {
          draft = parseDirectorOutput(draftCall.rawOutput);
        }
      } catch (error) {
        logNode("director_draft_invalid", draftStarted, draftCall.rawInput, draftCall.rawOutput, {parseError: error instanceof Error ? error.message : "分镜解析失败"}, draftCall.rawOutput);
        throw error;
      }
      logNode("director_draft", draftStarted, draftCall.rawInput, draftCall.rawOutput, {prompt: draft.prompt}, draft.imagination);
    }

    let finalPrompt = draft.prompt;
    let finalRawInput = draftCall.rawInput;

    if (body.settings?.reviewEnabled) {

    const reviewInput = `原剧本：\n${segmentText}\n\n待验收提示词：\n${draft.prompt}`;
    const reviewSpecs = [
      {name: "review_fidelity", prompt: FIDELITY_REVIEW},
      {name: "review_rhythm", prompt: RHYTHM_REVIEW},
      {name: "review_visual", prompt: VISUAL_REVIEW},
    ];
    const reviewStarted = Date.now();
    const reviewCalls = await Promise.all(reviewSpecs.map((spec) => callDeepSeek(apiKey, model, [{role: "system", content: spec.prompt}, {role: "user", content: reviewInput}], request.signal, true, 0.2, 1600)));
    const reviews = reviewCalls.map((call, index) => {
      const review = parseReview(call.rawOutput);
      logNode(reviewSpecs[index].name, reviewStarted, call.rawInput, call.rawOutput, review);
      return review;
    });
    const merged = reviews.reduce((all, review) => ({mustFix: [...all.mustFix, ...review.mustFix], shouldFix: [...all.shouldFix, ...review.shouldFix], optional: [...all.optional, ...review.optional]}), emptyReview());

    if (merged.mustFix.length || merged.shouldFix.length) {
      const revisionStarted = Date.now();
      const revisionInput = `${revisionContext}\n\n这是你的初稿：\n${draftCall.rawOutput}\n\n以下是验收节点提出的问题。你仍然拥有最终创作权，请重新用意识流审视，只修改确实成立的问题，然后输出完整修改稿：\n${JSON.stringify(merged, null, 2)}`;
      const revisionCall = await callDeepSeek(apiKey, model, [{role: "system", content: directorSystem}, {role: "user", content: revisionInput}], request.signal);
      if (revisionCall.rawOutput) {
        let revised: ReturnType<typeof parseDirectorOutput>;
        try {
          revised = parseDirectorOutput(revisionCall.rawOutput);
        } catch (error) {
          logNode("director_revision_invalid", revisionStarted, revisionCall.rawInput, revisionCall.rawOutput, {parseError: error instanceof Error ? error.message : "分镜解析失败"}, revisionCall.rawOutput);
          throw error;
        }
        finalPrompt = revised.prompt; finalRawInput = revisionCall.rawInput;
        logNode("director_revision", revisionStarted, revisionCall.rawInput, revisionCall.rawOutput, {prompt: revised.prompt, appliedReviews: merged}, revised.imagination);

        const recheckStarted = Date.now();
        const recheckCall = await callDeepSeek(apiKey, model, [{role: "system", content: RECHECK_REVIEW}, {role: "user", content: `原剧本：\n${segmentText}\n\n修改后提示词：\n${finalPrompt}`}], request.signal, true, 0.2, 1800);
        logNode("review_final", recheckStarted, recheckCall.rawInput, recheckCall.rawOutput, parseReview(recheckCall.rawOutput));
      }
    }
    } // End of reviewEnabled block

    if (body.mode === "selection") {
      const postStarted = Date.now();
      const postSystem = `你是一个专门处理分镜数据的精准文本提取程序。
用户的原始提示词中有一个被选中的片段（选区）<selection>，以及相邻的 <before> 和 <after> 作为上下文。
AI 基于用户的修改指令 <comment>，生成了修改后的内容 <modified>。
因为 AI 倾向于发散，<modified> 中不仅包含选区被修改后的结果，还常常错误地把 <before> 或 <after> 里的未修改分镜也输出了一遍。

请你结合上下文和用户的修改指令，仔细对比 <selection> 和 <modified>，精确提取出 <modified> 中【真正对应于原 <selection> 范围及其修改目标】的那部分分镜内容。分镜数量的增加或减少都是有可能的，但你必须严格剔除那些明显属于 <before> 或 <after> 的相邻未修改分镜。

输出要求：
1. 你的输出将直接替换原剧本中的选区内容，请务必保证上下文逻辑顺畅。
2. 直接输出提取后的最终提示词文本，绝对不要包含任何额外的解释说明、XML 标签或 markdown 格式。`;
      const postInput = `用户的修改指令：\n<comment>\n${clip(body.editInstruction)}\n</comment>\n\n选区前文（仅作边界参考）：\n<before>\n${clip(body.selectionPrefix, 500)}\n</before>\n\n原选区内容：\n<selection>\n${clip(body.selectedPromptText)}\n</selection>\n\n选区后文（仅作边界参考）：\n<after>\n${clip(body.selectionSuffix, 500)}\n</after>\n\nAI修改后生成的完整内容（可能多包含了before或after里的分镜）：\n<modified>\n${finalPrompt}\n</modified>`;

      const postCall = await callDeepSeek(apiKey, model, [{role: "system", content: postSystem}, {role: "user", content: postInput}], request.signal, false, 0.1);
      if (postCall.rawOutput) {
        finalRawInput = postCall.rawInput;
        finalPrompt = postCall.rawOutput.trim();
        logNode("director_selection_postprocess", postStarted, postCall.rawInput, postCall.rawOutput, {prompt: finalPrompt});
      }
    }

    // “验收”是三个后处理节点的总开关；局部编辑不改变原有的边界提取流程。
    const runAcceptanceNodes = body.mode !== "selection" && body.settings?.reviewEnabled === true;
    if (runAcceptanceNodes && splitShots(finalPrompt).length) {
      // 1. 分镜拆分：只在必须剪辑的机位跳变处拆分，并先做严格保真校验。
      const splitStarted = Date.now();
      const beforeSplit = finalPrompt;
      try {
        const splitCall = await callDeepSeek(
          apiKey,
          model,
          [{role: "system", content: SHOT_SPLIT_SYSTEM}, {role: "user", content: `待检查分镜：\n${beforeSplit}`}],
          request.signal,
          false,
          0.1,
          5200,
        );
        finalPrompt = parseAtomicPrompt(splitCall.rawOutput, beforeSplit, segmentText);
        if (finalPrompt !== beforeSplit) finalRawInput = splitCall.rawInput;
        logNode("shot_split", splitStarted, splitCall.rawInput, splitCall.rawOutput, {
          changed: finalPrompt !== beforeSplit,
          shotCountBefore: splitShots(beforeSplit).length,
          shotCountAfter: splitShots(finalPrompt).length,
          prompt: finalPrompt,
        });
      } catch (error) {
        finalPrompt = beforeSplit;
        logNode("shot_split_fallback", splitStarted, "", "", {
          reason: error instanceof Error ? error.message : "分镜拆分节点失败",
          prompt: beforeSplit,
        });
      }

      // 2a. 空间矛盾纠正：先删除并替换前后冲突的空间事实。
      const correctionStarted = Date.now();
      const beforeCorrection = finalPrompt;
      try {
        const correctionShots = splitShots(beforeCorrection);
        const correctionManifest: FrameManifest = {shots: correctionShots.map((shot) => ({
          shot: shot.number, atomic: true, camera: "", visible: [], excluded: [], missing: [],
        }))};
        const correctionCall = await callDeepSeek(
          apiKey,
          model,
          [{role: "system", content: SPATIAL_CORRECTION_SYSTEM}, {role: "user", content: `原剧本：\n${segmentText}\n\n待纠正分镜：\n${beforeCorrection}`}],
          request.signal,
          true,
          0.1,
          4200,
        );
        const applied = applyFramePatches(beforeCorrection, correctionManifest, parseFramePatches(correctionCall.rawOutput), segmentText);
        finalPrompt = applied.prompt;
        if (applied.accepted.length) finalRawInput = correctionCall.rawInput;
        logNode("spatial_correction", correctionStarted, correctionCall.rawInput, correctionCall.rawOutput, {
          acceptedShots: applied.accepted,
          rejectedPatches: applied.rejected,
          changed: applied.accepted.length > 0,
          prompt: finalPrompt,
        });
      } catch (error) {
        finalPrompt = beforeCorrection;
        logNode("spatial_correction_fallback", correctionStarted, "", "", {
          reason: error instanceof Error ? error.message : "空间矛盾纠正节点失败",
          prompt: beforeCorrection,
        });
      }

      // 2b. 空间信息完善：基于纠正后的版本补齐逐镜必填空间字段。
      const completionStarted = Date.now();
      const beforeCompletion = finalPrompt;
      try {
        const completionShots = splitShots(beforeCompletion);
        const completionManifest: FrameManifest = {shots: completionShots.map((shot) => ({
          shot: shot.number, atomic: true, camera: "", visible: [], excluded: [], missing: [],
        }))};
        const completionCall = await callDeepSeek(
          apiKey,
          model,
          [{role: "system", content: SPATIAL_COMPLETION_SYSTEM}, {role: "user", content: `原剧本：\n${segmentText}\n\n已纠正分镜：\n${beforeCompletion}`}],
          request.signal,
          true,
          0.1,
          4200,
        );
        const applied = applyFramePatches(beforeCompletion, completionManifest, parseFramePatches(completionCall.rawOutput), segmentText);
        finalPrompt = applied.prompt;
        if (applied.accepted.length) finalRawInput = completionCall.rawInput;
        logNode("spatial_completion", completionStarted, completionCall.rawInput, completionCall.rawOutput, {
          acceptedShots: applied.accepted,
          rejectedPatches: applied.rejected,
          changed: applied.accepted.length > 0,
          prompt: finalPrompt,
        });
      } catch (error) {
        finalPrompt = beforeCompletion;
        logNode("spatial_completion_fallback", completionStarted, "", "", {
          reason: error instanceof Error ? error.message : "空间信息完善节点失败",
          prompt: beforeCompletion,
        });
      }

      // 3. 画面闭合：逐镜建立画框清单，再只补齐可证明的画内元素。
      const beforeClosure = finalPrompt;
      const closureStarted = Date.now();
      try {
        const closureShots = splitShots(beforeClosure);
        const manifestInput = `原剧本：\n${segmentText}\n\n待检查分镜：\n${beforeClosure}`;
        const manifestCall = await callDeepSeek(
          apiKey,
          model,
          [{role: "system", content: FRAME_MANIFEST_SYSTEM}, {role: "user", content: manifestInput}],
          request.signal,
          true,
          0.15,
          4200,
        );
        const manifest = parseFrameManifest(manifestCall.rawOutput, closureShots.length);
        logNode("frame_manifest", closureStarted, manifestCall.rawInput, manifestCall.rawOutput, manifest);

        const closureCall = await callDeepSeek(
          apiKey,
          model,
          [{role: "system", content: FRAME_CLOSURE_SYSTEM}, {role: "user", content: `${manifestInput}\n\n画框清单：\n${JSON.stringify(manifest, null, 2)}`}],
          request.signal,
          true,
          0.1,
          4200,
        );
        const applied = applyFramePatches(beforeClosure, manifest, parseFramePatches(closureCall.rawOutput), segmentText);
        finalPrompt = applied.prompt;
        if (applied.accepted.length) finalRawInput = closureCall.rawInput;
        logNode("frame_closure", closureStarted, closureCall.rawInput, closureCall.rawOutput, {
          acceptedShots: applied.accepted,
          rejectedPatches: applied.rejected,
          changed: applied.accepted.length > 0,
          prompt: finalPrompt,
        });
      } catch (error) {
        finalPrompt = beforeClosure;
        logNode("frame_closure_fallback", closureStarted, "", "", {
          reason: error instanceof Error ? error.message : "画面闭合节点失败",
          prompt: beforeClosure,
        });
      }
    }

    setFinalDebugInput(debugRun.id, finalRawInput);
    completeDebugRun(debugRun.id, finalPrompt);
    return new Response(finalPrompt, {headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      ...(localEditWarning ? {"X-Local-Edit-Warning": encodeURIComponent(localEditWarning)} : {}),
    }});
  } catch (error) {
    const message = error instanceof Error ? error.message : "DeepSeek 请求失败";
    failDebugRun(debugRun.id, message);
    return Response.json({error: message}, {status: 502});
  }
}
