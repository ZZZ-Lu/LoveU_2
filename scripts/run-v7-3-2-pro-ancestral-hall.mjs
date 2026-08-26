import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const archive = JSON.parse(await fs.readFile(path.join(root, "fewshot-prompt-versions.json"), "utf8"));
const previous = JSON.parse(await fs.readFile(path.join(root, "v7-2-祠堂对质-10次测试.json"), "utf8"));
const version = archive.versions.find((item) => item.id === "v-1784902396435");
if (!version) throw new Error("找不到V7-3-2提示词版本");

const runOne = async (index) => {
  const response = await fetch("http://localhost:3000/api/deepseek/fewshot-test", {
    method: "POST",
    headers: {"Content-Type": "application/json", Cookie: "loveu_deepseek_model=deepseek-v4-pro"},
    body: JSON.stringify({template: version.prompt, script: previous.script}),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`第${index}次失败：${data.error || response.status}`);
  return {index, ...data};
};

const results = [];
for (let start = 1; start <= 10; start += 2) {
  const batch = await Promise.all([start, start + 1].filter((value) => value <= 10).map(runOne));
  results.push(...batch);
  console.log(`完成 ${results.length}/10`);
}

const record = {
  title: "V7-3-2 · DeepSeek V4 Pro · 祠堂对质 · 10次测试",
  version: "V7-3-2",
  versionId: version.id,
  model: "deepseek-v4-pro",
  script: previous.script,
  createdAt: new Date().toISOString(),
  results,
};
const output = path.join(root, "test-results", "v7-3-2-deepseek-v4-pro-祠堂对质-10次-2026-08-24.json");
await fs.writeFile(output, `${JSON.stringify(record, null, 2)}\n`, "utf8");
console.log(output);
