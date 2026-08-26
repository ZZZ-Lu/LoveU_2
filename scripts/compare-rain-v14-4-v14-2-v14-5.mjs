import fs from "node:fs";
import path from "node:path";

const buffer = fs.readFileSync(path.join(process.env.TEMP, "loveu-indexeddb-current.log"));
const records = [];
let fragments = [];
for (let base = 0; base < buffer.length; base += 32768) {
  let cursor = base;
  const blockEnd = Math.min(base + 32768, buffer.length);
  while (cursor + 7 <= blockEnd) {
    const length = buffer.readUInt16LE(cursor + 4);
    const type = buffer[cursor + 6];
    if (!length || cursor + 7 + length > blockEnd) break;
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

function extractTemplate(label) {
  let serialized = "";
  for (const record of records) {
    for (let offset = 0; offset < 2; offset += 1) {
      const decoded = record.subarray(offset).toString("utf16le");
      if (decoded.includes(label)) serialized = decoded;
    }
  }
  const versionIndex = serialized.indexOf(label);
  const start = serialized.indexOf("你要根据剧本", versionIndex);
  const marker = "{{插入剧本片段}}";
  const end = serialized.indexOf(marker, start) + marker.length;
  if (versionIndex < 0 || start < 0 || end < marker.length) throw new Error(`无法提取 ${label}`);
  return serialized.slice(start, end);
}

const catalogResponse = await fetch("http://127.0.0.1:3000/api/deepseek/fewshot-test");
const catalog = await catalogResponse.json();
const v145 = catalog.versions.find((item) => item.name.startsWith("V14-5"));
if (!v145) throw new Error("找不到 V14-5");

const versions = [
  {name: "V7-2仿V14-4", template: extractTemplate("V7-2仿V14-4")},
  {name: "V7-2仿V14-2", template: extractTemplate("V7-2_仿V14-2")},
  {name: "V14-5", template: v145.template},
];

const script = `12-4 城外驿道 雨夜 外
人物：顾昭、阿梨、车夫
△马车疾驰，阿梨从路旁冲出，车夫猛拉缰绳。
车夫：不要命了？！
阿梨（喘息）：顾大人，我家小姐被人带走了！
△车帘掀开，顾昭看清她手腕上的血迹。
顾昭：上车。谁带走的，路上说。
阿梨（愣住，随即点头）：是！`;

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
    dialogueComplete: ["不要命了", "顾大人，我家小姐被人带走了", "上车", "谁带走的，路上说", "是！"].every((text) => prompt.includes(text)),
    atomicityWarnings,
  };
}

async function run(version) {
  const response = await fetch("http://127.0.0.1:3000/api/deepseek/fewshot-test", {
    method: "POST",
    headers: {"content-type": "application/json"},
    body: JSON.stringify({template: version.template, script}),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`${version.name}: ${JSON.stringify(data)}`);
  return measure(data);
}

const results = Object.fromEntries(versions.map((version) => [version.name, []]));
for (let round = 1; round <= 10; round += 1) {
  const batch = await Promise.all(versions.map(run));
  versions.forEach((version, index) => results[version.name].push(batch[index]));
  process.stderr.write(`完成 ${round}/10 轮（共${round * 3}/30次）\n`);
}

const output = path.resolve("test-results/rain-v14-4-v14-2-v14-5-2026-08-19.json");
fs.writeFileSync(output, JSON.stringify({case: "雨夜拦车", results}, null, 2));
console.log(JSON.stringify({output, results}));
