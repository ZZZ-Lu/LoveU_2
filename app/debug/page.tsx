"use client";

import Link from "next/link";
import {useEffect, useState} from "react";

type DebugRound = {index: number; sentenceIndex: number; reactStep: number; scriptUnit: string; durationMs: number; rawModelInput: string; rawModelOutput: string; workingNote: string; action: string; actionInput: unknown; observation: unknown; workspaceAfter: unknown; imaginationRawInput?: string; imaginationRawOutput?: string};
type DebugRun = {id: string; startedAt: number; status: "running" | "completed" | "failed"; model: string; thinkingMode: string; segmentText: string; rounds: DebugRound[]; finalRawModelInput?: string; finalOutput?: string; error?: string};
const nodeName: Record<string, string> = {director_draft: "Few-shot导演初稿", director_v14_5: "V14-5 分镜设计", director_v7_2_performance: "V7-2 表演设计", director_fusion: "分镜与表演融合", director_v14_5_invalid: "V14-5 分镜设计（解析失败）", director_v7_2_performance_invalid: "V7-2 表演设计（解析失败）", director_fusion_invalid: "分镜与表演融合（解析失败）", review_fidelity: "剧本忠实度验收", review_rhythm: "镜头节奏验收", review_visual: "画面连续性验收", director_revision: "Few-shot导演修改", review_final: "最终复验", director_selection_postprocess: "后置分镜提取", director_selection_out_of_bounds: "初稿越界重试", spatial_correction: "空间矛盾纠正", spatial_correction_fallback: "空间矛盾纠正（回退）", spatial_completion: "空间信息完善", spatial_completion_fallback: "空间信息完善（回退）"};

export default function DebugPage() {
  const [runs, setRuns] = useState<DebugRun[]>([]); const [selectedId, setSelectedId] = useState("");
  useEffect(() => {let active = true; const load = async () => {try {const response = await fetch("/api/deepseek/debug", {cache: "no-store"}); const data = await response.json(); if (!active) return; setRuns(data.runs || []); setSelectedId((current) => current || data.runs?.[0]?.id || "");} catch {}}; load(); const timer = setInterval(load, 1200); return () => {active = false; clearInterval(timer);};}, []);
  const selected = runs.find((run) => run.id === selectedId) || runs[0];
  const exportWorkingNotes = () => {
    if (!selected?.rounds.length) return;
    const content = selected.rounds.filter((step) => step.workingNote).map((step) => [
      `${nodeName[step.action] || step.action} · 意识流`,
      step.workingNote || "（无判断内容）",
    ].join("\r\n")).join("\r\n\r\n");
    const blob = new Blob(["\uFEFF", content], {type: "text/plain;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const timestamp = new Date(selected.startedAt).toISOString().replace(/[:.]/g, "-");
    link.href = url;
    link.download = `imagine_scene意识流-${timestamp}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return <main className="debug-page">
    <header><div><Link href="/">← 返回工作台</Link><h1>导演与验收日志</h1></div><div className="debug-actions"><span>每 1.2 秒自动刷新</span><button disabled={!selected?.rounds.length} onClick={exportWorkingNotes}>导出意识流</button><button onClick={async () => {await fetch("/api/deepseek/debug", {method: "DELETE"}); setRuns([]); setSelectedId("");}}>清空日志</button></div></header>
    <section className="debug-layout">
      <aside><p>最近生成</p>{runs.length === 0 && <span>暂无日志，请先生成一次提示词。</span>}{runs.map((run) => <button className={run.id === selected?.id ? "active" : ""} key={run.id} onClick={() => setSelectedId(run.id)}><b>{new Date(run.startedAt).toLocaleTimeString("zh-CN")}</b><span>{run.status === "running" ? "进行中" : run.status === "completed" ? "已完成" : "失败"} · {run.rounds.length}节点</span></button>)}</aside>
      <article>{!selected ? <div className="debug-empty">生成后，这里会显示导演、验收和修改节点的原始输入输出。</div> : <>
        <section className="debug-summary"><h2>{selected.model}</h2><p>推理模式：{selected.thinkingMode}　状态：{selected.status}　节点数：{selected.rounds.length}</p><h3>原始片段</h3><pre>{selected.segmentText}</pre></section>
        {selected.rounds.map((step) => <section className="debug-round" key={`${selected.id}-${step.index}`}>
          <div className="debug-round-head"><h2>{nodeName[step.action] || step.action}</h2><span>{(step.durationMs / 1000).toFixed(1)} 秒</span></div>
          <h3>模型原始输入</h3><pre>{step.rawModelInput}</pre>
          <h3>模型原始输出</h3><pre>{step.rawModelOutput}</pre>
          {(step.imaginationRawOutput || step.workingNote) && <><h3>意识流画面推演</h3><pre>{step.imaginationRawOutput || step.workingNote}</pre></>}
          {!step.workingNote && <><h3>验收结论</h3><pre>{JSON.stringify(step.observation, null, 2)}</pre></>}
        </section>)}
        {(selected.finalRawModelInput || selected.finalOutput) && <section className="debug-final"><h2>提示词成稿</h2><h3>模型原始输入</h3><pre>{selected.finalRawModelInput || "准备中……"}</pre><h3>模型原始输出</h3><pre>{selected.finalOutput || "正在返回……"}</pre></section>}
        {selected.error && <section className="debug-error">{selected.error}</section>}
      </>}</article>
    </section>
  </main>;
}
