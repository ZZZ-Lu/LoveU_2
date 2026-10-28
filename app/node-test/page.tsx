/* eslint-disable react-hooks/set-state-in-effect */
"use client";
import Link from "next/link";

import {useEffect, useMemo, useState} from "react";
import DeepSeekModelToggle from "../components/deepseek-model-toggle";

type Preset = {id: string; name: string; note: string; prompt: string};
type Stage = {id: string; name: string; input: string; output: string; result: string; durationMs: number};
type RunResult = {nodeId: string; finalResult: string; stages: Stage[]; durationMs: number};
type Benchmark = {id: string; genre: string; title: string; script: string};
type PromptVersion = {id: string; template: string};
type FusionDraft = {structure?: string; performance?: string; updatedAt?: string};

const FUSION_DRAFTS_KEY = "loveu-node-test-fusion-drafts-v1";

const readFusionDrafts = (): Record<string, FusionDraft> => {
  try {return JSON.parse(localStorage.getItem(FUSION_DRAFTS_KEY) || "{}");} catch {return {};}
};

const writeFusionDraft = (benchmarkId: string, patch: FusionDraft) => {
  const drafts = readFusionDrafts();
  drafts[benchmarkId] = {...drafts[benchmarkId], ...patch, updatedAt: new Date().toISOString()};
  localStorage.setItem(FUSION_DRAFTS_KEY, JSON.stringify(drafts));
};

const benchmarks: Benchmark[] = [
  {id: "costume-family", genre: "古装宅斗", title: "祠堂对质", script: `18-3 谢府祠堂 日 内\n人物：谢老夫人、谢明珠、苏棠\n谢老夫人：这支凤钗，为何会在你的妆匣里？\n谢明珠（强作镇定）：孙女不知，定是有人栽赃。\n苏棠：钗尾刻着领用日期，那日库房的钥匙只在大小姐手中。\n△谢明珠脸色骤变。`},
  {id: "costume-strategy", genre: "古装权谋", title: "密折试探", script: `7-6 王府书房 夜 内\n人物：靖王、裴策\n裴策：东宫的人已经截下密折。\n靖王：截下，未必看过。\n裴策：殿下为何如此肯定？\n靖王（落下一枚黑子）：因为那封折子，本就是写给他看的。`},
  {id: "costume-medicine-plea", genre: "古装情感", title: "行辕求药", script: `28-1 山河镇临时行辕 门外\n人物：沈淮青、姜蘅之、林菀儿\n△沈淮青拽着被捆住双手的林菀儿，立于行辕门外。\n△大门打开，姜蘅之走出来，身后跟着萧綦。\n沈淮青（上前一步）：蘅之！\n△姜蘅之站定，看着他。\n沈淮青：蘅之，你救救我娘，她中风了，大夫说需安神定惊丸，那是你们姜家的方子。唯有你能配制成功。\n姜蘅之：所以，你现在是来求我，救你娘？`},
  {id: "modern-romance", genre: "现代甜宠", title: "电梯重逢", script: `3-2 写字楼电梯 早 内\n人物：程野、许念\n△电梯门将要合拢，程野伸手挡住。许念抬头，两人同时愣住。\n许念：你不是在国外吗？\n程野：昨晚刚回来。\n△电梯超载提示响起。\n程野（看着她）：看来有人不欢迎我。`},
  {id: "revenge", genre: "豪门复仇", title: "宴会揭面", script: `10-5 酒店宴会厅 夜 内\n人物：林澜、周曼、宾客\n周曼：保安，把这个冒充林家千金的女人赶出去！\n△林澜摘下手套，露出祖母绿家徽戒指。\n林澜：三年不见，周小姐连林家的东西都认不得了？\n△四周宾客哗然。`},
  {id: "suspense", genre: "悬疑刑侦", title: "冰箱里的证据", script: `5-8 出租屋厨房 深夜 内\n人物：陈默、秦雯\n△秦雯戴着手套拉开冰箱，冷气涌出。\n秦雯：死者失踪七天，牛奶却是昨天买的。\n陈默看向门锁：凶手回来过。\n△走廊外突然传来钥匙插入锁孔的声音。`},
  {id: "xianxia", genre: "仙侠虐恋", title: "断契", script: `22-1 诛仙台 黄昏 外\n人物：云璃、玄夜\n云璃：这一剑之后，你我两清。\n△云璃以剑划破掌心，灵契红线亮起。\n玄夜（上前一步）：你若真想两清，为何还在发抖？\n△云璃握剑的手骤然收紧。`},
  {id: "republic", genre: "民国谍战", title: "舞会交接", script: `14-4 百乐门舞池 夜 内\n人物：沈砚、白露、特务\n△沈砚与白露旋转擦肩，一枚胶卷落入白露掌心。\n白露（笑着）：先生踩到我的裙子了。\n沈砚：抱歉。\n△二人分开，白露看见出口处的特务正在盯着她。`},
  {id: "family", genre: "现实家庭", title: "病房缴费单", script: `9-3 医院走廊 日 内\n人物：母亲、陈嘉、护士\n护士：今天下班前还要补交两万元。\n△护士离开。母亲把缴费单折起藏到身后。\n陈嘉：妈，你是不是把房子卖了？\n母亲（笑）：别瞎想，妈有钱。`},
  {id: "workplace", genre: "都市职场", title: "方案署名", script: `6-2 公司会议室 日 内\n人物：李主管、叶晴、王总\n李主管：这套方案是我带团队熬了三个月做出来的。\n叶晴：是吗？\n△叶晴按下遥控器，大屏幕显示文件修改记录，作者全是“叶晴”。\n△王总转头看向李主管，李主管说不出话。`},
  {id: "action", genre: "动作危机", title: "雨夜拦车", script: `12-4 城外驿道 雨夜 外\n人物：顾昭、阿梨、车夫\n△马车疾驰，阿梨从路旁冲出，车夫猛拉缰绳。\n车夫：不要命了？！\n阿梨（喘息）：顾大人，我家小姐被人带走了！\n△车帘掀开，顾昭看清她手腕上的血迹。\n顾昭：上车。谁带走的，路上说。\n阿梨（愣住，随即点头）：是！`},
];

const samplePolishScript = `18-3 谢府祠堂 日 内\n人物：谢老夫人、谢明珠、苏棠\n谢老夫人：这支凤钗，为何会在你的妆匣里？\n谢明珠（强作镇定）：孙女不知，定是有人栽赃。\n苏棠：钗尾刻着领用日期，那日库房的钥匙只在大小姐手中。\n△谢明珠脸色骤变。`;

const samplePolishStoryboard = `【分镜1】
景别：中景
画面：谢明珠神色复杂地站在谢府祠堂里，看着前方的谢老夫人。她心虚地低着头。
台词：谢老夫人：“这支凤钗，为何会在你的妆匣里？”

【分镜2】
景别：近景
画面：谢明珠若有所思地退后一步，手帕死死攥在手心里，表情十分慌乱。
台词：谢明珠：“孙女不知，定是有人栽赃。”

【分镜3】
景别：特写
画面：苏棠怒不可遏，冷冷地盯着谢明珠，眼神闪过一丝杀意。
台词：苏棠：“钗尾刻着领用日期，那日库房的钥匙只在大小姐手中。”`;

export default function NodeTestPage() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [nodeId, setNodeId] = useState("");
  const [benchmarkId, setBenchmarkId] = useState("costume-family");
  const [script, setScript] = useState(samplePolishScript);
  const [storyboard, setStoryboard] = useState(samplePolishStoryboard);
  const [structureStoryboard, setStructureStoryboard] = useState("");
  const [performanceStoryboard, setPerformanceStoryboard] = useState("");
  const [v14Template, setV14Template] = useState("");
  const [v72Template, setV72Template] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [result, setResult] = useState<RunResult | null>(null);
  const [busy, setBusy] = useState<"" | "node" | "v14" | "v72" | "fusion">("");
  const [stageProgress, setStageProgress] = useState("");
  const [message, setMessage] = useState("正在读取节点……");
  const [polishMode, setPolishMode] = useState<"single" | "all">("single");
  const [activeShotIdx, setActiveShotIdx] = useState(0);
  const [activeAiModel, setActiveAiModel] = useState<string>("deepseek-v4-flash");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("loveu_ai_model");
      if (saved) setActiveAiModel(saved);
    } catch {}
    const handleModelChange = (event: Event) => {
      const next = (event as CustomEvent<string>).detail;
      if (next) setActiveAiModel(next);
    };
    window.addEventListener("loveu_ai_model_changed", handleModelChange);
    return () => window.removeEventListener("loveu_ai_model_changed", handleModelChange);
  }, []);
  const selected = useMemo(() => presets.find((item) => item.id === nodeId), [presets, nodeId]);
  const isFusion = nodeId === "structure-performance-fusion";
  const isPolish = nodeId === "shot-audiovisual-polish";

  const parsedShots = useMemo(() => {
    if (!storyboard) return [];
    const matches = [...storyboard.matchAll(/(?:【\s*分镜\s*(\d+)\s*】|【\s*镜头\s*(\d+)\s*】|(?:^|\n)\s*分镜\s*(\d+)[：:]|(?:^|\n)\s*镜头\s*(\d+)[：:])/g)];
    if (!matches.length) {
      const fallback = [...storyboard.matchAll(/【\s*([^】]+)\s*】/g)];
      if (fallback.length) {
        return fallback.map((match, index) => storyboard.slice(match.index || 0, fallback[index + 1]?.index ?? storyboard.length).trim());
      }
      return [storyboard.trim()].filter(Boolean);
    }
    return matches.map((match, index) => storyboard.slice(match.index || 0, matches[index + 1]?.index ?? storyboard.length).trim());
  }, [storyboard]);

  useEffect(() => {
    Promise.all([
      fetch("/api/deepseek/node-test").then((response) => response.json()),
      fetch("/api/deepseek/fewshot-test").then((response) => response.json()),
    ]).then(([nodeData, versionData]) => {
      setPresets(nodeData.presets || []);
      const presetsList = (nodeData.presets || []) as Preset[];
      
      // Check if there is an imported task from sessionStorage
      let importedNode = "";
      try {
        const impScript = window.sessionStorage.getItem("node_lab_import_script");
        const impStoryboard = window.sessionStorage.getItem("node_lab_import_storyboard");
        const impNodeId = window.sessionStorage.getItem("node_lab_import_nodeId");
        if (impScript) setScript(impScript);
        if (impStoryboard) setStoryboard(impStoryboard);
        if (impNodeId) importedNode = impNodeId;
        window.sessionStorage.removeItem("node_lab_import_script");
        window.sessionStorage.removeItem("node_lab_import_storyboard");
        window.sessionStorage.removeItem("node_lab_import_nodeId");
      } catch {}

      const targetId = importedNode || "shot-audiovisual-polish";
      const matched = presetsList.find((item) => item.id === targetId) || presetsList[0];
      if (matched) {
        setNodeId(matched.id);
        setSystemPrompt(matched.prompt);
      }
      
      const versions = (versionData.versions || []) as PromptVersion[];
      setV14Template(versions.find((item) => item.id === "v-1784457548938")?.template || "");
      setV72Template(versions.find((item) => item.id === "github-v7-2-test")?.template || "");
      setMessage("已就绪 · 默认选中视听三维精修节点");
    }).catch(() => setMessage("节点或提示词版本读取失败"));
  }, []);

  useEffect(() => {
    const saved = readFusionDrafts()[benchmarkId];
    if (saved?.structure) setStructureStoryboard(saved.structure);
    if (saved?.performance) setPerformanceStoryboard(saved.performance);
  }, [benchmarkId]);

  const selectNode = (id: string) => {
    const next = presets.find((item) => item.id === id);
    setNodeId(id); setSystemPrompt(next?.prompt || ""); setResult(null);
    if (id === "shot-audiovisual-polish" && !storyboard.trim()) {
      setStoryboard(samplePolishStoryboard);
      setScript(samplePolishScript);
    }
  };

  const selectBenchmark = (id: string) => {
    const next = benchmarks.find((item) => item.id === id);
    const saved = readFusionDrafts()[id];
    setBenchmarkId(id);
    if (next?.script) setScript(next.script);
    setStructureStoryboard(saved?.structure || ""); setPerformanceStoryboard(saved?.performance || ""); setResult(null);
    setMessage(saved?.structure || saved?.performance ? `已选择《${next?.title || "基准剧本"}》，已恢复保存的分镜` : `已选择《${next?.title || "基准剧本"}》`);
  };

  const loadPolishSample = () => {
    setScript(samplePolishScript);
    setStoryboard(samplePolishStoryboard);
    setMessage("已载入含典型缺陷的测试样本（修辞表情、无前中后景、缺少光影音效）");
  };

  const requestVersion = async (template: string, name: string) => {
    if (!template) throw new Error(`${name}提示词版本未加载`);
    const currentModel = window.localStorage.getItem("loveu_ai_model") || activeAiModel || "deepseek-v4-flash";
    const response = await fetch("/api/deepseek/fewshot-test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-ai-model": currentModel,
      },
      body: JSON.stringify({
        template,
        script,
        model: currentModel,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `${name}生成失败`);
    if (!data.prompt?.trim()) throw new Error(`${name}没有返回可识别的最终分镜`);
    return String(data.prompt).trim();
  };

  const generateOne = async (side: "v14" | "v72") => {
    setBusy(side); setResult(null); setMessage(`正在单独生成${side === "v14" ? "V14-5结构版" : "V7-2表演版"}……`);
    try {
      const output = await requestVersion(side === "v14" ? v14Template : v72Template, side === "v14" ? "V14-5" : "V7-2测试版");
      if (side === "v14") {setStructureStoryboard(output); writeFusionDraft(benchmarkId, {structure: output});}
      else {setPerformanceStoryboard(output); writeFusionDraft(benchmarkId, {performance: output});}
      setMessage(`${side === "v14" ? "V14-5结构版" : "V7-2表演版"}生成完成`);
    } catch (error) {setMessage(error instanceof Error ? error.message : "生成失败");} finally {setBusy("");}
  };

  const postNodeWithPolling = async (structure: string, performance = "") => {
    const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const isSingleShotPolish = nodeId === "shot-audiovisual-polish" && polishMode === "single";
    const currentModel = window.localStorage.getItem("loveu_ai_model") || activeAiModel || "deepseek-v4-flash";
    const response = await fetch("/api/deepseek/node-test", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-ai-model": currentModel,
      },
      body: JSON.stringify({
        taskId,
        model: currentModel,
        nodeId,
        script,
        storyboard: structure,
        performanceStoryboard: performance,
        systemPrompt,
        ...(isSingleShotPolish ? {
          targetShotIndex: activeShotIdx + 1,
          targetShotText: parsedShots[activeShotIdx] || structure,
        } : {}),
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "测试启动失败");

    if (data.status === "done" && data.result) {
      setResult(data.result);
      setStageProgress("");
      return data.result as RunResult;
    }

    // Poll for completion
    const pollInterval = 1200;
    const started = Date.now();
    while (true) {
      await new Promise((r) => setTimeout(r, pollInterval));
      const pollRes = await fetch(`/api/deepseek/node-test?taskId=${taskId}`);
      if (!pollRes.ok) throw new Error("轮询任务状态失败");
      const pollData = await pollRes.json();
      if (pollData.status === "done" && pollData.result) {
        setResult(pollData.result);
        setStageProgress("");
        return pollData.result as RunResult;
      } else if (pollData.status === "error") {
        throw new Error(pollData.error || "任务执行出错");
      } else {
        const sec = ((Date.now() - started) / 1000).toFixed(0);
        setStageProgress(`${pollData.stage || "正在执行推演与分析"} (${sec}s)`);
      }
    }
  };

  const runNode = async () => {
    if (!nodeId || !storyboard.trim()) return;
    setBusy("node");
    setStageProgress("正在发起节点任务……");
    setMessage(`正在运行 ${selected?.name || "节点"}……`);
    setResult(null);
    try {
      const data = await postNodeWithPolling(storyboard);
      setMessage(`完成 · ${(data.durationMs / 1000).toFixed(1)} 秒`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "测试失败");
      setStageProgress("");
    } finally {
      setBusy("");
    }
  };

  const runFusion = async () => {
    setBusy("fusion"); setResult(null);
    let structure = structureStoryboard.trim();
    let performance = performanceStoryboard.trim();
    try {
      const missing = [!structure ? "V14-5" : "", !performance ? "V7-2测试版" : ""].filter(Boolean).join("、");
      setMessage(missing ? `正在补齐${missing}，随后验收V14-5并融合……` : "两路结果已存在，正在验收V14-5并融合……");
      const [newStructure, newPerformance] = await Promise.all([
        structure ? Promise.resolve(structure) : requestVersion(v14Template, "V14-5"),
        performance ? Promise.resolve(performance) : requestVersion(v72Template, "V7-2测试版"),
      ]);
      structure = newStructure; performance = newPerformance;
      setStructureStoryboard(structure); setPerformanceStoryboard(performance);
      writeFusionDraft(benchmarkId, {structure, performance});
      setMessage("两路生成完成，正在依次检查并修订V14-5，随后融合……");
      const data = await postNode(structure, performance);
      setMessage(`融合完成 · ${(data.durationMs / 1000).toFixed(1)} 秒`);
    } catch (error) {setMessage(error instanceof Error ? error.message : "融合测试失败");} finally {setBusy("");}
  };

  return <main className="node-lab-page">
    <header>
      <div>
        <Link href="/test">← 返回版本测试</Link>
        <h1>节点实验台 · 视听三维精修上线</h1>
      </div>
      <nav>
        <DeepSeekModelToggle />
        <Link href="/">工作台</Link>
        <Link href="/debug">调试日志</Link>
        <span>{stageProgress || message}</span>
      </nav>
    </header>
    <section className="node-lab-toolbar">
      <label>
        测试节点
        <select value={nodeId} onChange={(event) => selectNode(event.target.value)}>
          {presets.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        基准剧本
        <select value={benchmarkId} onChange={(event) => selectBenchmark(event.target.value)}>
          {benchmarks.map((item) => (
            <option key={item.id} value={item.id}>
              {item.genre} · {item.title}
            </option>
          ))}
        </select>
      </label>
      {isPolish && (
        <>
          <label>
            精修模式
            <select value={polishMode} onChange={(e) => setPolishMode(e.target.value as "single" | "all")}>
              <option value="single">单镜头精修（极速 5-10s · 推荐）</option>
              <option value="all">全量分镜精修（全量深度推演）</option>
            </select>
          </label>
          <button type="button" className="node-lab-sample-btn" onClick={loadPolishSample}>
            载入典型缺陷分镜
          </button>
        </>
      )}
      <p>{selected?.note}</p>
      {isFusion ? (
        <div className="node-lab-actions">
          <button disabled={!!busy || !v14Template} onClick={() => generateOne("v14")}>
            {busy === "v14" ? "生成中……" : "单独生成 V14-5"}
          </button>
          <button disabled={!!busy || !v72Template} onClick={() => generateOne("v72")}>
            {busy === "v72" ? "生成中……" : "单独生成 V7-2"}
          </button>
          <button className="primary" disabled={!!busy || !script.trim()} onClick={runFusion}>
            {busy === "fusion" ? "验收并融合中……" : "验收V14-5并融合"}
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {isPolish && polishMode === "single" && parsedShots.length > 0 && (
            <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
              <span style={{ fontSize: "11px", fontWeight: "bold", color: "#666" }}>目标分镜:</span>
              {parsedShots.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  style={{
                    padding: "3px 8px",
                    fontSize: "11px",
                    borderRadius: "12px",
                    border: activeShotIdx === idx ? "1.5px solid #242321" : "1px solid #d4cebe",
                    background: activeShotIdx === idx ? "#242321" : "#fff",
                    color: activeShotIdx === idx ? "#fff" : "#333",
                    cursor: "pointer",
                  }}
                  onClick={() => setActiveShotIdx(idx)}
                >
                  第 {idx + 1} 镜
                </button>
              ))}
            </div>
          )}
          <button
            className="primary"
            disabled={!!busy || !nodeId || !storyboard.trim()}
            onClick={runNode}
          >
            {busy === "node"
              ? "精修推演中……"
              : isPolish && polishMode === "single"
              ? `⚡ 精修第 ${activeShotIdx + 1} 镜（极速5-10s）`
              : isPolish
              ? "🎬 全量运行视听精修"
              : "运行当前节点"}
          </button>
        </div>
      )}
    </section>
    <section className="node-lab-grid">
      <section className="node-lab-panel">
        <div className="node-lab-head">
          <b>01</b>
          <h2>测试输入（Input）</h2>
          {isPolish && <span className="node-lab-subtag">方位 · 表情 · 光影</span>}
        </div>
        <label>
          <span>剧本原文</span>
          <textarea value={script} onChange={(event) => setScript(event.target.value)} />
        </label>
        {isFusion ? (
          <>
            <label className="grow">
              <span>V14-5结构版分镜</span>
              <textarea
                value={structureStoryboard}
                onChange={(event) => {
                  const value = event.target.value;
                  setStructureStoryboard(value);
                  writeFusionDraft(benchmarkId, {structure: value});
                }}
                placeholder="可单独生成；为空时运行融合会自动生成"
              />
            </label>
            <label className="grow">
              <span>V7-2测试版表演版分镜</span>
              <textarea
                value={performanceStoryboard}
                onChange={(event) => {
                  const value = event.target.value;
                  setPerformanceStoryboard(value);
                  writeFusionDraft(benchmarkId, {performance: value});
                }}
                placeholder="可单独生成；为空时运行融合会自动生成"
              />
            </label>
          </>
        ) : (
          <label className="grow">
            <span>待处理分镜（输入源）</span>
            <textarea
              value={storyboard}
              onChange={(event) => setStoryboard(event.target.value)}
              placeholder="输入需要经此节点分析、检查并修改的原始分镜……"
            />
          </label>
        )}
      </section>
      <section className="node-lab-panel">
        <div className="node-lab-head">
          <b>02</b>
          <h2>节点 Prompt（三维规范）</h2>
          <button onClick={() => setSystemPrompt(selected?.prompt || "")}>恢复默认</button>
        </div>
        <textarea
          className="prompt-editor"
          value={systemPrompt}
          onChange={(event) => setSystemPrompt(event.target.value)}
        />
        <footer>可直接改写调试；修改只影响本次测试</footer>
      </section>
      <section className="node-lab-panel node-output">
        <div className="node-lab-head">
          <b>03</b>
          <h2>节点输出（Output）</h2>
          {result && <span>{(result.durationMs / 1000).toFixed(1)}s · {result.stages.length} 阶段</span>}
        </div>
        {result ? (
          <>
            {isPolish && result.stages[0]?.output.includes("<POLISH_ANALYSIS>") && (
              <details open>
                <summary>
                  🧠 逐镜诊断与升维推演（Analysis）
                </summary>
                <h3>逐镜方位、表情去修辞、光影音效设计思路</h3>
                <pre>
                  {result.stages[0].output.match(/<POLISH_ANALYSIS>([\s\S]*?)<\/POLISH_ANALYSIS>/i)?.[1]?.trim() ||
                    "暂无推演标签"}
                </pre>
              </details>
            )}

            <details open className="result-final-block">
              <summary>
                <span>✨ 最终精修结果（Final Result）</span>
                <button
                  type="button"
                  style={{float: "right", border: "1px solid #c9c5bc", padding: "2px 8px", cursor: "pointer"}}
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard?.writeText(result.finalResult);
                    alert("已复制最终分镜！");
                  }}
                >
                  复制分镜
                </button>
              </summary>
              <pre>{result.finalResult}</pre>
            </details>

            {result.stages.map((stage, index) => (
              <details key={`${stage.id}-${index}`}>
                <summary>
                  {stage.name}<i>{(stage.durationMs / 1000).toFixed(1)}s</i>
                </summary>
                <h3>模型原始输出（含思考过程）</h3>
                <pre>{stage.output}</pre>
                {stage.result !== stage.output && (
                  <>
                    <h3>应用提取结果</h3>
                    <pre>{stage.result}</pre>
                  </>
                )}
              </details>
            ))}
          </>
        ) : (
          <div className="node-lab-empty">
            {stageProgress ? (
              <div style={{display: "flex", flexDirection: "column", gap: "8px", alignItems: "center"}}>
                <strong>{stageProgress}</strong>
                <p>模型正在逐镜头审视空间方位、去修辞生理化、补齐环境光影音效……</p>
              </div>
            ) : isFusion ? (
              "选择基准剧本，可分别生成两路分镜，也可直接运行融合自动补齐缺失结果。"
            ) : (
              "选择节点、输入剧本和分镜，点击「运行视听精修节点」即可在右侧清晰对比输入与输出。"
            )}
          </div>
        )}
      </section>
    </section>
  </main>;
}
