import {readFileSync, writeFileSync} from "node:fs";

const source = readFileSync(new URL("../app/api/deepseek/route.ts", import.meta.url), "utf8");
const promptMatch = /const SPATIAL_CONTINUITY_SYSTEM = `([\s\S]*?)`;\nconst OUTPUT_GATE/.exec(source);
if (!promptMatch) throw new Error("无法读取空间连续性节点提示词");
const system = promptMatch[1];

const cases = [
  {
    id: "missing_multi_subject_relation",
    label: "多人同镜缺少相对位置（应补全）",
    expected: "changed",
    script: "沈淮青与姜蘅之隔着书案相对而立。",
    prompt: "【分镜1】\n中景，【沈淮青】神情紧绷地说道：\"你想清楚了吗？\"【姜蘅之】冷冷看着他。",
  },
  {
    id: "missing_foreground_background",
    label: "双人镜头未交代前后层次（应补全）",
    expected: "changed",
    script: "沈淮青面对姜蘅之说话，姜蘅之背对镜头。",
    prompt: "【分镜1】\n双人近景，【姜蘅之】背对镜头，【沈淮青】面向她说道：\"我没有骗你。\"",
  },
  {
    id: "single_subject_complete",
    label: "单人特写已完整（不应机械补位置）",
    expected: "unchanged",
    script: "谢明珠听到证据后脸色骤变。",
    prompt: "【分镜1】\n脸部特写，快速推镜，【谢明珠】瞳孔微缩，脸色骤然发白。",
  },
  {
    id: "control_continuous",
    label: "正常连续（不应修改）",
    expected: "unchanged",
    script: "沈淮青与姜蘅之在书房对峙。沈淮青站在左侧，姜蘅之站在右侧，二人始终相对。",
    prompt: "【分镜1】\n中景固定机位，画面左侧【沈淮青】面向右侧的【姜蘅之】，二人隔着书案对峙。\n\n【分镜2】\n近景，仍从沈淮青一侧拍摄，【姜蘅之】留在画面右侧，面向左侧的【沈淮青】冷声说道：“你想清楚了吗？”",
  },
  {
    id: "left_right_flip",
    label: "左右位置无交代翻转",
    expected: "changed",
    script: "沈淮青与姜蘅之在书房对峙，二人没有移动位置。",
    prompt: "【分镜1】\n中景固定机位，画面左侧【沈淮青】面向右侧的【姜蘅之】，二人隔着书案对峙。\n\n【分镜2】\n同一机位的近景，画面左侧【姜蘅之】仍面向右侧的【沈淮青】说道：“你想清楚了吗？”二人之间没有移动或换位。",
  },
  {
    id: "facing_flip",
    label: "朝向无交代翻转",
    expected: "changed",
    script: "沈淮青与姜蘅之在书房对峙，二人位置和摄影机机位均没有变化。",
    prompt: "【分镜1】\n中景固定机位，画面左侧【沈淮青】面向右侧，画面右侧【姜蘅之】面向左侧，二人相互注视。\n\n【分镜2】\n同一机位近景，二人位置不变；画面左侧【沈淮青】仍面向右侧，画面右侧【姜蘅之】却面向右侧看着【沈淮青】。",
  },
  {
    id: "prop_jump",
    label: "道具归属无交接跳变",
    expected: "changed",
    script: "姜蘅之手持一枚玉佩质问沈淮青，期间没有把玉佩交给任何人。",
    prompt: "【分镜1】\n手部特写，画面右侧【姜蘅之】右手捏着玉佩，伸向画面左侧的【沈淮青】。\n\n【分镜2】\n中景固定机位，二人没有接触或交接动作；画面左侧【沈淮青】右手捏着同一枚玉佩，画面右侧【姜蘅之】空手看着他。",
  },
  {
    id: "entrance_jump",
    label: "人物出入画无交代跳变",
    expected: "changed",
    script: "林菀儿始终站在房门内侧，没有离开，也没有人从她身前经过遮挡。",
    prompt: "【分镜1】\n全景固定机位，房门在画面右侧，【林菀儿】站在门内右侧，望向画面左侧的【沈淮青】。\n\n【分镜2】\n同一机位中景，画面右侧房门前空无一人；没有人离场、没有遮挡，也没有镜头转向。",
  },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const parseChanges = (raw) => {
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    const value = JSON.parse(raw.slice(start, end + 1));
    return Array.isArray(value.changes) ? value.changes : null;
  } catch { return null; }
};

const outputFile = new URL("../spatial-continuity-50-test.json", import.meta.url);
let results = [];
try { results = JSON.parse(readFileSync(outputFile, "utf8")).results || []; } catch {}
const runCount = Math.max(1, Number(process.env.SPATIAL_RUNS || 10));
const runOffset = Math.max(0, Number(process.env.SPATIAL_RUN_OFFSET || 0));
const selectedIds = new Set((process.env.SPATIAL_CASES || cases.map((item) => item.id).join(",")).split(",").filter(Boolean));
for (const testCase of cases.filter((item) => selectedIds.has(item.id))) {
  for (let index = 1; index <= runCount; index += 1) {
    const run = runOffset + index;
    const startedAt = Date.now();
    const response = await fetch("http://127.0.0.1:8789/chat/completions", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        model: "deepseek-v4-flash",
        messages: [
          {role: "system", content: system},
          {role: "user", content: `原剧本：\n${testCase.script}\n\n待检查分镜：\n${testCase.prompt}`},
        ],
        temperature: 0.1,
        thinking: {type: "disabled"},
        max_tokens: 4200,
        response_format: {type: "json_object"},
        stream: false,
      }),
    });
    const responseBody = await response.text();
    let body = responseBody;
    if (response.ok) {
      try { body = String(JSON.parse(responseBody).choices?.[0]?.message?.content || ""); } catch {}
    }
    const changes = response.ok ? parseChanges(body) : null;
    const changed = Array.isArray(changes) && changes.length > 0;
    const valid = Array.isArray(changes);
    const passed = valid && (testCase.expected === "changed" ? changed : !changed);
    results.push({
      caseId: testCase.id,
      label: testCase.label,
      run,
      expected: testCase.expected,
      status: response.status,
      valid,
      changed,
      passed,
      changes,
      raw: body,
      durationMs: Date.now() - startedAt,
    });
    console.log(`${testCase.id} ${run}/${runCount} ${passed ? "PASS" : "FAIL"} status=${response.status}${valid ? "" : ` raw=${body.slice(0, 180)}`}`);
    await sleep(120);
  }
}

const summary = cases.map((testCase) => {
  const runs = results.filter((item) => item.caseId === testCase.id);
  return {
    caseId: testCase.id,
    label: testCase.label,
    expected: testCase.expected,
    runs: runs.length,
    valid: runs.filter((item) => item.valid).length,
    changed: runs.filter((item) => item.changed).length,
    passed: runs.filter((item) => item.passed).length,
    averageDurationMs: Math.round(runs.reduce((total, item) => total + item.durationMs, 0) / runs.length),
  };
});
writeFileSync(outputFile, JSON.stringify({generatedAt: new Date().toISOString(), summary, results}, null, 2));
console.log(JSON.stringify(summary, null, 2));
