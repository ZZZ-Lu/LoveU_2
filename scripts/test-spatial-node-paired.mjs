import {readFileSync, writeFileSync} from "node:fs";

const script = `△姜蘅之看着他，忽然笑了。
姜蘅之：沈淮青，你脑子没毛病吧？你将她绑来有何用？你们沈家，从里到外，都烂透了！
沈淮青（脸色涨红）：你……你这是何意？你是想让我也给你负荆请罪吗？可以啊，只要你救我娘，你让我做什么都可以……
姜蘅之：你来求我，我听见了。我不救，你也听见了。走吧。`;
const archive = JSON.parse(readFileSync(new URL("../fewshot-prompt-versions.json", import.meta.url), "utf8"));
const version = archive.versions.find((item) => item.id === "github-v7-2-test");
if (!version) throw new Error("未找到 V7-2 测试版提示词");
const route = readFileSync(new URL("../app/api/deepseek/route.ts", import.meta.url), "utf8");
const correction = /const SPATIAL_CORRECTION_SYSTEM = `([\s\S]*?)`;\n\nconst SPATIAL_COMPLETION_SYSTEM/.exec(route)?.[1];
const completion = /const SPATIAL_COMPLETION_SYSTEM = `([\s\S]*?)`;\nconst OUTPUT_GATE/.exec(route)?.[1];
if (!correction || !completion) throw new Error("未找到空间纠错或完善节点提示词");
const gate = /const OUTPUT_GATE = `([\s\S]*?)`;/.exec(route)?.[1];
if (!gate) throw new Error("未找到输出格式约束");
const system = `${version.prompt.replace("{{插入剧本片段}}", script)}\n\n${gate}`;
const user = `当前选中片段：\n${script}\n\n任务：\n从头想象并撰写这个片段的视频提示词。`;
const proxy = "http://127.0.0.1:8789/chat/completions";
const outputFile = new URL("../spatial-node-paired-v7-2-10.json", import.meta.url);
let results = [];
try { results = JSON.parse(readFileSync(outputFile, "utf8")).results || []; } catch {}

const call = async (messages, json = false, temperature = 0.8, maxTokens = 7000) => {
  const response = await fetch(proxy, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({model: "deepseek-v4-flash", messages, temperature, thinking: {type: "disabled"}, max_tokens: maxTokens, ...(json ? {response_format: {type: "json_object"}} : {}), stream: false})});
  const text = await response.text();
  if (!response.ok) throw new Error(`DeepSeek ${response.status}: ${text.slice(0, 240)}`);
  const content = String(JSON.parse(text).choices?.[0]?.message?.content || "").trim();
  if (!content) throw new Error("模型未返回内容");
  return content;
};
const parseDirector = (raw) => {
  const scope = /<VIDEO_PROMPT>([\s\S]*?)<\/VIDEO_PROMPT>/i.exec(raw)?.[1] || raw;
  const start = scope.search(/【\s*分镜\s*1\s*】/);
  if (start < 0) throw new Error("没有有效分镜1");
  return scope.slice(start).trim();
};
const split = (value) => [...value.matchAll(/【\s*分镜\s*(\d+)\s*】/g)].map((match, index, matches) => ({number: Number(match[1]), text: value.slice(match.index, index + 1 < matches.length ? matches[index + 1].index : value.length).trim()}));
const tags = (value) => [...value.matchAll(/【([^】]+)】/g)].map((item) => item[1]).filter((item) => !/^分镜\s*\d+$/.test(item));
const quotes = (value) => [...value.matchAll(/[“"]([^”"]+)[”"]/g)].map((item) => item[1]);
const apply = (original, raw) => {
  let changes;
  try {
    const start = raw.indexOf("{");
    let json = raw.slice(start, raw.lastIndexOf("}") + 1);
    try { changes = JSON.parse(json).changes; }
    catch {
      json = raw.slice(start).trim().replace(/},\s*,\s*{/g, "},{").replace(/,\s*([}\]])/g, "$1");
      if (!json.endsWith("}")) json += "}";
      changes = JSON.parse(json).changes;
    }
    changes = Array.isArray(changes) ? changes : [];
  } catch { return {final: original, accepted: [], rejected: ["JSON解析失败"]}; }
  const shots = split(original); const accepted = []; const rejected = []; const replacements = new Map();
  for (const item of changes) {
    const number = Number(item.shot); const replacement = String(item.replacement || "").trim(); const source = shots[number - 1]?.text;
    const valid = source && replacement.startsWith(`【分镜${number}】`) && (replacement.match(/【\s*分镜\s*\d+\s*】/g) || []).length === 1 && quotes(source).every((quote) => replacement.includes(quote)) && tags(source).every((tag) => replacement.includes(`【${tag}】`));
    if (valid) { accepted.push(number); replacements.set(number, replacement); } else rejected.push(number || "invalid");
  }
  return {final: shots.map((shot) => replacements.get(shot.number) || shot.text).join("\n\n"), accepted, rejected};
};

const offset = Number(process.env.PAIRED_OFFSET || 0);
const count = Number(process.env.PAIRED_RUNS || 10);
for (let index = 1; index <= count; index += 1) {
  const run = offset + index;
  const startedAt = Date.now();
  const baseRaw = await call([{role: "system", content: system}, {role: "user", content: user}]);
  const base = parseDirector(baseRaw);
  const correctionRaw = await call([{role: "system", content: correction}, {role: "user", content: `原剧本：\n${script}\n\n待纠正分镜：\n${base}`}], true, 0.1, 4200);
  const corrected = apply(base, correctionRaw);
  const completionRaw = await call([{role: "system", content: completion}, {role: "user", content: `原剧本：\n${script}\n\n已纠正分镜：\n${corrected.final}`}], true, 0.1, 4200);
  const completed = apply(corrected.final, completionRaw);
  results = results.filter((item) => item.run !== run);
  results.push({run, baseShotCount: split(base).length, finalShotCount: split(completed.final).length, changed: corrected.accepted.length + completed.accepted.length > 0, correctionAcceptedShots: corrected.accepted, correctionRejectedPatches: corrected.rejected, completionAcceptedShots: completed.accepted, completionRejectedPatches: completed.rejected, base, corrected: corrected.final, withSpatial: completed.final, correctionRaw, completionRaw, durationMs: Date.now() - startedAt});
  writeFileSync(outputFile, JSON.stringify({script, version: "V7-2 测试版", results: results.sort((a, b) => a.run - b.run)}, null, 2));
  console.log(`run ${run}: correction ${corrected.accepted.join(",") || "none"}; completion ${completed.accepted.join(",") || "none"}`);
}
const complete = results.filter((item) => item.run >= 1 && item.run <= 10);
console.log(JSON.stringify({runs: complete.length, changed: complete.filter((item) => item.changed).length, averageDurationMs: complete.length ? Math.round(complete.reduce((sum, item) => sum + item.durationMs, 0) / complete.length) : 0}, null, 2));
