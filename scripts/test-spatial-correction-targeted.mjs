import {readFileSync, writeFileSync} from "node:fs";

const source = readFileSync(new URL("../app/api/deepseek/route.ts", import.meta.url), "utf8");
const correction = /const SPATIAL_CORRECTION_SYSTEM = `([\s\S]*?)`;\n\nconst SPATIAL_COMPLETION_SYSTEM/.exec(source)?.[1];
if (!correction) throw new Error("未找到空间矛盾纠正提示词");
const cases = [
  {
    id: "left_right_flip",
    script: "沈淮青一直站在左侧，姜蘅之一直站在右侧，二人没有移动。",
    prompt: "【分镜1】\n画面左侧【沈淮青】与画面右侧【姜蘅之】隔桌相对。\n\n【分镜2】\n同一机位，二人没有移动，画面左侧【姜蘅之】看向画面右侧【沈淮青】。",
    success: (text) => /画面右侧【姜蘅之】/.test(text) && /画面左侧【沈淮青】/.test(text),
  },
  {
    id: "facing_flip",
    script: "二人相对而立，位置和机位均没有变化。",
    prompt: "【分镜1】\n左侧【沈淮青】面向右侧，右侧【姜蘅之】面向左侧，二人相互注视。\n\n【分镜2】\n同一机位，左侧【沈淮青】面向右侧，右侧【姜蘅之】却面向右侧看着【沈淮青】。",
    success: (text) => /姜蘅之[^。；]*面向左侧/.test(text) && !/姜蘅之[^。；]*面向右侧看着/.test(text),
  },
  {
    id: "prop_jump",
    script: "姜蘅之始终右手拿着玉佩，没有交给任何人。",
    prompt: "【分镜1】\n右侧【姜蘅之】右手拿着玉佩，左侧【沈淮青】看着她。\n\n【分镜2】\n二人没有接触或交接，左侧【沈淮青】右手拿着同一枚玉佩，右侧【姜蘅之】空手看着他。",
    success: (text) => /姜蘅之[^。；]*右手[^。；]*玉佩/.test(text) && !/沈淮青[^。；]*右手[^。；]*玉佩/.test(text),
  },
  {
    id: "exit_jump",
    script: "林菀儿始终站在门内右侧，没有离开，也没有被遮挡。",
    prompt: "【分镜1】\n【林菀儿】站在门内右侧。\n\n【分镜2】\n同一固定机位，没人离场也没有遮挡，门内右侧空无一人。",
    success: (text) => /林菀儿[^。；]*门内右侧/.test(text) && !/门内右侧空无一人/.test(text),
  },
];
const parse = (raw) => { try { return JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)); } catch { return null; } };
const results = [];
for (const item of cases) {
  for (let run = 1; run <= 10; run += 1) {
    const startedAt = Date.now();
    const response = await fetch("http://127.0.0.1:8789/chat/completions", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({model: "deepseek-v4-flash", messages: [{role: "system", content: correction}, {role: "user", content: `原剧本：\n${item.script}\n\n待纠正分镜：\n${item.prompt}`}], temperature: 0.1, thinking: {type: "disabled"}, max_tokens: 2200, response_format: {type: "json_object"}, stream: false})});
    const body = await response.text();
    let raw = body;
    if (response.ok) { try { raw = String(JSON.parse(body).choices?.[0]?.message?.content || ""); } catch {} }
    const parsed = parse(raw); const replacements = Array.isArray(parsed?.changes) ? parsed.changes.map((change) => String(change.replacement || "")).join("\n") : "";
    const passed = response.ok && item.success(replacements);
    results.push({caseId: item.id, run, status: response.status, passed, raw, durationMs: Date.now() - startedAt});
    console.log(`${item.id} ${run}/10 ${passed ? "PASS" : "FAIL"}`);
  }
}
const summary = cases.map((item) => { const rows = results.filter((row) => row.caseId === item.id); return {caseId: item.id, passed: rows.filter((row) => row.passed).length, runs: rows.length}; });
writeFileSync(new URL("../spatial-correction-targeted-40.json", import.meta.url), JSON.stringify({generatedAt: new Date().toISOString(), summary, results}, null, 2));
console.log(JSON.stringify(summary, null, 2));
