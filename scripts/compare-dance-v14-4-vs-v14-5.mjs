import { readFile, writeFile } from "node:fs/promises";

const source = JSON.parse(await readFile("test-results/dance-handoff-v14-4-vs-v14-5-2026-08-22.json", "utf8"));
const shotCount = (text = "") => (text.match(/【分镜\s*\d+】/g) || []).length;
const count = (text, regex) => (text.match(regex) || []).length;
const stats = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    average: +(values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2),
    median: sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : +((sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2).toFixed(2),
    min: sorted[0], max: sorted.at(-1), values,
  };
};

for (const result of source.results) {
  result.metrics = {
    shotCount: result.shotCount || shotCount(result.prompt),
    imaginationLength: result.imagination.length,
    promptLength: result.prompt.length,
    spatialMentions: count(result.prompt, /前景|中景|背景|画面左|画面右|中央|朝向|看向/g),
    cameraVocabulary: count(result.prompt, /全景|远景|中景|近景|特写|推镜|拉镜|横移|环绕|跟随|俯拍|仰拍|摇镜|固定镜头/g),
    dialogueComplete: result.prompt.includes("先生踩到我的裙子了") && result.prompt.includes("抱歉"),
    handoffComplete: result.prompt.includes("胶卷") && result.prompt.includes("掌心"),
    agentBeatComplete: result.prompt.includes("特务") && /盯|注视|看着|目光/.test(result.prompt),
  };
}

const versions = {};
for (const versionName of [...new Set(source.results.map((item) => item.versionName))]) {
  const rows = source.results.filter((item) => item.versionName === versionName);
  versions[versionName] = {
    runs: rows.length,
    shotCount: stats(rows.map((row) => row.metrics.shotCount)),
    durationMs: stats(rows.map((row) => row.durationMs)),
    imaginationLength: stats(rows.map((row) => row.metrics.imaginationLength)),
    promptLength: stats(rows.map((row) => row.metrics.promptLength)),
    spatialMentions: stats(rows.map((row) => row.metrics.spatialMentions)),
    cameraVocabulary: stats(rows.map((row) => row.metrics.cameraVocabulary)),
    dialoguePasses: rows.filter((row) => row.metrics.dialogueComplete).length,
    handoffPasses: rows.filter((row) => row.metrics.handoffComplete).length,
    agentBeatPasses: rows.filter((row) => row.metrics.agentBeatComplete).length,
  };
}
source.summary = versions;
await writeFile("test-results/dance-handoff-v14-4-vs-v14-5-2026-08-22.json", JSON.stringify(source, null, 2), "utf8");
console.log(JSON.stringify(versions, null, 2));
