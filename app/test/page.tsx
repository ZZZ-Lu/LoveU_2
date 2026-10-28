/* eslint-disable react-hooks/immutability, react-hooks/set-state-in-effect */
"use client";
import {useEffect, useMemo, useState} from "react";
import Link from "next/link";
import DeepSeekModelToggle from "../components/deepseek-model-toggle";

type CaseItem = {id: string; genre: string; title: string; script: string};
type PromptVersion = {id: string; name: string; note: string; template: string; createdAt: number; builtIn?: boolean; localOverride?: boolean};
type PromptVersionResponse = {current: string; versions: Array<{id: string; version: string; name: string; note: string; template: string}>};
type TestResult = {id: string; versionId: string; caseId: string; createdAt: number; durationMs: number; shotCount: number; imagination: string; prompt: string; rawInput: string; rawOutput: string; rating: number; verdict: "未评价" | "通过" | "需修改"; note: string; model: string};

const cases: CaseItem[] = [
  {id: "costume-family", genre: "古装宅斗", title: "祠堂对质", script: `18-3 谢府祠堂 日 内\n人物：谢老夫人、谢明珠、苏棠\n谢老夫人：这支凤钗，为何会在你的妆匣里？\n谢明珠（强作镇定）：孙女不知，定是有人栽赃。\n苏棠：钗尾刻着领用日期，那日库房的钥匙只在大小姐手中。\n△谢明珠脸色骤变。`},
  {id: "costume-strategy", genre: "古装权谋", title: "密折试探", script: `7-6 王府书房 夜 内\n人物：靖王、裴策\n裴策：东宫的人已经截下密折。\n靖王：截下，未必看过。\n裴策：殿下为何如此肯定？\n靖王（落下一枚黑子）：因为那封折子，本就是写给他看的。`},
  {id: "costume-medicine-plea", genre: "古装情感", title: "行辕求药", script: `28-1 山河镇临时行辕 门外\n人物：沈淮青、姜蘅之、林菀儿\n△沈淮青拽着被捆住双手的林菀儿，立于行辕门外。\n△大门打开，姜蘅之走出来，身后跟着萧綦。\n沈淮青（上前一步）：蘅之！\n△姜蘅之站定，看着他。\n沈淮青：蘅之，你救救我娘，她中风了，大夫说需安神定惊丸，那是你们姜家的方子。唯有你能配制成功。\n姜蘅之：所以，你现在是来求我，救你娘？`},
  {id: "modern-romance", genre: "现代甜宠", title: "电梯重逢", script: `3-2 写字楼电梯 早 内\n人物：程野、许念\n△电梯门将要合拢，程野伸手挡住。许念抬头，两人同时愣住。\n许念：你不是在国外吗？\n程野：昨晚刚回来。\n△电梯超载提示响起。\n程野（看着她）：看来有人不欢迎我。`},
  {id: "revenge", genre: "豪门复仇", title: "宴会揭面", script: `10-5 酒店宴会厅 夜 内\n人物：林澜、周曼、宾客\n周曼：保安，把这个冒充林家千金的女人赶出去！\n△林澜摘下手套，露出祖母绿家徽戒指。\n林澜：三年不见，周小姐连林家的东西都认不得了？\n△四周宾客哗然。`},
  {id: "suspense", genre: "悬疑刑侦", title: "冰箱里的证据", script: `5-8 出租屋厨房 深夜 内\n人物：陈默、秦雯\n△秦雯戴着手套拉开冰箱，冷气涌出。\n秦雯：死者失踪七天，牛奶却是昨天买的。\n陈默看向门锁：凶手回来过。\n△走廊外突然传来钥匙插入锁孔的声音。`},
  {id: "xianxia", genre: "仙侠虐恋", title: "断契", script: `26-1 诛仙台 黄昏 外\n人物：玄夜、云璃\n云璃：这一剑之后，你我两清。\n△云璃割破掌心，灵契红线在两人之间亮起。\n玄夜（上前一步）：你若真想两清，为何还在发抖？\n△云璃握剑的手骤然收紧。`},
  {id: "republic", genre: "民国谍战", title: "舞会交接", script: `14-4 百乐门舞池 夜 内\n人物：沈砚、白露、特务\n△沈砚与白露旋转擦肩，一枚胶卷落入白露掌心。\n白露（笑着）：先生踩到我的裙子了。\n沈砚：抱歉。\n△二人分开，白露看见出口处的特务正在盯着她。`},
  {id: "family", genre: "现实家庭", title: "病房缴费单", script: `9-3 医院走廊 日 内\n人物：母亲、陈嘉、护士\n护士：今天下班前还要补交两万元。\n△护士离开。母亲把缴费单折起藏到身后。\n陈嘉：妈，你是不是把房子卖了？\n母亲（笑）：别瞎想，妈有钱。`},
  {id: "workplace", genre: "都市职场", title: "方案署名", script: `6-7 会议室 日 内\n人物：叶晴、王总、李主管\n李主管：这套方案是我带团队熬了三个月做出来的。\n叶晴：是吗？\n△叶晴按下遥控器，屏幕出现文件修改记录，作者一栏全是叶晴。\n王总转头看向李主管。`},
  {id: "action", genre: "动作危机", title: "雨夜拦车", script: `12-4 城外驿道 雨夜 外\n人物：顾昭、阿梨、车夫\n△马车疾驰，阿梨从路旁冲出，车夫猛拉缰绳。\n车夫：不要命了？！\n阿梨（喘息）：顾大人，我家小姐被人带走了！\n△车帘掀开，顾昭看清她手腕上的血迹。\n顾昭：上车。谁带走的，路上说。\n阿梨（愣住，随即点头）：是！`},
];

const openLab = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open("fewshot-test-lab", 1);
  request.onupgradeneeded = () => {
    request.result.createObjectStore("versions", {keyPath: "id"});
    request.result.createObjectStore("results", {keyPath: "id"});
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
const getAll = async <T,>(storeName: string) => {
  const db = await openLab();
  return new Promise<T[]>((resolve, reject) => {const request = db.transaction(storeName).objectStore(storeName).getAll(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);});
};
const put = async (storeName: string, value: unknown) => {const db = await openLab(); const tx = db.transaction(storeName, "readwrite"); tx.objectStore(storeName).put(value); return new Promise<void>((resolve, reject) => {tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);});};

function Lab() {
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [results, setResults] = useState<TestResult[]>([]);
  
  // Safe to read localStorage synchronously here because Lab only renders on client
  const [caseId, setCaseId] = useState(() => window.localStorage.getItem("fewshot_lab_caseId") || cases[0].id);
  const [versionId, setVersionId] = useState(() => window.localStorage.getItem("fewshot_lab_versionId") || "");
  const [draft, setDraft] = useState(() => window.localStorage.getItem("fewshot_lab_draft") || "");
  const [name, setName] = useState(() => window.localStorage.getItem("fewshot_lab_name") || "");
  const [note, setNote] = useState(() => window.localStorage.getItem("fewshot_lab_note") || "");
  
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("正在读取测试记录……");
  const [selectedResultId, setSelectedResultId] = useState(() => window.localStorage.getItem("fewshot_lab_selectedResultId") || "");
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

  const getModelLabel = (m: string) => {
    if (m === "deepseek-v4-flash") return "Flash";
    if (m === "deepseek-v4-pro") return "Pro";
    if (m === "kimi-k3-high") return "K3 High";
    if (m === "kimi-k3-max") return "K3 Max";
    return m;
  };

  const activeCase = cases.find((item) => item.id === caseId) || cases[0];
  const activeVersion = versions.find((item) => item.id === versionId);
  const matching = useMemo(() => results.filter((item) => item.caseId === caseId && item.versionId === versionId).sort((a, b) => b.createdAt - a.createdAt), [results, caseId, versionId]);
  const selectedResult = results.find((item) => item.id === selectedResultId) || matching[0];

  // Audiovisual Polish Node state (Single-shot & Fast)
  const [selectedShotIdx, setSelectedShotIdx] = useState(0);
  const [polishedShots, setPolishedShots] = useState<Record<number, { text: string; analysis: string; durationMs: number }>>({});
  const [polishRunning, setPolishRunning] = useState(false);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [polishStageText, setPolishStageText] = useState("");
  const stopPipelineRef = useState({ stop: false })[0];

  // Helper: split storyboard into individual shots
  const parseShots = (content: string): string[] => {
    if (!content) return [];
    const matches = [...content.matchAll(/(?:【\s*分镜\s*(\d+)\s*】|【\s*镜头\s*(\d+)\s*】|(?:^|\n)\s*分镜\s*(\d+)[：:]|(?:^|\n)\s*镜头\s*(\d+)[：:])/g)];
    if (!matches.length) {
      const fallback = [...content.matchAll(/【\s*([^】]+)\s*】/g)];
      if (fallback.length) {
        return fallback.map((match, index) => content.slice(match.index || 0, fallback[index + 1]?.index ?? content.length).trim());
      }
      return [content.trim()].filter(Boolean);
    }
    return matches.map((match, index) => content.slice(match.index || 0, matches[index + 1]?.index ?? content.length).trim());
  };

  const currentShots = useMemo(() => {
    return parseShots(selectedResult?.prompt || "");
  }, [selectedResult?.prompt]);

  // Load saved polish map for the active test result from localStorage
  useEffect(() => {
    if (!selectedResult?.id) {
      setPolishedShots({});
      return;
    }
    try {
      const saved = window.localStorage.getItem(`fewshot_polish_map_${selectedResult.id}`);
      if (saved) {
        setPolishedShots(JSON.parse(saved));
      } else {
        setPolishedShots({});
      }
    } catch {
      setPolishedShots({});
    }
    setSelectedShotIdx(0);
    setPolishStageText("");
  }, [selectedResult?.id]);

  const savePolishedMap = (newMap: Record<number, { text: string; analysis: string; durationMs: number }>) => {
    setPolishedShots(newMap);
    if (selectedResult?.id) {
      try {
        window.localStorage.setItem(`fewshot_polish_map_${selectedResult.id}`, JSON.stringify(newMap));
      } catch {}
    }
  };

  // Run single shot polish (Only polish ONE shot at a time, 5~10s)
  const runSingleShot = async (targetIdx: number): Promise<boolean> => {
    if (!selectedResult?.prompt || targetIdx < 0 || targetIdx >= currentShots.length) return false;
    const targetShotText = currentShots[targetIdx];
    const currentModel = window.localStorage.getItem("loveu_ai_model") || activeAiModel || "deepseek-v4-flash";
    const currentLabel = getModelLabel(currentModel);

    setPolishRunning(true);
    setPolishStageText(`[${currentLabel}] 正在对第 ${targetIdx + 1} 镜执行视听升维……`);

    const taskId = `single-polish-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const payload = {
      taskId,
      model: currentModel,
      nodeId: "shot-audiovisual-polish",
      script: activeCase.script,
      storyboard: selectedResult.prompt,
      targetShotIndex: targetIdx + 1,
      targetShotText,
    };

    const started = Date.now();
    const liveTimer = setInterval(() => {
      const sec = ((Date.now() - started) / 1000).toFixed(1);
      setPolishStageText(`[${currentLabel}] 正在构思第 ${targetIdx + 1} 镜视听画面 (${sec}s)`);
    }, 200);

    try {
      const initRes = await fetch("/api/deepseek/node-test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-ai-model": currentModel,
        },
        body: JSON.stringify(payload),
      });
      clearInterval(liveTimer);

      if (!initRes.ok) {
        const errJson = await initRes.json().catch(() => ({}));
        throw new Error(errJson.error || "单镜精修失败");
      }

      const initData = await initRes.json();
      if (initData.status === "done" && initData.result) {
        const polishedText = initData.result.polishedShot || initData.result.finalResult;
        const analysisText = initData.result.analysis || initData.result.stages?.[0]?.output || "";
        const durMs = initData.result.durationMs || (Date.now() - started);
        const usedModel = initData.model || initData.result.model || currentModel;

        const updatedMap = {
          ...polishedShots,
          [targetIdx]: {
            text: polishedText,
            analysis: analysisText,
            durationMs: durMs,
          },
        };
        savePolishedMap(updatedMap);
        setPolishStageText(`[${getModelLabel(usedModel)}] 第 ${targetIdx + 1} 镜精修成功！耗时 ${(durMs / 1000).toFixed(1)}s`);
        return true;
      }

      const pollInterval = 1200;
      while (true) {
        if (stopPipelineRef.stop) {
          fetch(`/api/deepseek/node-test?taskId=${taskId}`, {method: "DELETE"}).catch(() => {});
          setPolishStageText("已终止");
          return false;
        }
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
        const checkRes = await fetch(`/api/deepseek/node-test?taskId=${taskId}`);
        if (!checkRes.ok) throw new Error("轮询任务状态失败");
        const taskData = await checkRes.json();

        if (taskData.status === "done" && taskData.result) {
          const polishedText = taskData.result.polishedShot || taskData.result.finalResult;
          const analysisText = taskData.result.analysis || taskData.result.stages?.[0]?.output || "";
          const durMs = taskData.result.durationMs || (Date.now() - started);
          const usedModel = taskData.model || taskData.result.model || currentModel;

          const updatedMap = {
            ...polishedShots,
            [targetIdx]: {
              text: polishedText,
              analysis: analysisText,
              durationMs: durMs,
            },
          };
          savePolishedMap(updatedMap);
          setPolishStageText(`[${getModelLabel(usedModel)}] 第 ${targetIdx + 1} 镜精修成功！耗时 ${(durMs / 1000).toFixed(1)}s`);
          return true;
        } else if (taskData.status === "error") {
          throw new Error(taskData.error || "单镜精修失败");
        } else {
          const sec = ((Date.now() - started) / 1000).toFixed(0);
          const stageDesc = taskData.stage || `正在构思第 ${targetIdx + 1} 镜视听画面`;
          setPolishStageText(`[${currentLabel}] ${stageDesc} (${sec}s)`);
        }
      }
    } catch (err) {
      clearInterval(liveTimer);
      setPolishStageText(err instanceof Error ? err.message : "单镜精修出错");
      return false;
    } finally {
      clearInterval(liveTimer);
      setPolishRunning(false);
    }
  };

  // Batch pipeline: polish shot-by-shot sequentially, saving after each shot
  const runSequentialPipeline = async () => {
    if (pipelineRunning || polishRunning || !currentShots.length) return;
    setPipelineRunning(true);
    stopPipelineRef.stop = false;

    try {
      for (let i = 0; i < currentShots.length; i++) {
        if (stopPipelineRef.stop) break;
        setSelectedShotIdx(i);
        const ok = await runSingleShot(i);
        if (!ok || stopPipelineRef.stop) break;
        await new Promise((r) => setTimeout(r, 600));
      }
    } finally {
      setPipelineRunning(false);
      stopPipelineRef.stop = false;
    }
  };

  const stopPipeline = () => {
    stopPipelineRef.stop = true;
    setPipelineRunning(false);
    setPolishRunning(false);
    setPolishStageText("已暂停精修。已完成的镜头已安全保存。");
  };

  const resetCurrentShot = (idx: number) => {
    const updated = { ...polishedShots };
    delete updated[idx];
    savePolishedMap(updated);
    setPolishStageText(`已恢复第 ${idx + 1} 镜为原始分镜`);
  };

  // Merged full storyboard with polished shots applied
  const fullMergedStoryboard = useMemo(() => {
    if (!currentShots.length) return selectedResult?.prompt || "";
    return currentShots.map((raw, idx) => polishedShots[idx]?.text || raw).join("\n\n");
  }, [currentShots, polishedShots, selectedResult?.prompt]);

  const jumpToNodeLab = () => {
    if (!selectedResult) return;
    try {
      window.sessionStorage.setItem("node_lab_import_script", activeCase.script);
      window.sessionStorage.setItem("node_lab_import_storyboard", currentShots[selectedShotIdx] || selectedResult.prompt);
      window.sessionStorage.setItem("node_lab_import_nodeId", "shot-audiovisual-polish");
    } catch {}
    window.location.href = "/node-test";
  };

  useEffect(() => { window.localStorage.setItem("fewshot_lab_caseId", caseId); }, [caseId]);
  useEffect(() => { window.localStorage.setItem("fewshot_lab_draft", draft); }, [draft]);
  useEffect(() => { window.localStorage.setItem("fewshot_lab_name", name); }, [name]);
  useEffect(() => { window.localStorage.setItem("fewshot_lab_note", note); }, [note]);
  useEffect(() => { window.localStorage.setItem("fewshot_lab_versionId", versionId); }, [versionId]);
  useEffect(() => { window.localStorage.setItem("fewshot_lab_selectedResultId", selectedResultId); }, [selectedResultId]);

  useEffect(() => {
    Promise.all([getAll<PromptVersion>("versions"), getAll<TestResult>("results"), fetch("/api/deepseek/fewshot-test").then((response) => response.json() as Promise<PromptVersionResponse>)]).then(([savedVersions, savedResults, catalog]) => {
      const archivedBuiltIns: PromptVersion[] = catalog.versions.map((item) => ({...item, createdAt: 0, builtIn: true}));
      const savedById = new Map(savedVersions.filter((item) => item.localOverride).map((item) => [item.id, item]));
      const builtIns = archivedBuiltIns.map((item) => {
        const override = savedById.get(item.id);
        return override ? {...item, ...override, builtIn: true, localOverride: true} : item;
      });
      const builtInIds = new Set(archivedBuiltIns.map((item) => item.id));
      const customVersions = savedVersions
        .filter((item) => !item.builtIn && !builtInIds.has(item.id))
        .sort((a, b) => b.createdAt - a.createdAt);
      const next = [...builtIns, ...customVersions];
      const current = builtIns.find((item) => item.id === catalog.current)
        || builtIns.find((item) => item.id === `builtin-${catalog.current}`)
        || builtIns[0];
      
      setVersions(next); 
      setResults(savedResults);
      
      setVersionId((prevVersionId) => {
        const idToUse = prevVersionId || current.id;
        const initialVersion = next.find(item => item.id === idToUse) || current;
        
        setDraft((prevDraft) => {
          if (!prevDraft) return initialVersion.template;
          return prevDraft;
        });
        
        return initialVersion.id;
      });

      setMessage(`已读取 GitHub 归档 ${builtIns.length} 个版本，本机临时版本 ${customVersions.length} 个`);

      const pendingTaskId = window.localStorage.getItem("fewshot_lab_pendingTaskId");
      const pendingTaskCtxStr = window.localStorage.getItem("fewshot_lab_pendingTaskContext");
      if (pendingTaskId && pendingTaskCtxStr) {
        const ctx = JSON.parse(pendingTaskCtxStr);
        setRunning(true);
        setMessage("检测到上次未完成的测试，正在后台恢复并等待结果...");

        const poll = async () => {
          if (!window.localStorage.getItem("fewshot_lab_pendingTaskId")) return;
          try {
            const res = await fetch(`/api/deepseek/fewshot-test?taskId=${pendingTaskId}`);
            if (res.status === 404) {
              setRunning(false);
              setMessage("测试任务已在服务器端丢失（可能服务重启）。");
              window.localStorage.removeItem("fewshot_lab_pendingTaskId");
              return;
            }
            const data = await res.json();
            if (data.status === "running") {
              window.setTimeout(poll, 2000);
            } else if (data.status === "done") {
              const result: TestResult = {id: `r-${Date.now()}`, versionId: ctx.versionId, caseId: ctx.caseId, createdAt: Date.now(), durationMs: data.result.durationMs, shotCount: data.result.shotCount, imagination: data.result.imagination, prompt: data.result.prompt, rawInput: data.result.rawInput, rawOutput: data.result.rawOutput, rating: 0, verdict: "未评价", note: "", model: data.result.model};
              await put("results", result);
              setResults((all) => [result, ...all]);
              setSelectedResultId(result.id);
              window.localStorage.setItem("fewshot_lab_selectedResultId", result.id);
              setMessage(`后台恢复测试完成 · ${result.shotCount} 个分镜 · ${(result.durationMs / 1000).toFixed(1)} 秒`);
              setRunning(false);
              window.localStorage.removeItem("fewshot_lab_pendingTaskId");
            } else if (data.status === "error") {
              setMessage(data.error || "后台测试失败");
              setRunning(false);
              window.localStorage.removeItem("fewshot_lab_pendingTaskId");
            }
          } catch {
             if (window.localStorage.getItem("fewshot_lab_pendingTaskId")) {
               window.setTimeout(poll, 2000);
             }
          }
        };
        poll();
      }
    }).catch(() => setMessage("读取测试记录失败"));
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (activeVersion && draft !== activeVersion.template) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [activeVersion, draft]);

  const selectVersion = (id: string) => {
    const version = versions.find((item) => item.id === id);
    setVersionId(id);
    setDraft(version?.template || "");
    setSelectedResultId("");
  };
  
  const saveVersion = async () => {
    if (!draft.trim()) return;
    const version: PromptVersion = {id: `v-${Date.now()}`, name: name.trim() || `v${versions.length + 1}`, note: note.trim(), template: draft, createdAt: Date.now()};
    await put("versions", version); setVersions((all) => [version, ...all]); setVersionId(version.id); setName(""); setNote(""); setMessage(`已保存 ${version.name}`);
  };
  
  const overwriteVersion = async () => {
    if (!activeVersion || !draft.trim()) return;
    const updated: PromptVersion = {
      ...activeVersion,
      name: name.trim() || activeVersion.name,
      note: note.trim() || activeVersion.note,
      template: draft,
      createdAt: Date.now(),
      builtIn: false,
      localOverride: activeVersion.builtIn || activeVersion.localOverride,
    };
    await put("versions", updated);
    setVersions((all) => all.map((item) => item.id === updated.id ? {...updated, builtIn: item.builtIn, localOverride: updated.localOverride} : item));
    setName(""); setNote(""); setMessage(`已覆盖保存 ${updated.name}`);
  };
  
  const run = async () => {
    if (!activeVersion && !draft) return;
    setRunning(true); setMessage(`正在用 ${activeVersion?.name || "当前草稿"} 测试《${activeCase.title}》……`);
    const taskId = `task-${Date.now()}`;
    const taskCtx = { versionId: activeVersion?.id || versionId, caseId };
    window.localStorage.setItem("fewshot_lab_pendingTaskId", taskId);
    window.localStorage.setItem("fewshot_lab_pendingTaskContext", JSON.stringify(taskCtx));
    const currentModel = window.localStorage.getItem("loveu_ai_model") || activeAiModel || "deepseek-v4-flash";
    try {
      const response = await fetch("/api/deepseek/fewshot-test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-ai-model": currentModel,
        },
        body: JSON.stringify({
          template: activeVersion?.template || draft,
          script: activeCase.script,
          taskId,
          model: currentModel,
        }),
      });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "测试失败");
      const result: TestResult = {id: `r-${Date.now()}`, versionId: taskCtx.versionId, caseId: taskCtx.caseId, createdAt: Date.now(), durationMs: data.durationMs, shotCount: data.shotCount, imagination: data.imagination, prompt: data.prompt, rawInput: data.rawInput, rawOutput: data.rawOutput, rating: 0, verdict: "未评价", note: "", model: data.model};
      await put("results", result); setResults((all) => [result, ...all]); 
      setSelectedResultId(result.id); 
      window.localStorage.setItem("fewshot_lab_selectedResultId", result.id);
      setMessage(`测试完成 · ${result.shotCount} 个分镜 · ${(result.durationMs / 1000).toFixed(1)} 秒`);
      window.localStorage.removeItem("fewshot_lab_pendingTaskId");
    } catch (error) {
      if (window.localStorage.getItem("fewshot_lab_pendingTaskId")) {
        // Did not successfully clear it, let the polling take over on reload
        setMessage("请求已转入后台运行 (或网络中断)... 请勿离开，刷新页面即可恢复进度。");
      } else {
        setMessage(error instanceof Error ? error.message : "测试失败");
      }
    } finally {
      // Don't setRunning(false) if we rely on background
      if (!window.localStorage.getItem("fewshot_lab_pendingTaskId")) setRunning(false);
    }
  };

  const stopTest = () => {
    window.localStorage.removeItem("fewshot_lab_pendingTaskId");
    window.localStorage.removeItem("fewshot_lab_pendingTaskContext");
    setRunning(false);
    setMessage("已手动停止等待，后台任务可能仍在运行但结果将被丢弃。");
  };
  
  const review = async (patch: Partial<TestResult>) => {if (!selectedResult) return; const updated = {...selectedResult, ...patch}; await put("results", updated); setResults((all) => all.map((item) => item.id === updated.id ? updated : item));};

  return (
    <>
      <header>
        <div>
          <Link href="/">← 返回工作台</Link>
          <h1>Few-shot 版本实验台</h1>
        </div>
        <nav>
          <DeepSeekModelToggle />
          <Link href="/node-test">节点测试</Link>
          <Link href="/debug">调试日志</Link>
          <span>{message}</span>
        </nav>
      </header>
      <section className="lab-grid">
        <section className="lab-column"><div className="lab-head"><p>01</p><h2>基准剧本</h2><span>{cases.length} 种短剧类型</span></div><select value={caseId} onChange={(event) => {setCaseId(event.target.value); setSelectedResultId("");}}>{cases.map((item) => <option key={item.id} value={item.id}>{item.genre} · {item.title}</option>)}</select><textarea value={activeCase.script} readOnly aria-label="基准测试剧本" /><footer><span>{activeCase.genre}</span><span>{activeCase.script.length} 字</span></footer></section>
        <section className="lab-column"><div className="lab-head"><p>02</p><h2>提示词版本</h2><span>{versions.length} 个可用版本</span></div><select value={versionId} onChange={(event) => selectVersion(event.target.value)}>{versions.map((item) => <option key={item.id} value={item.id}>{item.name}{item.builtIn ? ` · 内置${item.localOverride ? " · 已覆盖" : ""}` : ` · ${new Date(item.createdAt).toLocaleString("zh-CN")}`}</option>)}</select><textarea value={draft} onChange={(event) => setDraft(event.target.value)} aria-label="编辑 few-shot 提示词版本" /><div className="lab-save"><input value={name} onChange={(event) => setName(event.target.value)} placeholder="新版本名称" /><input value={note} onChange={(event) => setNote(event.target.value)} placeholder="本次改动说明" /><button onClick={saveVersion}>另存为新版本</button><button className="overwrite" disabled={!activeVersion || !draft.trim()} onClick={overwriteVersion}>覆盖当前版本</button></div><footer><span>{activeVersion?.note || "可编辑后另存或覆盖当前版本"}</span><button className="dark" disabled={!running && !versionId} onClick={running ? stopTest : run}>{running ? "停止测试" : "只运行 Few-shot"}</button></footer></section>
        <section className="lab-column result-column">
          <div className="lab-head">
            <p>03</p>
            <h2>测试表现</h2>
            <span>{matching.length} 次运行</span>
          </div>
          {matching.length > 0 && (
            <select value={selectedResult?.id || ""} onChange={(event) => setSelectedResultId(event.target.value)}>
              {matching.map((item) => (
                <option key={item.id} value={item.id}>
                  {new Date(item.createdAt).toLocaleString("zh-CN")} · {item.shotCount} 镜 · {item.verdict}
                </option>
              ))}
            </select>
          )}
          {selectedResult ? (
            <>
              <div className="result-metrics">
                <b>{selectedResult.shotCount} 镜</b>
                <span>{(selectedResult.durationMs / 1000).toFixed(1)} 秒</span>
                <span>{selectedResult.model}</span>
              </div>
              <details open>
                <summary>意识流推演</summary>
                <pre>{selectedResult.imagination}</pre>
              </details>
              <details open>
                <summary>初始生成分镜（基准输出）</summary>
                <pre>{selectedResult.prompt}</pre>
              </details>

              <div className="polish-node-box">
                <div className="polish-box-header">
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
                      <span className="polish-tag">单镜头极速模式 · 5-10s</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                        activeAiModel.includes("flash")
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-300"
                          : "bg-amber-50 text-amber-700 border border-amber-300"
                      }`}>
                        执行模型：<strong>{getModelLabel(activeAiModel)}</strong>
                        {activeAiModel.includes("flash") ? " (极速响应)" : ""}
                      </span>
                    </div>
                    <strong className="polish-title">导演级视听精修（单镜极速模式 · 一镜一存）</strong>
                    <p className="polish-desc">真实画面构想与生动描述：说人话、去伪参数、写完整清楚，每镜即时落盘保存</p>
                  </div>
                  <div className="polish-box-actions">
                    <button
                      className="polish-run-btn"
                      disabled={polishRunning || pipelineRunning || !currentShots.length}
                      onClick={() => runSingleShot(selectedShotIdx)}
                    >
                      {polishRunning && !pipelineRunning ? "正在精修本镜……" : `⚡ 精修当前分镜（第 ${selectedShotIdx + 1} 镜）`}
                    </button>
                    <button
                      className="polish-pipeline-btn"
                      disabled={polishRunning && !pipelineRunning}
                      onClick={pipelineRunning ? stopPipeline : runSequentialPipeline}
                    >
                      {pipelineRunning ? "⏸ 暂停逐镜" : "▶ 逐镜依次精修（一镜一存）"}
                    </button>
                    <button className="polish-jump-btn" onClick={jumpToNodeLab}>
                      深入调试节点 →
                    </button>
                  </div>
                </div>

                {/* Shot Navigation Tabs */}
                {currentShots.length > 0 && (
                  <div className="polish-shot-tabs">
                    <div className="polish-tabs-header">
                      <span>镜头选择（共 {currentShots.length} 镜 · 已精修 {Object.keys(polishedShots).length} 镜）：</span>
                      {pipelineRunning && <span className="pipeline-running-badge">逐镜流水线推进中……</span>}
                    </div>
                    <div className="polish-tabs-list">
                      {currentShots.map((shot, idx) => {
                        const isDone = Boolean(polishedShots[idx]);
                        const isSelected = selectedShotIdx === idx;
                        const isCurrentPolishing = polishRunning && selectedShotIdx === idx;
                        return (
                          <button
                            key={idx}
                            type="button"
                            className={`polish-tab-pill ${isSelected ? "active" : ""} ${isDone ? "done" : ""} ${isCurrentPolishing ? "polishing" : ""}`}
                            onClick={() => setSelectedShotIdx(idx)}
                          >
                            <span>第 {idx + 1} 镜</span>
                            {isDone ? (
                              <b className="tab-pill-done">✓</b>
                            ) : isCurrentPolishing ? (
                              <b className="tab-pill-busy">…</b>
                            ) : (
                              <b className="tab-pill-todo">待修</b>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {polishStageText && (
                  <div className={`polish-stage-status ${polishRunning || pipelineRunning ? "running" : ""}`}>
                    {(polishRunning || pipelineRunning) && <span className="polish-spinner" />}
                    <span>{polishStageText}</span>
                  </div>
                )}

                {/* Current Selected Shot Details */}
                {currentShots.length > 0 && (
                  <div className="polish-shot-inspector">
                    <div className="shot-inspector-header">
                      <strong>【当前选中：第 {selectedShotIdx + 1} 镜】</strong>
                      <div className="shot-inspector-actions">
                        {polishedShots[selectedShotIdx] && (
                           <button
                            type="button"
                            className="shot-reset-btn"
                            onClick={() => resetCurrentShot(selectedShotIdx)}
                          >
                            ↺ 恢复本镜为原版
                          </button>
                        )}
                        <button
                          type="button"
                          className="shot-instant-btn"
                          disabled={polishRunning || pipelineRunning}
                          onClick={() => runSingleShot(selectedShotIdx)}
                        >
                          {polishRunning && selectedShotIdx === selectedShotIdx ? "精修中……" : `⚡ 仅精修此镜（第 ${selectedShotIdx + 1} 镜）`}
                        </button>
                      </div>
                    </div>

                    <div className="shot-inspector-grid">
                      <div className="shot-inspect-col">
                        <label>原始分镜（输入源）</label>
                        <pre>{currentShots[selectedShotIdx] || "（无内容）"}</pre>
                      </div>
                      <div className={`shot-inspect-col ${polishedShots[selectedShotIdx] ? "polished" : "empty"}`}>
                        <div className="shot-col-head">
                          <label>精修后分镜（导演视听描述）</label>
                          {polishedShots[selectedShotIdx] && (
                            <button
                              type="button"
                              className="polish-copy-btn"
                              onClick={() => {
                                navigator.clipboard?.writeText(polishedShots[selectedShotIdx].text);
                                alert(`已复制第 ${selectedShotIdx + 1} 镜精修分镜！`);
                              }}
                            >
                              复制此镜
                            </button>
                          )}
                        </div>
                        {polishedShots[selectedShotIdx] ? (
                          <pre>{polishedShots[selectedShotIdx].text}</pre>
                        ) : (
                          <div className="shot-unpolished-tip">
                            <p>本镜头尚未精修</p>
                            <span>点击上方「⚡ 仅精修此镜」，5~10 秒内即可完成空间·表情去修辞·光影音效升维。</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {polishedShots[selectedShotIdx]?.analysis && (
                      <details open className="polish-details" style={{ marginTop: "10px" }}>
                        <summary>
                          <span>🧠 第 {selectedShotIdx + 1} 镜诊断与推演分析（空间·去修辞生理化·光影音效）</span>
                          <i>{(polishedShots[selectedShotIdx].durationMs / 1000).toFixed(1)}s</i>
                        </summary>
                        <div className="polish-detail-body">
                          <pre>{polishedShots[selectedShotIdx].analysis}</pre>
                        </div>
                      </details>
                    )}
                  </div>
                )}

                {/* Merged Full Storyboard View */}
                <details className="polish-details highlight" style={{ marginTop: "14px" }}>
                  <summary>
                    <span>📑 全片分镜汇总（已合并 {Object.keys(polishedShots).length} 镜精修）</span>
                    <button
                      type="button"
                      className="polish-copy-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard?.writeText(fullMergedStoryboard);
                        alert("已复制全片最新分镜（含精修成果）！");
                      }}
                    >
                      复制全片分镜
                    </button>
                  </summary>
                  <div className="polish-detail-body">
                    <pre>{fullMergedStoryboard}</pre>
                  </div>
                </details>
              </div>

              <details>
                <summary>模型原始输入与输出</summary>
                <pre>{selectedResult.rawInput}\n\n—— 原始输出 ——\n\n{selectedResult.rawOutput}</pre>
              </details>
              <div className="result-review">
                <select value={selectedResult.verdict} onChange={(event) => review({verdict: event.target.value as TestResult["verdict"]})}>
                  <option>未评价</option>
                  <option>通过</option>
                  <option>需修改</option>
                </select>
                <label>
                  评分 <input type="number" min="0" max="5" step="1" value={selectedResult.rating} onChange={(event) => review({rating: Number(event.target.value)})} />
                </label>
                <textarea
                  value={selectedResult.note}
                  onChange={(event) => review({note: event.target.value})}
                  placeholder="记录优点、问题与下一版修改方向"
                />
              </div>
            </>
          ) : (
            <div className="lab-empty">选择版本和剧本，运行后在这里留下可比较的测试记录。</div>
          )}
        </section>
      </section>
    </>
  );
}

export default function FewshotTestPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(t);
  }, []);

  return (
    <main className="lab-page">
      {mounted ? <Lab /> : (
        <>
          <header>
            <div>
              <Link href="/">← 返回工作台</Link>
              <h1>Few-shot 版本实验台</h1>
            </div>
            <nav>
              <div className="deepseek-model-toggle"><button type="button" className="active">...</button></div>
              <Link href="/node-test">节点测试</Link>
              <Link href="/debug">调试日志</Link>
              <span>正在加载实验台...</span>
            </nav>
          </header>
          <div className="lab-empty" style={{height: "100%", display: "flex", alignItems: "center", justifyContent: "center", gridColumn: "1 / -1"}}>正在加载实验台...</div>
        </>
      )}
    </main>
  );
}
