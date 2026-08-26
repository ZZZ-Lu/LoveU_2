import fs from "node:fs";
import path from "node:path";

const buffer = fs.readFileSync(path.join(process.env.TEMP, "loveu-indexeddb-current.log"));
const records = [];
let fragments = [];
for (let base = 0; base < buffer.length; base += 32768) {
  let cursor = base;
  const end = Math.min(base + 32768, buffer.length);
  while (cursor + 7 <= end) {
    const length = buffer.readUInt16LE(cursor + 4);
    const type = buffer[cursor + 6];
    if (!length || cursor + 7 + length > end) break;
    const data = buffer.subarray(cursor + 7, cursor + 7 + length);
    if (type === 1) records.push(Buffer.from(data));
    else if (type === 2) fragments = [data];
    else if (type === 3) fragments.push(data);
    else if (type === 4) {
      fragments.push(data);
      records.push(Buffer.concat(fragments));
      fragments = [];
    }
    cursor += 7 + length;
  }
}

let serialized = "";
for (const record of records) {
  for (let offset = 0; offset < 2; offset += 1) {
    const decoded = record.subarray(offset).toString("utf16le");
    if (decoded.includes("V7-2_仿V14") && !decoded.includes("V7-2_仿V14-2")) serialized = decoded;
  }
}
const versionIndex = serialized.indexOf("V7-2_仿V14");
const start = serialized.indexOf("你要根据剧本", versionIndex);
const marker = "{{插入剧本片段}}";
const end = serialized.indexOf(marker, start) + marker.length;
if (versionIndex < 0 || start < 0 || end < marker.length) throw new Error("无法提取 V7-2仿V14");
const template = serialized.slice(start, end);

const cases = [
  {id: "action", title: "雨夜拦车", script: `12-4 城外驿道 雨夜 外
人物：顾昭、阿梨、车夫
△马车疾驰，阿梨从路旁冲出，车夫猛拉缰绳。
车夫：不要命了？！
阿梨（喘息）：顾大人，我家小姐被人带走了！
△车帘掀开，顾昭看清她手腕上的血迹。
顾昭：上车。谁带走的，路上说。
阿梨（愣住，随即点头）：是！`},
  {id: "republic", title: "舞会交接", script: `14-4 百乐门舞池 夜 内
人物：沈砚、白露、特务
△沈砚与白露旋转擦肩，一枚胶卷落入白露掌心。
白露（笑着）：先生踩到我的裙子了。
沈砚：抱歉。
△二人分开，白露看见出口处的特务正在盯着她。`},
];

function measure(data) {
  const prompt = data.prompt || "";
  const blocks = prompt.split(/(?=【分镜\d+】)/).filter((item) => /【分镜\d+】/.test(item));
  let atomicityWarnings = 0;
  for (const block of blocks) {
    if (/切到|反打|另一个角度|画面切换|切至/.test(block)) atomicityWarnings += 1;
    else if (/俯拍/.test(block) && /仰拍/.test(block) && !/环绕|下降|上升|摇|移/.test(block)) atomicityWarnings += 1;
    else if (/特写/.test(block) && /全景/.test(block) && !/推|拉|摇|移|跟|环绕/.test(block)) atomicityWarnings += 1;
  }
  return {
    shotCount: data.shotCount,
    promptLength: prompt.length,
    imaginationLength: (data.imagination || "").length,
    spatialMentions: (prompt.match(/前景|中景|背景|画面左|画面右|中央|朝向|看向/g) || []).length,
    cameraVocabulary: new Set(prompt.match(/全景|远景|中景|近景|特写|俯拍|仰拍|推镜|拉镜|横移|环绕|跟拍|摇镜|固定镜头|荷兰角/g) || []).size,
    atomicityWarnings,
  };
}

async function run(script) {
  const response = await fetch("http://127.0.0.1:3000/api/deepseek/fewshot-test", {
    method: "POST",
    headers: {"content-type": "application/json"},
    body: JSON.stringify({template, script}),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(data));
  return measure(data);
}

const results = [];
for (const item of cases) {
  const runs = [];
  for (let batch = 0; batch < 5; batch += 1) {
    runs.push(...await Promise.all([run(item.script), run(item.script)]));
    process.stderr.write(`${item.title}: ${runs.length}/10\n`);
  }
  results.push({...item, runs});
  process.stdout.write(`CASE_DONE ${item.title} ${runs.map((result) => result.shotCount).join(",")}\n`);
}

const output = path.resolve("test-results/v7-2-imitation-v14-vs-v14-2-action-2026-08-19.json");
fs.mkdirSync(path.dirname(output), {recursive: true});
fs.writeFileSync(output, JSON.stringify({version: "V7-2仿V14", results}, null, 2));
process.stdout.write(`RESULT_FILE ${output}\n`);
