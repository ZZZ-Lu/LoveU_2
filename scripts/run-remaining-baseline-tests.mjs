import fs from "node:fs";
import path from "node:path";

const snapshotPath = path.join(process.env.TEMP, "loveu-indexeddb-current.log");
const outputPath = path.resolve("test-results/v7-2-imitation-v14-2-baselines-2026-08-19.json");
const buffer = fs.readFileSync(snapshotPath);
const blockSize = 32768;
const records = [];
let fragments = [];

for (let base = 0; base < buffer.length; base += blockSize) {
  let cursor = base;
  const end = Math.min(base + blockSize, buffer.length);
  while (cursor + 7 <= end) {
    const length = buffer.readUInt16LE(cursor + 4);
    const type = buffer[cursor + 6];
    if (length === 0 || cursor + 7 + length > end) break;
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
    if (decoded.includes("V7-2_仿V14-2")) serialized = decoded;
  }
}

const versionIndex = serialized.indexOf("V7-2_仿V14-2");
const templateStart = serialized.indexOf("你要根据剧本", versionIndex);
const marker = "{{插入剧本片段}}";
const templateEnd = serialized.indexOf(marker, templateStart) + marker.length;
if (versionIndex < 0 || templateStart < 0 || templateEnd < marker.length) {
  throw new Error("无法从浏览器数据库快照提取 V7-2仿V14-2");
}
const template = serialized.slice(templateStart, templateEnd);

const cases = [
  {id: "modern-romance", title: "电梯重逢", script: `3-2 写字楼电梯 早 内
人物：程野、许念
△电梯门将要合拢，程野伸手挡住。许念抬头，两人同时愣住。
许念：你不是在国外吗？
程野：昨晚刚回来。
△电梯超载提示响起。
程野（看着她）：看来有人不欢迎我。`},
  {id: "revenge", title: "宴会揭面", script: `10-5 酒店宴会厅 夜 内
人物：林澜、周曼、宾客
周曼：保安，把这个冒充林家千金的女人赶出去！
△林澜摘下手套，露出祖母绿家徽戒指。
林澜：三年不见，周小姐连林家的东西都认不得了？
△四周宾客哗然。`},
  {id: "suspense", title: "冰箱里的证据", script: `5-8 出租屋厨房 深夜 内
人物：陈默、秦雯
△秦雯戴着手套拉开冰箱，冷气涌出。
秦雯：死者失踪七天，牛奶却是昨天买的。
陈默看向门锁：凶手回来过。
△走廊外突然传来钥匙插入锁孔的声音。`},
  {id: "xianxia", title: "断契", script: `26-1 诛仙台 黄昏 外
人物：玄夜、云璃
云璃：这一剑之后，你我两清。
△云璃割破掌心，灵契红线在两人之间亮起。
玄夜（上前一步）：你若真想两清，为何还在发抖？
△云璃握剑的手骤然收紧。`},
  {id: "republic", title: "舞会交接", script: `14-4 百乐门舞池 夜 内
人物：沈砚、白露、特务
△沈砚与白露旋转擦肩，一枚胶卷落入白露掌心。
白露（笑着）：先生踩到我的裙子了。
沈砚：抱歉。
△二人分开，白露看见出口处的特务正在盯着她。`},
  {id: "family", title: "病房缴费单", script: `9-3 医院走廊 日 内
人物：母亲、陈嘉、护士
护士：今天下班前还要补交两万元。
△护士离开。母亲把缴费单折起藏到身后。
陈嘉：妈，你是不是把房子卖了？
母亲（笑）：别瞎想，妈有钱。`},
  {id: "workplace", title: "方案署名", script: `6-7 会议室 日 内
人物：叶晴、王总、李主管
李主管：这套方案是我带团队熬了三个月做出来的。
叶晴：是吗？
△叶晴按下遥控器，屏幕出现文件修改记录，作者一栏全是叶晴。
王总转头看向李主管。`},
];

const prior = [
  {id: "costume-family", title: "祠堂对质", shots: [5, 6, 5, 5, 7, 5, 5, 6, 5, 7]},
  {id: "costume-strategy", title: "密折试探", shots: [5, 5, 4, 4, 6, 4, 4, 4, 4, 4]},
  {id: "action", title: "雨夜拦车", shots: [7, 11, 10, 8, 6, 6, 9, 6, 8, 6]},
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
  fs.mkdirSync(path.dirname(outputPath), {recursive: true});
  fs.writeFileSync(outputPath, JSON.stringify({version: "V7-2仿V14-2", prior, results}, null, 2));
  process.stdout.write(`CASE_DONE ${item.title} ${runs.map((runItem) => runItem.shotCount).join(",")}\n`);
}

process.stdout.write(`RESULT_FILE ${outputPath}\n`);
