import fs from "node:fs/promises";

const oldSet = JSON.parse(await fs.readFile("v7-2-祠堂对质-10次测试.json", "utf8")).results;
const newSet = JSON.parse(await fs.readFile("test-results/v7-3-2-deepseek-v4-pro-祠堂对质-10次-2026-08-24.json", "utf8")).results;
const cameraTerms = ["全景", "中景", "近景", "特写", "过肩", "俯拍", "仰拍", "推镜", "横移", "环绕", "固定镜头", "手持"];
const dialogue = ["这支凤钗，为何会在你的妆匣里", "孙女不知，定是有人栽赃", "钗尾刻着领用日期", "那日库房的钥匙只在大小姐手中"];

const summarize = (items) => {
  const rows = items.map((item, index) => {
    const prompt = String(item.prompt || "");
    return {
      run: index + 1,
      shots: (prompt.match(/【分镜\d+】/g) || []).length,
      chars: prompt.length,
      durationMs: Number(item.durationMs || 0),
      spatial: (prompt.match(/画面(?:左侧|右侧|中央|中间|前景|背景)|前景|背景/g) || []).length,
      cameraKinds: cameraTerms.filter((term) => prompt.includes(term)).length,
      dialogueKept: dialogue.filter((line) => prompt.includes(line)).length,
      reaction: /脸色骤变|血色.*褪|瞳孔.*缩|指尖.*抖|手指.*颤|僵住|失去血色/.test(prompt),
      atomicRisk: /切回|快速剪辑|连续(?:两|三|四)个短镜头|镜头切到/.test(prompt),
      invented: /跪|摔|哭出|转身离开|走出祠堂|晕倒/.test(prompt),
    };
  });
  const avg = (key) => rows.reduce((sum, row) => sum + Number(row[key]), 0) / rows.length;
  return {
    rows,
    averageShots: avg("shots"),
    shotRange: `${Math.min(...rows.map((row) => row.shots))}-${Math.max(...rows.map((row) => row.shots))}`,
    averageChars: avg("chars"),
    averageSeconds: avg("durationMs") / 1000,
    averageSpatial: avg("spatial"),
    averageCameraKinds: avg("cameraKinds"),
    fullDialogueRuns: rows.filter((row) => row.dialogueKept === dialogue.length).length,
    reactionRuns: rows.filter((row) => row.reaction).length,
    atomicRiskRuns: rows.filter((row) => row.atomicRisk).length,
    inventedRiskRuns: rows.filter((row) => row.invented).length,
  };
};

console.log(JSON.stringify({old: summarize(oldSet), newer: summarize(newSet)}, null, 2));
