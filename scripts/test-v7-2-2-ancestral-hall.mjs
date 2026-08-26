import {readFileSync, writeFileSync} from "node:fs";

const script = `18-3 谢府祠堂 日 内
人物：谢老夫人、谢明珠、苏棠
谢老夫人：这支凤钗，为何会在你的妆匣里？
谢明珠（强作镇定）：孙女不知，定是有人栽赃。
苏棠：钗尾刻着领用日期，那日库房的钥匙只在大小姐手中。
△谢明珠脸色骤变。`;
const dialogue = ["这支凤钗，为何会在你的妆匣里？", "孙女不知，定是有人栽赃。", "钗尾刻着领用日期，那日库房的钥匙只在大小姐手中。"];
const archive = JSON.parse(readFileSync(new URL("../fewshot-prompt-versions.json", import.meta.url), "utf8"));
const versionId = process.env.TEST_VERSION_ID || "github-v7-2-2-1784543967494";
const version = archive.versions.find((item) => item.id === versionId);
if (!version) throw new Error(`未找到提示词版本：${versionId}`);
const outputName = process.env.TEST_OUTPUT_FILE || "v7-2-2-祠堂对质-10次测试.json";
const outputFile = new URL(`../${outputName}`, import.meta.url);
let results = [];
try { results = JSON.parse(readFileSync(outputFile, "utf8")).results || []; } catch {}
const outputGate = `你可以在最终结果之前自由分析和想象画面，但最终视频提示词必须单独放在以下标记内：\n<VIDEO_PROMPT>\n【分镜1】\n……\n</VIDEO_PROMPT>\n标记内部只能出现从【分镜1】开始、编号连续的最终视频提示词，不得放入分析、解释、创作过程或总结。`;
const system = `${version.prompt.replace("{{插入剧本片段}}", script)}\n\n${outputGate}`;
const user = `当前剧本：\n${script}\n\n任务：\n从头想象并撰写这个片段的视频提示词。`;
const parse = (raw) => {
  const scope = /<VIDEO_PROMPT>([\s\S]*?)<\/VIDEO_PROMPT>/i.exec(raw)?.[1] || raw;
  const index = scope.search(/【\s*分镜\s*1\s*】/);
  if (index < 0) throw new Error("未找到分镜1");
  const prompt = scope.slice(index).trim();
  const imagination = raw.slice(0, raw.indexOf(prompt)).replace(/最终提示词[：:]?\s*$/u, "").trim();
  return {prompt, imagination};
};
const count = (text, pattern) => (text.match(pattern) || []).length;
const offset = Number(process.env.V722_OFFSET || 0);
const runCount = Number(process.env.V722_RUNS || 10);
for (let index = 1; index <= runCount; index += 1) {
  const run = offset + index;
  const startedAt = Date.now();
  const response = await fetch("http://127.0.0.1:8789/chat/completions", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({model: "deepseek-v4-flash", messages: [{role: "system", content: system}, {role: "user", content: user}], temperature: 0.8, thinking: {type: "disabled"}, max_tokens: 7000, stream: false})});
  const responseText = await response.text();
  if (!response.ok) throw new Error(`DeepSeek ${response.status}: ${responseText.slice(0, 240)}`);
  const raw = String(JSON.parse(responseText).choices?.[0]?.message?.content || "").trim();
  const {prompt, imagination} = parse(raw);
  const metrics = {
    shotCount: count(prompt, /【\s*分镜\s*\d+\s*】/g),
    dialogueKept: dialogue.filter((line) => prompt.includes(line)).length,
    finalReactionKept: /脸色骤变|脸色.*变|面色.*变/.test(prompt),
    evidenceHits: count(prompt, /凤钗|钗尾|领用日期|库房|钥匙|妆匣/g),
    spatialHits: count(prompt, /左侧|右侧|前景|背景|画面|祠堂|牌位|香案|蒲团|站在|跪/g),
    reactionHits: count(prompt, /眼神|目光|表情|脸色|一怔|僵住|骤变|强作镇定|呼吸|嘴角/g),
    imaginationLength: imagination.length,
    promptLength: prompt.length,
  };
  results = results.filter((item) => item.run !== run);
  results.push({run, durationMs: Date.now() - startedAt, ...metrics, imagination, prompt, raw});
  writeFileSync(outputFile, JSON.stringify({title: "V7-2-2 · 祠堂对质 · 10次测试", script, version: version.label, results: results.sort((a, b) => a.run - b.run)}, null, 2));
  console.log(`run ${run}: ${metrics.shotCount} shots, dialogue ${metrics.dialogueKept}/3, reaction=${metrics.finalReactionKept}`);
}
const complete = results.filter((item) => item.run >= 1 && item.run <= 10);
const average = (key) => complete.length ? Math.round(complete.reduce((sum, item) => sum + item[key], 0) / complete.length * 10) / 10 : 0;
console.log(JSON.stringify({runs: complete.length, averageShots: average("shotCount"), fullDialogue: complete.filter((item) => item.dialogueKept === 3).length, finalReaction: complete.filter((item) => item.finalReactionKept).length, averageSeconds: average("durationMs") / 1000, averageImaginationLength: average("imaginationLength"), averagePromptLength: average("promptLength"), averageSpatialHits: average("spatialHits"), averageReactionHits: average("reactionHits")}, null, 2));
