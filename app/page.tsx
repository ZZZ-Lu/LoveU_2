/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import {useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent} from "react";
import DeepSeekModelToggle from "./components/deepseek-model-toggle";

type Segment = {
  id: string;
  start: number;
  end: number;
  title: string;
  confirmed: boolean;
  prompt: string;
  invalid?: boolean;
  modified?: boolean;
  generatedAt?: number;
  contextSummary?: string;
  beforeContextSummary?: string;
  afterContextSummary?: string;
  contextSummaryUpdatedAt?: number;
  continuityState?: string;
  continuityUpdatedAt?: number;
  shotDurations?: ShotDurationEstimate[];
  shotDurationPromptHash?: string;
};

type ShotDurationEstimate = {shot: number; seconds: number};

type SegmentMenuMode = "new" | "actions" | "generate" | "prompt-actions" | "rename" | "adjust" | "delete";
type GenerateMode = "replace" | "improve" | "selection";
type PromptComment = {
  segmentId: string;
  start: number;
  end: number;
  basePrompt: string;
  original: string;
  instruction: string;
  status: "draft" | "generating" | "review";
  proposal?: string;
  previewPrompt?: string;
  previewStart?: number;
  previewEnd?: number;
  structural?: boolean;
  warning?: string;
  error?: string;
};

type CommentAnchor = {left: number; top: number; above: boolean};

const measureSelectionAnchor = (textarea: HTMLTextAreaElement, position: number): CommentAnchor => {
  const style = window.getComputedStyle(textarea);
  const mirror = document.createElement("div");
  const marker = document.createElement("span");
  const rect = textarea.getBoundingClientRect();
  Object.assign(mirror.style, {
    position: "fixed",
    visibility: "hidden",
    pointerEvents: "none",
    left: `${rect.left}px`,
    top: `${rect.top - textarea.scrollTop}px`,
    width: `${rect.width}px`,
    padding: style.padding,
    border: style.border,
    font: style.font,
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing,
    whiteSpace: "pre-wrap",
    overflowWrap: "break-word",
    boxSizing: "border-box",
  });
  mirror.textContent = textarea.value.slice(0, position);
  marker.textContent = "\u200b";
  mirror.appendChild(marker);
  document.body.appendChild(mirror);
  const markerRect = marker.getBoundingClientRect();
  mirror.remove();
  const panelWidth = 390;
  const left = Math.max(16, Math.min(markerRect.left, window.innerWidth - panelWidth - 16));
  const above = markerRect.bottom + 250 > window.innerHeight;
  return {left, top: above ? markerRect.top - 10 : markerRect.bottom + 10, above};
};

const measurePointerAnchor = (x: number, y: number): CommentAnchor => {
  const panelWidth = 390;
  const estimatedPanelHeight = 250;
  const left = Math.max(16, Math.min(x + 12, window.innerWidth - panelWidth - 16));
  const above = y + estimatedPanelHeight + 16 > window.innerHeight;
  return {left, top: above ? y - 10 : y + 12, above};
};

const measureTextareaTextTop = (textarea: HTMLTextAreaElement, text: string, position: number) => {
  const style = window.getComputedStyle(textarea);
  const mirror = document.createElement("div");
  const marker = document.createElement("span");
  Object.assign(mirror.style, {
    position: "fixed",
    visibility: "hidden",
    pointerEvents: "none",
    left: "0",
    top: "0",
    width: `${textarea.clientWidth}px`,
    height: "auto",
    overflow: "hidden",
    boxSizing: "border-box",
    padding: style.padding,
    font: style.font,
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    fontStyle: style.fontStyle,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing,
    textTransform: style.textTransform,
    textIndent: style.textIndent,
    textAlign: style.textAlign,
    whiteSpace: "pre-wrap",
    overflowWrap: style.overflowWrap,
    wordBreak: style.wordBreak,
    tabSize: style.tabSize,
  });
  mirror.textContent = text.slice(0, position);
  marker.textContent = "\u200b";
  mirror.appendChild(marker);
  document.body.appendChild(mirror);
  const top = marker.getBoundingClientRect().top - mirror.getBoundingClientRect().top;
  mirror.remove();
  return top;
};

const measureTextareaTextTops = (
  textarea: HTMLTextAreaElement,
  text: string,
  positions: number[],
) => {
  const style = window.getComputedStyle(textarea);
  const mirror = document.createElement("div");
  const markers = new Map<number, HTMLSpanElement>();
  Object.assign(mirror.style, {
    position: "fixed",
    visibility: "hidden",
    pointerEvents: "none",
    left: "0",
    top: "0",
    width: `${textarea.clientWidth}px`,
    height: "auto",
    overflow: "hidden",
    boxSizing: "border-box",
    padding: style.padding,
    font: style.font,
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    fontStyle: style.fontStyle,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing,
    textTransform: style.textTransform,
    textIndent: style.textIndent,
    textAlign: style.textAlign,
    whiteSpace: "pre-wrap",
    overflowWrap: style.overflowWrap,
    wordBreak: style.wordBreak,
    tabSize: style.tabSize,
  });

  const orderedPositions = Array.from(new Set(
    positions.map((position) => Math.max(0, Math.min(text.length, position))),
  )).sort((a, b) => a - b);
  let cursor = 0;
  orderedPositions.forEach((position) => {
    if (position > cursor) mirror.appendChild(document.createTextNode(text.slice(cursor, position)));
    const marker = document.createElement("span");
    marker.textContent = "\u200b";
    mirror.appendChild(marker);
    markers.set(position, marker);
    cursor = position;
  });
  if (cursor < text.length) mirror.appendChild(document.createTextNode(text.slice(cursor)));

  document.body.appendChild(mirror);
  const mirrorTop = mirror.getBoundingClientRect().top;
  const tops = new Map<number, number>();
  markers.forEach((marker, position) => {
    tops.set(position, marker.getBoundingClientRect().top - mirrorTop);
  });
  mirror.remove();
  return tops;
};

const fingerprintText = (text: string) => {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${text.length}-${(hash >>> 0).toString(36)}`;
};

const requestsShotExpansion = (instruction: string) => {
  const hasShotTerm = /分镜|镜头/.test(instruction);
  const hasExpansionVerb = /添加|新增|增加|插入|追加|补充|再加|加上|拆分|拆成/.test(instruction);
  return hasShotTerm && hasExpansionVerb;
};

const buildRenumberedStructuralPreview = (
  basePrompt: string,
  start: number,
  end: number,
  replacement: string,
) => {
  let shot = 0;
  const renumber = (text: string) => text.replace(
    /【\s*(?:(?:新增)?分镜|镜头)\s*[0-9一二三四五六七八九十〇零a-zA-Z-]*\s*】/g,
    () => `【分镜${++shot}】`,
  );
  const before = renumber(basePrompt.slice(0, start));
  const proposal = renumber(replacement);
  const after = renumber(basePrompt.slice(end));
  return {
    prompt: before + proposal + after,
    proposal,
    start: before.length,
    end: before.length + proposal.length,
  };
};

type PromptVersionOption = {value: string; label: string; note: string; template?: string; custom?: boolean};
const IS_PRODUCTION_DEPLOYMENT = process.env.NODE_ENV === "production";
type SavedPromptVersion = {id: string; name: string; note: string; template: string; createdAt: number; builtIn?: boolean};

type Episode = {
  id: string;
  title: string;
  script: string;
  segments: Segment[];
  scriptScrollTop?: number;
  updatedAt: number;
};

type PromptLayoutEntry = {
  segment: Segment;
  start: number;
  end: number;
};

const buildPromptLayout = (segments: Segment[]) => {
  const entries: PromptLayoutEntry[] = [];
  let text = "";
  segments
    .slice()
    .sort((a, b) => a.start - b.start)
    .forEach((segment, index) => {
      if (index > 0) text += "\n\n";
      const start = text.length;
      text += segment.prompt;
      entries.push({segment, start, end: text.length});
    });
  return {text, entries};
};

const seedScript = `21-1 沈府 沈淮青卧房 夜 内
人物：沈淮青 沈母 林菀儿
沈淮青（被打懵了）：娘？！
沈母（厉声）：我看你是昏了头！那女子是祸水，你还要和她私奔？！留着她，沈家就要大祸临头！你心心念念的仕途就要毁在她手里！`;

const seedPrompt = `【分镜1】
近景，快速推镜，画面左侧是【沈淮青】坐在床头，身上盖着被子，左手捂左脸，一脸不可置信的表情看着右侧，右侧背景是背对镜头失焦的【沈母】半边身体
【沈淮青】不解地喊道：娘？！

【分镜2】
近景，晃动镜头，画面左侧是失焦的坐在床头背对镜头的【沈淮青】，画面右侧是【沈母】生气地伸出食指指着画面左侧的【沈淮青】大骂，【沈母】（厉声）骂道：我看你是昏了头！

【分镜3】
特写镜头，开始是【沈母】转眼看向画面右侧，张嘴说到：“那女子是祸水”【眼神看向右侧】，镜头快速横移到右侧【林菀儿】脸部表情特写，焦急点头，【林菀儿】的脸部朝向画面左侧

【分镜4】
近景，荷兰角倾斜晃动镜头，画面左侧是失焦的坐在床头的【沈淮青】，画面右侧是【沈母】生气地伸出食指指着画面左侧的【沈淮青】大骂，【沈母】（厉声）骂道：你还要和她私奔？！

【分镜5】
荷兰角倾斜晃动镜头，近景上半身低位仰拍，人物面向画面左侧，【沈母】伸直右臂指向画面左侧边缘，大骂：“留着她”

【分镜6】
荷兰角倾斜，脸部特写俯拍环绕镜头，人物面向画面左侧，【沈母】继续骂：“沈家就要大祸临头！”

【分镜7】
近景缓慢环绕镜头，画面左侧是【沈淮青】坐在床头，身上盖着被子，左手捂左脸，一脸不可置信的表情看着右侧，皱眉，右侧背景是背对镜头失焦的【沈母】半边身体，画面右侧伸出手臂指着【沈淮青】，【沈母】继续骂道：“你心心念念的仕途”

【分镜8】
荷兰角倾斜晃动镜头，嘴部大特写仰拍，人物面向画面左侧，【沈母】大骂：“就要毁在她手里！”

【分镜9】
镜头推进，【林菀儿】脸部表情特写，身体前倾，焦急点头的瞬间，眼中有泪光，朝向画面左侧`;

const seedStart = seedScript.indexOf("沈淮青（被打懵了）");

const seedEpisode: Episode = {
  id: "ep21",
  title: "第21集 · 沈府夜话",
  script: seedScript,
  segments: [
    {
      id: "seg1",
      start: seedStart,
      end: seedScript.length,
      title: "片段 01",
      confirmed: true,
      prompt: seedPrompt,
    },
  ],
  updatedAt: Date.now(),
};

const openDB = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("short-drama-studio", 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("episodes")) {
        request.result.createObjectStore("episodes", {keyPath: "id"});
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const loadEpisodes = async () => {
  const db = await openDB();
  return new Promise<Episode[]>((resolve, reject) => {
    const request = db.transaction("episodes").objectStore("episodes").getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const saveEpisodes = async (episodes: Episode[]) => {
  const db = await openDB();
  const tx = db.transaction("episodes", "readwrite");
  const store = tx.objectStore("episodes");
  store.clear();
  episodes.forEach((episode) => store.put(episode));
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

const loadSavedPromptVersions = () => new Promise<SavedPromptVersion[]>((resolve) => {
  const request = indexedDB.open("fewshot-test-lab", 1);
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains("versions")) request.result.createObjectStore("versions", {keyPath: "id"});
    if (!request.result.objectStoreNames.contains("results")) request.result.createObjectStore("results", {keyPath: "id"});
  };
  request.onsuccess = () => {
    if (!request.result.objectStoreNames.contains("versions")) return resolve([]);
    const get = request.result.transaction("versions").objectStore("versions").getAll();
    get.onsuccess = () => resolve((get.result || []).filter((item) => !item.builtIn));
    get.onerror = () => resolve([]);
  };
  request.onerror = () => resolve([]);
});

export default function Home() {
  const [episodes, setEpisodes] = useState<Episode[]>([seedEpisode]);
  const [activeId, setActiveId] = useState(seedEpisode.id);
  const [selectedId, setSelectedId] = useState("seg1");
  const [draftRange, setDraftRange] = useState<{start: number; end: number} | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [renamingEpisode, setRenamingEpisode] = useState(false);
  const [episodeTitleDraft, setEpisodeTitleDraft] = useState("");
  const [namingEpisodeId, setNamingEpisodeId] = useState("");
  const [ready, setReady] = useState(false);
  const [copiedSegmentId, setCopiedSegmentId] = useState("");
  const [undoStacks, setUndoStacks] = useState<Record<string, Episode[]>>({});
  const [menu, setMenu] = useState<{x: number; y: number; mode: SegmentMenuMode} | null>(null);
  const [renaming, setRenaming] = useState("");
  const [adjustingId, setAdjustingId] = useState("");
  const [labelTops, setLabelTops] = useState<Record<string, number>>({});
  const [generatingId, setGeneratingId] = useState("");
  const [completedGenerationId, setCompletedGenerationId] = useState("");
  const [generationStage, setGenerationStage] = useState("");
  const [model, setModel] = useState<"deepseek-v4-flash" | "deepseek-v4-pro" | "kimi-k3-high" | "kimi-k3-max">("deepseek-v4-pro");
  useEffect(() => {
    const saved = document.cookie.split("; ").find(r => r.startsWith("loveu_ai_model="))?.split("=")[1];
    if (saved && ["deepseek-v4-flash", "deepseek-v4-pro", "kimi-k3-high", "kimi-k3-max"].includes(saved)) {
      setModel(saved as "deepseek-v4-flash" | "deepseek-v4-pro" | "kimi-k3-high" | "kimi-k3-max");
    }
    const handler = (e: Event) => setModel((e as CustomEvent).detail);
    window.addEventListener("loveu_ai_model_changed", handler);
    return () => window.removeEventListener("loveu_ai_model_changed", handler);
  }, []);
  const [promptVersion, setPromptVersion] = useState("v4");
  const [promptVersionOptions, setPromptVersionOptions] = useState<PromptVersionOption[]>([]);
  const [reviewEnabled, setReviewEnabled] = useState(false);
  const [scriptMode, setScriptMode] = useState(false);
  const [promptSelection, setPromptSelection] = useState<{start: number; end: number} | null>(null);
  const [promptComment, setPromptComment] = useState<PromptComment | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentAnchor, setCommentAnchor] = useState<CommentAnchor | null>(null);
  const [commentDragging, setCommentDragging] = useState(false);
  const [promptSegmentTops, setPromptSegmentTops] = useState<Record<string, number>>({});
  const [shotDurationLabelTops, setShotDurationLabelTops] = useState<Record<string, Array<{shot: number; top: number}>>>({});
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const scriptDirectoryMenuRef = useRef<HTMLDivElement>(null);
  const promptPaneRef = useRef<HTMLDivElement>(null);
  const promptDocumentRef = useRef<HTMLTextAreaElement>(null);
  const promptCommentPanelRef = useRef<HTMLElement | null>(null);
  const commentDragRef = useRef<{pointerId: number; offsetX: number; offsetY: number} | null>(null);
  const generationAbort = useRef<AbortController | null>(null);
  const scrollSaveTimer = useRef<number | null>(null);
  const segmentMarkRefs = useRef(new Map<string, HTMLElement>());
  const titleRequestsRef = useRef(new Set<string>());
  const shotDurationTimerRef = useRef<number | null>(null);

  const active = useMemo(
    () => episodes.find((episode) => episode.id === activeId) || episodes[0],
    [activeId, episodes],
  );
  const selected = active?.segments.find((segment) => segment.id === selectedId) || null;
  const undoCount = undoStacks[activeId]?.length || 0;
  const promptLayout = (() => buildPromptLayout(active?.segments || []))();
  const promptDisplayText = useMemo(() => {
    if (!promptComment || promptComment.proposal === undefined) return promptLayout.text;
    const entry = promptLayout.entries.find((item) => item.segment.id === promptComment.segmentId);
    if (!entry) return promptLayout.text;
    if (promptComment.previewPrompt !== undefined) {
      return (
        promptLayout.text.slice(0, entry.start) +
        promptComment.previewPrompt +
        promptLayout.text.slice(entry.end)
      );
    }
    return (
      promptLayout.text.slice(0, entry.start + promptComment.start) +
      promptComment.proposal +
      promptLayout.text.slice(entry.start + promptComment.end)
    );
  }, [promptComment, promptLayout]);
  const promptMeasurementLayout = (() => {
    if (!promptComment?.previewPrompt) return promptLayout;
    return buildPromptLayout((active?.segments || []).map((segment) =>
      segment.id === promptComment.segmentId
        ? {...segment, prompt: promptComment.previewPrompt || segment.prompt}
        : segment,
    ));
  })();
  const commentRunning = promptComment?.status === "generating";
  const scriptDirectory = (() => {
    if (!active?.script) return [];
    const entries: Array<{label: string; index: number}> = [];
    const pattern = /^[ \t]*第\s*([0-9０-９一二三四五六七八九十百千两〇零]+)\s*集[ \t]*\r?$/gm;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(active.script)) !== null) {
      entries.push({label: `第${match[1]}集`, index: match.index + match[0].indexOf("第")});
    }
    return entries;
  })();

  useEffect(() => {
    const loadPromptVersions = async () => {
      try {
        const [catalog, savedVersions] = await Promise.all([
          fetch("/api/deepseek").then((response) => response.json() as Promise<{current: string; options: PromptVersionOption[]}>),
          loadSavedPromptVersions(),
        ]);
        const builtIns = Array.isArray(catalog.options) ? catalog.options : [];
        const custom = savedVersions
          .sort((a, b) => b.createdAt - a.createdAt)
          .map((item) => ({value: item.id, label: `${item.name} · 测试版`, note: item.note, template: item.template, custom: true}));
        const options = [...builtIns, ...custom];
        const saved = window.localStorage.getItem("short-drama-prompt-version");
        const next = saved && options.some((item) => item.value === saved) ? saved : catalog.current;
        setPromptVersionOptions(options);
        if (next) setPromptVersion(next);
      } catch {
        setPromptVersionOptions([]);
      }
    };
    void loadPromptVersions();
    window.addEventListener("focus", loadPromptVersions);
    return () => window.removeEventListener("focus", loadPromptVersions);
  }, []);

  useEffect(() => {
    const clearCollapsedPromptSelection = () => {
      const textarea = promptDocumentRef.current;
      if (
        !textarea ||
        document.activeElement !== textarea ||
        textarea.selectionStart === textarea.selectionEnd
      ) setPromptSelection(null);
    };
    document.addEventListener("selectionchange", clearCollapsedPromptSelection);
    return () => document.removeEventListener("selectionchange", clearCollapsedPromptSelection);
  }, []);

  const changePromptVersion = (version: string) => {
    setPromptVersion(version);
    window.localStorage.setItem("short-drama-prompt-version", version);
  };

  useEffect(() => {
    loadEpisodes()
      .then((items) => {
        if (items.length) {
          const normalized = items.map((item, episodeIndex) => {
            const script = typeof item.script === "string" ? item.script : "";
            const rawSegments = Array.isArray(item.segments) ? item.segments : [];
            const segments = rawSegments
              .filter((segment) => segment && typeof segment === "object")
              .map((segment, segmentIndex) => ({
                id: typeof segment.id === "string" ? segment.id : `seg-${Date.now()}-${segmentIndex}`,
                start: Math.max(0, Math.min(Number(segment.start) || 0, script.length)),
                end: Math.max(0, Math.min(Number(segment.end) || 0, script.length)),
                title: typeof segment.title === "string" ? segment.title : `片段 ${String(segmentIndex + 1).padStart(2, "0")}`,
                confirmed: Boolean(segment.confirmed),
                prompt: typeof segment.prompt === "string" ? segment.prompt : "",
                invalid: Boolean(segment.invalid),
                modified: Boolean(segment.modified),
                generatedAt: Number(segment.generatedAt) || undefined,
                contextSummary: typeof segment.contextSummary === "string" ? segment.contextSummary : "",
                beforeContextSummary: typeof segment.beforeContextSummary === "string" ? segment.beforeContextSummary : "",
                afterContextSummary: typeof segment.afterContextSummary === "string" ? segment.afterContextSummary : "",
                contextSummaryUpdatedAt: Number(segment.contextSummaryUpdatedAt) || undefined,
                continuityState: typeof segment.continuityState === "string" ? segment.continuityState : "",
                continuityUpdatedAt: Number(segment.continuityUpdatedAt) || undefined,
                shotDurations: Array.isArray(segment.shotDurations)
                  ? segment.shotDurations
                      .map((item) => ({shot: Number(item?.shot), seconds: Number(item?.seconds)}))
                      .filter((item) => Number.isInteger(item.shot) && item.shot > 0 && Number.isFinite(item.seconds) && item.seconds > 0)
                  : [],
                shotDurationPromptHash: typeof segment.shotDurationPromptHash === "string" ? segment.shotDurationPromptHash : "",
              }))
              .sort((a, b) => a.start - b.start);
            return {
              id: typeof item.id === "string" ? item.id : `ep-${Date.now()}-${episodeIndex}`,
              title: typeof item.title === "string" ? item.title : `未命名剧本 ${episodeIndex + 1}`,
              script,
              segments,
              scriptScrollTop: Math.max(0, Number(item.scriptScrollTop) || 0),
              updatedAt: Number(item.updatedAt) || Date.now(),
            } satisfies Episode;
          });
          setEpisodes(normalized);
          const savedActiveId = window.localStorage.getItem("short-drama-active-script");
          const restoredActive = normalized.find((item) => item.id === savedActiveId) || normalized[0];
          const savedSegmentId = window.localStorage.getItem(`short-drama-selected-segment:${restoredActive.id}`);
          const restoredSegment = restoredActive.segments.find((segment) => segment.id === savedSegmentId) || restoredActive.segments[0];
          setActiveId(restoredActive.id);
          setSelectedId(restoredSegment?.id || "");
        } else {
          saveEpisodes([seedEpisode]);
        }
      })
      .catch(() => {
        setEpisodes([seedEpisode]);
        setActiveId(seedEpisode.id);
        setSelectedId(seedEpisode.segments[0]?.id || "");
      })
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => saveEpisodes(episodes), 900);
    return () => clearTimeout(timer);
  }, [episodes, ready]);

  useEffect(() => {
    if (!ready || !activeId) return;
    window.localStorage.setItem("short-drama-active-script", activeId);
  }, [activeId, ready]);

  useEffect(() => {
    if (!ready || !activeId || !selectedId) return;
    window.localStorage.setItem(`short-drama-selected-segment:${activeId}`, selectedId);
  }, [activeId, selectedId, ready]);

  useEffect(() => {
    if (!ready || !active || !/^未命名(?:单集|剧本)\s*\d*$/.test(active.title)) return;
    const script = active.script.trim();
    if (["在这里输入剧本……", "在这里粘贴整部剧本……"].includes(script) || script.length < 20 || titleRequestsRef.current.has(active.id)) return;

    const episodeId = active.id;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      titleRequestsRef.current.add(episodeId);
      setNamingEpisodeId(episodeId);
      try {
        const response = await fetch("/api/deepseek/episode-title", {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({script}),
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "自动命名失败");
        setEpisodes((all) => all.map((episode) =>
          episode.id === episodeId && /^未命名(?:单集|剧本)\s*\d*$/.test(episode.title)
            ? {...episode, title: data.title, updatedAt: Date.now()}
            : episode,
        ));
      } catch {
        titleRequestsRef.current.delete(episodeId);
      } finally {
        setNamingEpisodeId((current) => current === episodeId ? "" : current);
      }
    }, 1400);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, active?.script, active?.title, ready]);

  useLayoutEffect(() => {
    const measure = () => {
      const next: Record<string, number> = {};
      active.segments.forEach((segment) => {
        const mark = segmentMarkRefs.current.get(segment.id);
        if (mark) next[segment.id] = mark.offsetTop;
      });
      setLabelTops(next);
    };
    const frame = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
    };
  }, [active.script, active.segments]);

  useLayoutEffect(() => {
    if (!ready || !editorRef.current) return;
    const editor = editorRef.current;
    const locallySavedRaw = window.localStorage.getItem(`short-drama-script-scroll:${active.id}`);
    const locallySaved = locallySavedRaw === null ? NaN : Number(locallySavedRaw);
    const top = Math.max(0, Number.isFinite(locallySaved) ? locallySaved : active.scriptScrollTop || 0);
    editor.scrollTop = top;
    const highlight = editor.previousElementSibling as HTMLDivElement | null;
    if (highlight) highlight.scrollTop = top;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active.id, ready]);

  useLayoutEffect(() => {
    if (!ready || !promptPaneRef.current) return;
    const top = Math.max(0, Number(window.localStorage.getItem(`short-drama-prompt-scroll:${active.id}`)) || 0);
    promptPaneRef.current.scrollTop = top;
  }, [active.id, ready]);

  useLayoutEffect(() => {
    if (!directoryOpen || !scriptDirectoryMenuRef.current) return;
    const savedTop = Math.max(
      0,
      Number(window.localStorage.getItem(`short-drama-directory-scroll:${active.id}`)) || 0,
    );
    scriptDirectoryMenuRef.current.scrollTop = savedTop;
  }, [active.id, directoryOpen]);

  useEffect(() => {
    if (shotDurationTimerRef.current !== null) {
      window.clearTimeout(shotDurationTimerRef.current);
      shotDurationTimerRef.current = null;
    }
    if (
      !ready ||
      !selected?.prompt.trim() ||
      generatingId === selected.id ||
      promptComment?.segmentId === selected.id
    ) return;

    const prompt = selected.prompt;
    const promptHash = fingerprintText(prompt);
    if (selected.shotDurationPromptHash === promptHash && selected.shotDurations?.length) return;
    const episodeId = active.id;
    const segmentId = selected.id;

    shotDurationTimerRef.current = window.setTimeout(async () => {
      shotDurationTimerRef.current = null;
      try {
        const response = await fetch("/api/deepseek/shot-durations", {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({prompt}),
        });
        if (!response.ok) return;
        const result = await response.json() as {shots?: ShotDurationEstimate[]};
        const shotDurations = Array.isArray(result.shots)
          ? result.shots.filter((item) =>
              Number.isInteger(item.shot) && item.shot > 0 && Number.isFinite(item.seconds) && item.seconds > 0,
            )
          : [];
        setEpisodes((all) => all.map((episode) => episode.id === episodeId ? {
          ...episode,
          updatedAt: Date.now(),
          segments: episode.segments.map((segment) =>
            segment.id === segmentId && fingerprintText(segment.prompt) === promptHash
              ? {...segment, shotDurations, shotDurationPromptHash: promptHash}
              : segment,
          ),
        } : episode));
      } catch {
        // Keep the previous estimate hidden until the next edit or selection retries it.
      }
    }, 1000);

    return () => {
      if (shotDurationTimerRef.current !== null) {
        window.clearTimeout(shotDurationTimerRef.current);
        shotDurationTimerRef.current = null;
      }
    };
  }, [
    active.id,
    generatingId,
    promptComment?.segmentId,
    ready,
    selected?.id,
    selected?.prompt,
    selected?.shotDurationPromptHash,
    selected?.shotDurations?.length,
  ]);

  useEffect(() => {
    const measure = () => {
      const next: Record<string, Array<{shot: number; top: number}>> = {};
      const segmentTops: Record<string, number> = {};
      const textarea = promptDocumentRef.current;
      if (!textarea) return;
      const requestedPositions: number[] = [];
      const shotPositions: Array<{segmentId: string; shot: number; position: number}> = [];

      promptMeasurementLayout.entries.forEach(({segment, start}) => {
        requestedPositions.push(start);
        if (
          !segment.prompt ||
          promptComment?.segmentId === segment.id ||
          segment.shotDurationPromptHash !== fingerprintText(segment.prompt) ||
          !segment.shotDurations?.length
        ) return;
        const durationByShot = new Map(segment.shotDurations.map((item) => [item.shot, item.seconds]));
        const marker = /【分镜\s*(\d+)\s*】/g;
        let match: RegExpExecArray | null;
        while ((match = marker.exec(segment.prompt)) !== null) {
          const shot = Number(match[1]);
          if (!durationByShot.has(shot)) continue;
          const position = start + match.index;
          requestedPositions.push(position);
          shotPositions.push({segmentId: segment.id, shot, position});
        }
      });

      const measuredTops = measureTextareaTextTops(textarea, promptMeasurementLayout.text, requestedPositions);
      promptMeasurementLayout.entries.forEach(({segment, start}) => {
        segmentTops[segment.id] = measuredTops.get(start) || 0;
      });
      shotPositions.forEach(({segmentId, shot, position}) => {
        const labels = next[segmentId] || [];
        labels.push({shot, top: measuredTops.get(position) || 0});
        next[segmentId] = labels;
      });
      setPromptSegmentTops(segmentTops);
      setShotDurationLabelTops(next);
    };
    let timer = window.setTimeout(measure, 140);
    const handleResize = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(measure, 80);
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", handleResize);
    };
  }, [promptComment?.segmentId, promptMeasurementLayout]);

  useEffect(() => () => {
    if (scrollSaveTimer.current !== null) window.clearTimeout(scrollSaveTimer.current);
    if (shotDurationTimerRef.current !== null) window.clearTimeout(shotDurationTimerRef.current);
  }, []);

  useEffect(() => {
    const closePopoverOnLeftClick = (event: MouseEvent) => {
      if (event.button !== 0) return;
      const target = event.target as Element | null;
      if (!target?.closest(".segment-popover")) setMenu(null);
      if (!target?.closest(".script-directory")) setDirectoryOpen(false);
    };
    window.addEventListener("mousedown", closePopoverOnLeftClick);
    return () => window.removeEventListener("mousedown", closePopoverOnLeftClick);
  }, []);

  const updateEpisode = (patch: Partial<Episode>) => {
    setEpisodes((all) =>
      all.map((episode) =>
        episode.id === activeId ? {...episode, ...patch, updatedAt: Date.now()} : episode,
      ),
    );
  };

  const pushUndo = (previousEpisode: Episode) => {
    setUndoStacks((all) => {
      const stack = all[activeId] || [];
      const snapshot = {...previousEpisode, segments: previousEpisode.segments.map((segment) => ({...segment}))};
      return {...all, [activeId]: [...stack, snapshot].slice(-5)};
    });
  };

  const updateScript = (script: string) => {
    if (script === active.script) return;
    pushUndo(active);
    const oldScript = active.script;
    let prefix = 0;
    while (prefix < oldScript.length && prefix < script.length && oldScript[prefix] === script[prefix]) {
      prefix += 1;
    }
    let suffix = 0;
    while (
      suffix < oldScript.length - prefix &&
      suffix < script.length - prefix &&
      oldScript[oldScript.length - 1 - suffix] === script[script.length - 1 - suffix]
    ) {
      suffix += 1;
    }
    const oldEnd = oldScript.length - suffix;
    const insertedLength = script.length - prefix - suffix;
    const delta = script.length - oldScript.length;
    const mapPosition = (position: number) => {
      if (position <= prefix) return position;
      if (position >= oldEnd) return position + delta;
      return prefix + Math.min(position - prefix, insertedLength);
    };
    const segments = active.segments.map((segment) => {
      const start = mapPosition(segment.start);
      const end = mapPosition(segment.end);
      const touched = prefix < segment.end && oldEnd > segment.start;
      return {
        ...segment,
        start,
        end,
        invalid: end <= start,
        confirmed: touched ? false : segment.confirmed,
        continuityState: touched ? "" : segment.continuityState,
        continuityUpdatedAt: touched ? undefined : segment.continuityUpdatedAt,
      };
    });
    updateEpisode({script, segments});
    setDraftRange(null);
    setMenu(null);
  };

  const undoScript = () => {
    const stack = undoStacks[activeId] || [];
    const previousEpisode = stack.at(-1);
    if (!previousEpisode) return;
    setUndoStacks((all) => ({...all, [activeId]: stack.slice(0, -1)}));
    setEpisodes((all) =>
      all.map((episode) => episode.id === activeId ? {...previousEpisode, updatedAt: Date.now()} : episode),
    );
    setSelectedId(previousEpisode.segments[0]?.id || "");
    setDraftRange(null);
    requestAnimationFrame(() => editorRef.current?.focus());
  };

  const scrollPromptToSegment = (segmentId: string, behavior: ScrollBehavior = "smooth") => {
    const pane = promptPaneRef.current;
    const textarea = promptDocumentRef.current;
    const entryIndex = promptLayout.entries.findIndex((item) => item.segment.id === segmentId);
    const entry = promptLayout.entries[entryIndex];
    if (!pane || !textarea || !entry) return;
    const nextEntry = promptLayout.entries[entryIndex + 1];
    const startTop = measureTextareaTextTop(textarea, promptLayout.text, entry.start);
    const endTop = measureTextareaTextTop(
      textarea,
      promptLayout.text,
      nextEntry?.start ?? promptLayout.text.length,
    );
    const textareaTopInPane =
      textarea.getBoundingClientRect().top -
      pane.getBoundingClientRect().top +
      pane.scrollTop;
    const segmentCenter = textareaTopInPane + (startTop + endTop) / 2;
    pane.scrollTo({
      top: Math.max(0, segmentCenter - pane.clientHeight / 2),
      behavior,
    });
  };

  const selectScriptText = (event?: React.MouseEvent<HTMLTextAreaElement>, showMenu = false) => {
    const editor = editorRef.current;
    if (!editor) return;
    const x = event?.clientX ?? editor.getBoundingClientRect().left + 120;
    const y = event?.clientY ?? editor.getBoundingClientRect().top + 90;
    if (editor.selectionStart === editor.selectionEnd) {
      const position = editor.selectionStart;
      const hit = active.segments.find(
        (segment) => position >= segment.start && position <= segment.end,
      );
      setDraftRange(null);
      if (hit) {
        setSelectedId(hit.id);
        requestAnimationFrame(() => scrollPromptToSegment(hit.id));
        setAdjustingId("");
        setMenu(showMenu ? {x, y, mode: "actions"} : null);
      } else {
        setMenu(null);
      }
      return;
    }
    const start = Math.min(editor.selectionStart, editor.selectionEnd);
    const end = Math.max(editor.selectionStart, editor.selectionEnd);
    const overlaps = active.segments.some(
      (segment) => segment.id !== adjustingId && Math.max(start, segment.start) < Math.min(end, segment.end),
    );
    if (overlaps) {
      setDraftRange(null);
      setMenu(null);
      return;
    }
    setDraftRange({start, end});
    setMenu(showMenu ? {x, y, mode: adjustingId ? "adjust" : "new"} : null);
  };

  const jumpToDirectoryEntry = (index: number) => {
    const editor = editorRef.current;
    if (!editor) return;
    const measuredTop = measureTextareaTextTop(editor, active.script, index);
    const top = Math.max(0, measuredTop - editor.clientHeight * 0.16);
    editor.focus();
    editor.setSelectionRange(index, index);
    editor.scrollTop = top;
    const highlight = editor.previousElementSibling as HTMLDivElement | null;
    const actualTop = editor.scrollTop;
    if (highlight) highlight.scrollTop = actualTop;
    rememberScriptScroll(actualTop);
    setDirectoryOpen(false);
  };

  const selectPromptSegment = (segmentId: string, point?: {x: number; y: number}) => {
    if (segmentId !== selectedId) setPromptSelection(null);
    setSelectedId(segmentId);
    const segment = active.segments.find((item) => item.id === segmentId);
    setMenu(point && segment?.prompt ? {x: point.x, y: point.y, mode: "prompt-actions"} : null);
    requestAnimationFrame(() => {
      const editor = editorRef.current;
      const mark = segmentMarkRefs.current.get(segmentId);
      if (!editor || !mark) return;
      const top = Math.max(0, mark.offsetTop - editor.clientHeight / 2 + mark.offsetHeight / 2);
      editor.scrollTo({top, behavior: "smooth"});
      const highlight = editor.previousElementSibling as HTMLDivElement | null;
      if (highlight) highlight.scrollTo({top, behavior: "smooth"});
      rememberScriptScroll(top);
    });
  };

  const extractSegmentContext = (start: number, end: number) => {
    const isBodyLine = (line: string) => {
      const text = line.trim();
      if (!text) return false;
      if (/^第\s*[一二三四五六七八九十百千万零〇两\d]+\s*集(?:\s|$|[：:])/.test(text)) return false;
      if (/^\d+\s*[-－—]\s*\d+(?:\s|$)/.test(text)) return false;
      if (/^(人物|出场人物|角色|场景|场次|地点|时间|内外景)\s*[：:]/.test(text)) return false;
      return true;
    };
    const beforeText = active.script.slice(0, start).replace(/\r?\n$/, "").split(/\r?\n/).filter(isBodyLine).slice(-5).join("\n");
    const afterText = active.script.slice(end).replace(/^\r?\n/, "").split(/\r?\n/).filter(isBodyLine).slice(0, 5).join("\n");
    return {
      beforeContextSummary: beforeText ? `当前片段前文原文（最近5行正文）：\n${beforeText}` : "当前片段前文原文：无",
      afterContextSummary: afterText ? `当前片段后文原文（最近5行正文）：\n${afterText}` : "当前片段后文原文：无",
    };
  };

  const summarizeSegmentContext = async (segmentId: string, start: number, end: number) => {
    const {beforeContextSummary, afterContextSummary} = extractSegmentContext(start, end);
    const contextSummary = [beforeContextSummary, afterContextSummary].filter(Boolean).join("\n");

    setEpisodes((all) => all.map((episode) => episode.id === activeId ? {
      ...episode,
      updatedAt: Date.now(),
      segments: episode.segments.map((item) => item.id === segmentId ? {
        ...item,
        contextSummary,
        beforeContextSummary,
        afterContextSummary,
        contextSummaryUpdatedAt: Date.now(),
      } : item),
    } : episode));
  };

  const rememberScriptScroll = (scrollTop: number) => {
    const episodeId = activeId;
    window.localStorage.setItem(`short-drama-script-scroll:${episodeId}`, String(scrollTop));
    if (scrollSaveTimer.current !== null) window.clearTimeout(scrollSaveTimer.current);
    scrollSaveTimer.current = window.setTimeout(() => {
      setEpisodes((all) => all.map((episode) =>
        episode.id === episodeId ? {...episode, scriptScrollTop: scrollTop} : episode,
      ));
      scrollSaveTimer.current = null;
    }, 120);
  };

  const addSegment = () => {
    if (!draftRange) return;
    pushUndo(active);
    const nextNumber = active.segments.length + 1;
    const segment: Segment = {
      id: `seg-${Date.now()}`,
      start: draftRange.start,
      end: draftRange.end,
      title: `片段 ${String(nextNumber).padStart(2, "0")}`,
      confirmed: true,
      prompt: "",
      contextSummary: "正在提取前后文原文……",
    };
    updateEpisode({segments: [...active.segments, segment].sort((a, b) => a.start - b.start)});
    setSelectedId(segment.id);
    setDraftRange(null);
    setMenu({x: menu?.x || 0, y: menu?.y || 0, mode: "actions"});
    editorRef.current?.focus();
    void summarizeSegmentContext(segment.id, segment.start, segment.end);
  };

  const saveAdjustedRange = () => {
    if (!draftRange || !adjustingId) return;
    const adjustedId = adjustingId;
    const adjustedRange = {...draftRange};
    pushUndo(active);
    updateEpisode({
      segments: active.segments
        .map((segment) =>
          segment.id === adjustingId
            ? {
                ...segment,
                ...draftRange,
                confirmed: true,
                invalid: false,
                continuityState: "",
                continuityUpdatedAt: undefined,
              }
            : segment,
        )
        .sort((a, b) => a.start - b.start),
    });
    setSelectedId(adjustingId);
    setAdjustingId("");
    setDraftRange(null);
    setMenu(null);
    void summarizeSegmentContext(adjustedId, adjustedRange.start, adjustedRange.end);
  };

  const updateSegment = (patch: Partial<Segment>) => {
    updateEpisode({
      segments: active.segments.map((segment) =>
        segment.id === selectedId ? {...segment, ...patch} : segment,
      ),
    });
  };

  const deleteSegment = () => {
    if (!selected) return;
    pushUndo(active);
    const nextSegments = active.segments.filter((segment) => segment.id !== selected.id);
    updateEpisode({segments: nextSegments});
    setSelectedId(nextSegments[0]?.id || "");
    setMenu(null);
  };

  const countTextCharacters = (text: string) =>
    (text.match(/[\p{L}\p{N}]/gu) || []).length;

  const countDialogueCharacters = (text: string) =>
    text
      .split("\n")
      .map((line) => {
        const separator = line.search(/[：:]/);
        return separator >= 0 ? line.slice(separator + 1) : "";
      })
      .reduce((total, line) => total + countTextCharacters(line), 0);

  const updateSegmentById = (segmentId: string, patch: Partial<Segment>) => {
    setEpisodes((all) =>
      all.map((episode) =>
        episode.id === activeId
          ? {
              ...episode,
              updatedAt: Date.now(),
              segments: episode.segments.map((segment) =>
                segment.id === segmentId ? {...segment, ...patch} : segment,
              ),
            }
          : episode,
      ),
    );
  };

  const updatePromptDocument = (nextText: string, selectionStart?: number) => {
    const previousText = promptLayout.text;
    if (nextText === previousText) return;
    let prefix = 0;
    while (
      prefix < previousText.length &&
      prefix < nextText.length &&
      previousText[prefix] === nextText[prefix]
    ) prefix += 1;
    
    if (selectionStart !== undefined) {
      const lengthDiff = nextText.length - previousText.length;
      if (lengthDiff > 0) {
        prefix = Math.min(prefix, selectionStart - lengthDiff);
      } else {
        prefix = Math.min(prefix, selectionStart);
      }
    }
    let suffix = 0;
    while (
      suffix < previousText.length - prefix &&
      suffix < nextText.length - prefix &&
      previousText[previousText.length - 1 - suffix] === nextText[nextText.length - 1 - suffix]
    ) suffix += 1;

    const previousEnd = previousText.length - suffix;
    const entry = promptLayout.entries.find(({start, end}) =>
      prefix >= start && prefix <= end && previousEnd >= start && previousEnd <= end,
    );
    if (!entry) {
      setGenerationStage("片段边界已保留；请在单个片段内直接编辑");
      requestAnimationFrame(() => {
        const textarea = promptDocumentRef.current;
        if (!textarea) return;
        textarea.value = previousText;
        if (selectionStart !== undefined) {
          const lengthDiff = nextText.length - previousText.length;
          const restoredCaret = lengthDiff > 0 ? selectionStart - lengthDiff : selectionStart;
          textarea.setSelectionRange(restoredCaret, restoredCaret);
        }
      });
      return;
    }

    const inserted = nextText.slice(prefix, nextText.length - suffix);
    const localStart = prefix - entry.start;
    const localEnd = previousEnd - entry.start;
    const nextPrompt =
      entry.segment.prompt.slice(0, localStart) +
      inserted +
      entry.segment.prompt.slice(localEnd);
    updateSegmentById(entry.segment.id, {
      prompt: nextPrompt,
      modified: true,
      continuityState: "",
      continuityUpdatedAt: undefined,
      shotDurations: [],
      shotDurationPromptHash: "",
    });
    setSelectedId(entry.segment.id);
    const nextCaret = prefix + inserted.length;
    requestAnimationFrame(() => {
      const textarea = promptDocumentRef.current;
      if (!textarea) return;
      textarea.focus();
      textarea.setSelectionRange(nextCaret, nextCaret);
    });
  };

  const selectPromptText = (
    event?: React.MouseEvent<HTMLTextAreaElement>,
    showMenu = false,
    syncScript = false,
  ) => {
    const textarea = promptDocumentRef.current;
    if (!textarea) return;
    if (document.activeElement !== textarea && !showMenu) {
      setPromptSelection(null);
      return;
    }
    const start = Math.min(textarea.selectionStart, textarea.selectionEnd);
    const end = Math.max(textarea.selectionStart, textarea.selectionEnd);
    const hit = promptLayout.entries.find((entry) =>
      start === end
        ? start >= entry.start && start <= entry.end
        : Math.max(start, entry.start) < Math.min(end, entry.end),
    );
    if (hit) {
      if (syncScript || showMenu) {
        selectPromptSegment(
          hit.segment.id,
          showMenu
            ? {
                x: event?.clientX ?? textarea.getBoundingClientRect().left + 120,
                y: event?.clientY ?? textarea.getBoundingClientRect().top + 90,
              }
            : undefined,
        );
      } else {
        setSelectedId(hit.segment.id);
      }
    }

    const contained = promptLayout.entries.find((entry) => start >= entry.start && end <= entry.end);
    setPromptSelection(
      contained && end > start
        ? {start: start - contained.start, end: end - contained.start}
        : null,
    );
    if (promptComment && promptComment.segmentId !== contained?.segment.id) {
      setPromptComment(null);
      setCommentDraft("");
    }

    if (showMenu && !hit?.segment.prompt) setMenu(null);
  };

  const extractAndSaveContinuityState = async (
    episodeId: string,
    segmentId: string,
    segmentText: string,
    prompt: string,
  ) => {
    try {
      const response = await fetch("/api/deepseek/continuity", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({segmentText, prompt}),
      });
      if (!response.ok) return null;
      const result = await response.json() as {continuityState?: string};
      const continuityState = typeof result.continuityState === "string" ? result.continuityState.trim() : "";
      setEpisodes((all) => all.map((episode) => episode.id === episodeId ? {
        ...episode,
        updatedAt: Date.now(),
        segments: episode.segments.map((segment) =>
          segment.id === segmentId && segment.prompt === prompt
            ? {...segment, continuityState, continuityUpdatedAt: Date.now()}
            : segment,
        ),
      } : episode));
      return continuityState;
    } catch {
      return null;
    }
  };

  const stopGeneration = () => {
    generationAbort.current?.abort();
    generationAbort.current = null;
    setGeneratingId("");
    setGenerationStage("已停止，当前内容已保存");
  };

  const openPromptComment = () => {
    const textarea = promptDocumentRef.current;
    if (!textarea) return;
    const globalStart = Math.min(textarea.selectionStart, textarea.selectionEnd);
    const globalEnd = Math.max(textarea.selectionStart, textarea.selectionEnd);
    const entry = promptLayout.entries.find(({start, end}) => globalStart >= start && globalEnd <= end);
    if (!entry || globalEnd <= globalStart) {
      setGenerationStage("请先选中需要修改的提示词文字");
      setMenu(null);
      return;
    }
    const start = globalStart - entry.start;
    const end = globalEnd - entry.start;
    const range = {start, end};
    setSelectedId(entry.segment.id);
    setPromptSelection(range);
    setCommentAnchor(menu ? measurePointerAnchor(menu.x, menu.y) : measureSelectionAnchor(textarea, globalEnd));
    setPromptComment({
      segmentId: entry.segment.id,
      start,
      end,
      basePrompt: entry.segment.prompt,
      original: entry.segment.prompt.slice(start, end),
      instruction: "",
      status: "draft",
    });
    setCommentDraft("");
    setMenu(null);
  };

  const openFullPromptComment = () => {
    if (!selected?.prompt) return;
    const range = {start: 0, end: selected.prompt.length};
    const textarea = promptDocumentRef.current;
    const entry = promptLayout.entries.find((item) => item.segment.id === selected.id);
    if (textarea && entry) {
      textarea.focus();
      textarea.setSelectionRange(entry.start, entry.end);
      setCommentAnchor(menu ? measurePointerAnchor(menu.x, menu.y) : measureSelectionAnchor(textarea, entry.end));
    }
    setPromptSelection(range);
    setPromptComment({
      segmentId: selected.id,
      start: range.start,
      end: range.end,
      basePrompt: selected.prompt,
      original: selected.prompt,
      instruction: "",
      status: "draft",
    });
    setCommentDraft("");
    setMenu(null);
  };

  const closePromptComment = () => {
    commentDragRef.current = null;
    setCommentDragging(false);
    setPromptComment(null);
    setCommentDraft("");
    setCommentAnchor(null);
  };

  const startCommentDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest("button")) return;
    const panel = promptCommentPanelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    commentDragRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setCommentAnchor({left: rect.left, top: rect.top, above: false});
    setCommentDragging(true);
    event.preventDefault();
  };

  const movePromptComment = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = commentDragRef.current;
    const panel = promptCommentPanelRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !panel) return;
    const edge = 8;
    const maxLeft = Math.max(edge, window.innerWidth - panel.offsetWidth - edge);
    const maxTop = Math.max(edge, window.innerHeight - panel.offsetHeight - edge);
    setCommentAnchor({
      left: Math.max(edge, Math.min(event.clientX - drag.offsetX, maxLeft)),
      top: Math.max(edge, Math.min(event.clientY - drag.offsetY, maxTop)),
      above: false,
    });
  };

  const stopCommentDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = commentDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    commentDragRef.current = null;
    setCommentDragging(false);
  };

  const runPromptComment = async () => {
    if (!selected || !promptComment || !commentDraft.trim() || commentRunning) return;
    const commentSnapshot = promptComment;
    const segmentSnapshot = selected;
    const instruction = commentDraft.trim();
    const allowShotExpansion = requestsShotExpansion(instruction);
    setPromptComment((current) => current && current.segmentId === commentSnapshot.segmentId && current.start === commentSnapshot.start && current.end === commentSnapshot.end
      ? {
          ...current,
          status: "generating",
          proposal: undefined,
          previewPrompt: undefined,
          previewStart: undefined,
          previewEnd: undefined,
          structural: undefined,
          error: undefined,
          warning: undefined,
        }
      : current);
    setGenerationStage("正在按批注修改选中文字……");
    try {
      const exactContext = extractSegmentContext(segmentSnapshot.start, segmentSnapshot.end);
      const response = await fetch("/api/deepseek", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          segmentText: active.script.slice(segmentSnapshot.start, segmentSnapshot.end),
          beforeContextSummary: exactContext.beforeContextSummary,
          afterContextSummary: exactContext.afterContextSummary,
          existingPrompt: commentSnapshot.basePrompt,
          selectedPromptText: commentSnapshot.original,
          selectionPrefix: commentSnapshot.basePrompt.slice(Math.max(0, commentSnapshot.start - 500), commentSnapshot.start),
          selectionSuffix: commentSnapshot.basePrompt.slice(commentSnapshot.end, commentSnapshot.end + 500),
          editInstruction: instruction,
          allowShotExpansion,
          mode: "selection",
          promptVersion,
          promptTemplate: promptVersionOptions.find((option) => option.value === promptVersion)?.template || "",
          settings: {reviewEnabled: false},
        }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({error: "局部修改失败"}));
        throw new Error(error.error || "局部修改失败");
      }
      if (response.headers.get("content-type")?.includes("text/html")) {
        throw new Error("请求超时或服务暂未就绪，请重试（如是因模型生成过慢导致超时，可尝试缩短文本或关闭验收）");
      }
      let proposal = (await response.text()).trim();
      const structuralPreview = allowShotExpansion
        ? buildRenumberedStructuralPreview(
            commentSnapshot.basePrompt,
            commentSnapshot.start,
            commentSnapshot.end,
            proposal,
          )
        : null;
      if (structuralPreview) proposal = structuralPreview.proposal;
      const encodedWarning = response.headers.get("X-Local-Edit-Warning");
      let warning = "";
      if (encodedWarning) {
        try { warning = decodeURIComponent(encodedWarning); }
        catch { warning = encodedWarning; }
      }
      setPromptComment((current) => current && current.segmentId === commentSnapshot.segmentId && current.start === commentSnapshot.start && current.end === commentSnapshot.end
        ? {
            ...current,
            instruction,
            proposal,
            previewPrompt: structuralPreview?.prompt,
            previewStart: structuralPreview?.start,
            previewEnd: structuralPreview?.end,
            structural: Boolean(structuralPreview),
            warning,
            status: "review",
            error: undefined,
          }
        : current);
      setGenerationStage("局部修改已生成，等待确认");
    } catch (error) {
      const message = error instanceof Error ? error.message : "局部修改失败";
      setPromptComment((current) => current && current.segmentId === commentSnapshot.segmentId && current.start === commentSnapshot.start && current.end === commentSnapshot.end
        ? {...current, status: "draft", error: message}
        : current);
      setGenerationStage(message);
    }
  };

  const acceptPromptComment = async () => {
    if (!promptComment || promptComment.proposal === undefined) return;
    const segment = active.segments.find((item) => item.id === promptComment.segmentId);
    if (!segment) return;
    if (segment.prompt !== promptComment.basePrompt || segment.prompt.slice(promptComment.start, promptComment.end) !== promptComment.original) {
      setPromptComment((current) => current ? {...current, error: "提示词在生成期间发生了变化，请重新选择文字并生成修改。"} : current);
      setGenerationStage("提示词已变化，本次局部修改未应用");
      return;
    }
    const nextPrompt = promptComment.previewPrompt ??
      (promptComment.basePrompt.slice(0, promptComment.start) + promptComment.proposal + promptComment.basePrompt.slice(promptComment.end));
    updateSegmentById(segment.id, {
      prompt: nextPrompt,
      modified: true,
      continuityState: "",
      continuityUpdatedAt: undefined,
      shotDurations: [],
      shotDurationPromptHash: "",
    });
    setPromptSelection(null);
    closePromptComment();
    setGenerationStage("已应用局部修改，正在更新画面连续性……");
    const extracted = await extractAndSaveContinuityState(
      active.id,
      segment.id,
      active.script.slice(segment.start, segment.end),
      nextPrompt,
    );
    setGenerationStage(extracted !== null ? "已应用局部修改 · 连续性状态已更新" : "已应用局部修改 · 连续性状态提取失败");
  };

  const startGeneration = async (mode: GenerateMode = "replace") => {
    if (!selected) return;
    if (selected.contextSummary === "正在提取前后文原文……") {
      setGenerationStage("正在提取前后文原文，请稍候再生成");
      return;
    }
    const segmentId = selected.id;
    const ordered = active.segments.slice().sort((a, b) => a.start - b.start);
    const segmentIndex = ordered.findIndex((segment) => segment.id === segmentId);
    const previous = segmentIndex > 0 ? ordered[segmentIndex - 1] : null;
    const next = segmentIndex >= 0 && segmentIndex < ordered.length - 1 ? ordered[segmentIndex + 1] : null;
    let prefix = "";
    let suffix = "";
    if (mode === "selection" && promptSelection && promptSelection.end > promptSelection.start) {
      prefix = selected.prompt.slice(0, promptSelection.start);
      suffix = selected.prompt.slice(promptSelection.end);
    }
    generationAbort.current?.abort();
    const controller = new AbortController();
    generationAbort.current = controller;
    setMenu(null);
    setGeneratingId(segmentId);
    setCompletedGenerationId("");
    setGenerationStage(reviewEnabled ? "正在创作、验收并修改提示词……" : "正在运行 Few-shot 核心节点……");
    requestAnimationFrame(() => scrollPromptToSegment(segmentId));
    try {
      let previousContinuityState = previous?.continuityState || "";
      if (previous?.prompt && !previousContinuityState) {
        setGenerationStage("正在提取上一片段的画面连续性……");
        const extractedPreviousState = await extractAndSaveContinuityState(
          active.id,
          previous.id,
          active.script.slice(previous.start, previous.end),
          previous.prompt,
        );
        if (extractedPreviousState !== null) previousContinuityState = extractedPreviousState;
        setGenerationStage(reviewEnabled ? "正在创作、验收并修改提示词……" : "正在运行 Few-shot 核心节点……");
      }
      const exactContext = extractSegmentContext(selected.start, selected.end);
      updateSegmentById(segmentId, {
        contextSummary: [exactContext.beforeContextSummary, exactContext.afterContextSummary].join("\n"),
        beforeContextSummary: exactContext.beforeContextSummary,
        afterContextSummary: exactContext.afterContextSummary,
        contextSummaryUpdatedAt: Date.now(),
      });
      const response = await fetch("/api/deepseek", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        signal: controller.signal,
        body: JSON.stringify({
          segmentText: active.script.slice(selected.start, selected.end),
          contextSummary: [exactContext.beforeContextSummary, exactContext.afterContextSummary].join("\n"),
          beforeContextSummary: exactContext.beforeContextSummary,
          afterContextSummary: exactContext.afterContextSummary,
          continuityState: previousContinuityState,
          previousText: previous ? active.script.slice(previous.start, previous.end) : "",
          previousPrompt: previous?.prompt || "",
          nextText: next ? active.script.slice(next.start, next.end) : "",
          nextPrompt: next?.prompt || "",
          existingPrompt: selected.prompt,
          selectedPromptText: promptSelection ? selected.prompt.slice(promptSelection.start, promptSelection.end) : "",
          mode,
          promptVersion,
          promptTemplate: promptVersionOptions.find((option) => option.value === promptVersion)?.template || "",
          settings: {reviewEnabled},
        }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({error: "DeepSeek 请求失败"}));
        throw new Error(error.error || `DeepSeek 请求失败（${response.status}）`);
      }
      if (response.headers.get("content-type")?.includes("text/html")) {
        throw new Error("请求超时或服务暂未就绪，请重试（如是因模型生成过慢导致超时，可尝试缩短文本或关闭验收）");
      }
      if (!response.body) throw new Error("DeepSeek 没有返回内容");
      updateSegmentById(segmentId, {
        prompt: prefix,
        modified: false,
        continuityState: "",
        continuityUpdatedAt: undefined,
      });
      setGenerationStage("正在撰写分镜……");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let output = "";
      while (true) {
        const {done, value} = await reader.read();
        if (done) break;
        output += decoder.decode(value, {stream: true});
        updateSegmentById(segmentId, {prompt: prefix + output});
      }
      const finalPrompt = prefix + output.trim() + suffix;
      updateSegmentById(segmentId, {prompt: finalPrompt, generatedAt: Date.now(), modified: false});
      setCompletedGenerationId(segmentId);
      window.setTimeout(() => setCompletedGenerationId((current) => current === segmentId ? "" : current), 900);
      setGenerationStage("已生成，正在提取画面连续性……");
      const extracted = await extractAndSaveContinuityState(
        active.id,
        segmentId,
        active.script.slice(selected.start, selected.end),
        finalPrompt,
      );
      setGenerationStage(extracted !== null ? "已生成 · 连续性状态已保存" : "已生成 · 连续性状态提取失败");
    } catch (error) {
      if (controller.signal.aborted) setGenerationStage("已停止，当前内容已保存");
      else setGenerationStage(error instanceof Error ? error.message : "DeepSeek 请求失败");
    } finally {
      if (generationAbort.current === controller) generationAbort.current = null;
      setGeneratingId("");
    }
  };

  useEffect(() => () => {
    generationAbort.current?.abort();
  }, []);

  const renameSegment = () => {
    if (!selected || !renaming.trim() || renaming.trim() === selected.title) {
      setMenu(null);
      return;
    }
    pushUndo(active);
    updateSegment({title: renaming.trim()});
    setMenu(null);
  };

  const renderHighlightedScript = () => {
    let cursor = 0;
    const pieces: React.ReactNode[] = [];
    active.segments
      .slice()
      .sort((a, b) => a.start - b.start)
      .forEach((segment) => {
        if (segment.start > cursor) pieces.push(active.script.slice(cursor, segment.start));
        pieces.push(
          <mark
            key={segment.id}
            ref={(node) => {
              if (node) segmentMarkRefs.current.set(segment.id, node);
              else segmentMarkRefs.current.delete(segment.id);
            }}
            className={`${segment.confirmed ? "confirmed" : "draft"} ${
              segment.id === selectedId ? "selected" : ""
            } ${segment.invalid ? "invalid" : ""}`}
            data-title={segment.title}
          >
            {active.script.slice(segment.start, segment.end)}
          </mark>,
        );
        cursor = segment.end;
      });
    pieces.push(active.script.slice(cursor));
    return pieces;
  };

  const newEpisode = () => {
    const id = `ep-${Date.now()}`;
    setEpisodes((all) => [
      ...all,
      {
        id,
        title: `未命名剧本 ${all.length + 1}`,
        script: "在这里粘贴整部剧本……",
        segments: [],
        updatedAt: Date.now(),
      },
    ]);
    setActiveId(id);
    setSelectedId("");
    setLibraryOpen(false);
    requestAnimationFrame(() => editorRef.current?.focus());
  };

  const beginRenameEpisode = () => {
    setEpisodeTitleDraft(active.title);
    setRenamingEpisode(true);
  };

  const saveEpisodeTitle = () => {
    const title = episodeTitleDraft.trim();
    if (title && title !== active.title) updateEpisode({title});
    setRenamingEpisode(false);
    setEpisodeTitleDraft("");
  };

  const selectedDurationIsCurrent = Boolean(
    selected?.prompt &&
    selected.shotDurationPromptHash === fingerprintText(selected.prompt) &&
    selected.shotDurations?.length,
  );
  const selectedDurationSeconds = (() => {
    if (!selectedDurationIsCurrent || !selected?.shotDurations?.length) return null;
    
    if (promptSelection && promptSelection.end > promptSelection.start) {
      const marker = /【分镜\s*(\d+)\s*】/g;
      const shotIntervals: Array<{shot: number; start: number; end: number}> = [];
      let match: RegExpExecArray | null;
      let lastShot: number | null = null;
      let lastStart = 0;
      
      while ((match = marker.exec(selected.prompt)) !== null) {
        if (lastShot !== null) {
          shotIntervals.push({shot: lastShot, start: lastStart, end: match.index});
        }
        lastShot = Number(match[1]);
        lastStart = match.index;
      }
      if (lastShot !== null) {
        shotIntervals.push({shot: lastShot, start: lastStart, end: selected.prompt.length});
      }
      
      const overlappingShots = new Set<number>();
      for (const interval of shotIntervals) {
        if (promptSelection.start < interval.end && promptSelection.end > interval.start) {
          overlappingShots.add(interval.shot);
        }
      }
      
      if (overlappingShots.size > 0) {
        return selected.shotDurations
          .filter((item) => overlappingShots.has(item.shot))
          .reduce((total, item) => total + Math.max(1, Math.round(item.seconds)), 0);
      }
    }
    
    return selected.shotDurations.reduce((total, item) => total + Math.max(1, Math.round(item.seconds)), 0);
  })();
  const selectedDurationText = !selected?.prompt
    ? "时长待生成"
    : selectedDurationSeconds === null
      ? "时长估算中"
      : `约 ${selectedDurationSeconds} 秒`;
  const selectedIsGenerating = Boolean(selected && generatingId === selected.id);

  if (!active) return null;

  if (!ready) {
    return (
      <main className="studio-loading" aria-live="polite">
        <span>正在读取剧本</span>
      </main>
    );
  }

  return (
    <main
      className="studio"
      onPointerDownCapture={(event) => {
        const target = event.target as Element;
        if (
          target === promptDocumentRef.current ||
          target.closest(".segment-popover, .prompt-comment-panel")
        ) return;
        promptDocumentRef.current?.blur();
        setPromptSelection(null);
      }}
    >
      <header>
        <div className="episode-switch">
          <button className="brand-select" onClick={() => {setLibraryOpen(!libraryOpen); setRenamingEpisode(false);}}>
            <b>{active.title}</b>
            <span>⌄</span>
          </button>
          {libraryOpen && (
            <div className="episode-menu">
              <b>剧本项目</b>
              {episodes.map((episode) => (
                <button
                  key={episode.id}
                  onClick={() => {
                    const savedSegmentId = window.localStorage.getItem(`short-drama-selected-segment:${episode.id}`);
                    setActiveId(episode.id);
                    setSelectedId(episode.segments.find((segment) => segment.id === savedSegmentId)?.id || episode.segments[0]?.id || "");
                    setLibraryOpen(false);
                    requestAnimationFrame(() => editorRef.current?.focus());
                  }}
                >
                  {episode.title}
                </button>
              ))}
              <button onClick={newEpisode}>＋ 新建整部剧本</button>
              {renamingEpisode ? (
                <div className="episode-rename">
                  <input
                    autoFocus
                    value={episodeTitleDraft}
                    onChange={(event) => setEpisodeTitleDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") saveEpisodeTitle();
                      if (event.key === "Escape") {setRenamingEpisode(false); setEpisodeTitleDraft("");}
                    }}
                    aria-label="修改剧本名称"
                  />
                  <button onClick={saveEpisodeTitle}>保存</button>
                  <button onClick={() => {setRenamingEpisode(false); setEpisodeTitleDraft("");}}>取消</button>
                </div>
              ) : (
                <button onClick={beginRenameEpisode}>重命名当前剧本</button>
              )}
            </div>
          )}
        </div>
        <div className="loveu-logo" aria-label="LoveU">
          <strong><i>Love</i><em>U</em></strong>
          <span className="loveu-tagline">SHORT DRAMA PROMPT</span>
          <span className="loveu-version">版本 0.9</span>
        </div>
        <nav>
          <span>{namingEpisodeId === active.id ? "DeepSeek 正在命名剧本……" : ready ? "已保存到 IndexedDB" : "正在读取数据"}</span>
          <DeepSeekModelToggle />
          {!IS_PRODUCTION_DEPLOYMENT && <a href="/test">版本测试</a>}
          {!IS_PRODUCTION_DEPLOYMENT && <a href="/debug">调试日志</a>}
          <button
            className="script-mode-toggle"
            aria-pressed={scriptMode}
            onClick={() => {
              setScriptMode((enabled) => !enabled);
              setLibraryOpen(false);
              setDirectoryOpen(false);
              setMenu(null);
            }}
          >
            {scriptMode ? "退出剧本模式" : "剧本模式"}
          </button>
          <button disabled={!undoCount} onClick={undoScript}>
            撤销 {undoCount}/5
          </button>
        </nav>
      </header>

      <section className={`two-columns ${scriptMode ? "script-mode" : ""}`}>
        <section className="text-pane script-pane">
          <div className="pane-head">
            <div>
              <p>01</p>
              <h2>剧本</h2>
              <span>粘贴并编辑整部剧本；拖选文字新建片段</span>
            </div>
            <div className="script-directory">
              <button
                className="script-directory-trigger"
                disabled={!scriptDirectory.length}
                onClick={() => setDirectoryOpen((open) => !open)}
                aria-expanded={directoryOpen}
              >
                目录 <span>⌄</span>
              </button>
              {directoryOpen && (
                <div
                  className="script-directory-menu"
                  ref={scriptDirectoryMenuRef}
                  onScroll={(event) => {
                    window.localStorage.setItem(
                      `short-drama-directory-scroll:${active.id}`,
                      String(event.currentTarget.scrollTop),
                    );
                  }}
                >
                  {scriptDirectory.map((entry) => (
                    <button key={`${entry.label}-${entry.index}`} onClick={() => jumpToDirectoryEntry(entry.index)}>
                      {entry.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {false && draftRange && (
              <button className="dark" onClick={addSegment}>
                将选中文字新建为片段
              </button>
            )}
          </div>

          <div className="script-edit-wrap">
            <div className="script-highlight" aria-hidden>
              {renderHighlightedScript()}
              {active.segments.map((segment) => {
                const top = labelTops[segment.id];
                if (top === undefined) return null;
                const text = active.script.slice(segment.start, segment.end);
                return (
                  <span className="segment-label" style={{top}} key={`label-${segment.id}`}>
                    <b><i className={`segment-status ${segment.prompt ? segment.modified ? "modified" : "generated" : "empty"}`} />{segment.title}</b>
                    <small>字数 {countTextCharacters(text)}</small>
                    <small>台词 {countDialogueCharacters(text)}</small>
                  </span>
                );
              })}
            </div>
            <textarea
              ref={editorRef}
              className="script-editor"
              value={active.script}
              onChange={(event) => updateScript(event.target.value)}
              onMouseUp={(event) => selectScriptText(event, false)}
              onContextMenu={(event) => {
                event.preventDefault();
                selectScriptText(event, true);
              }}
              onKeyUp={() => selectScriptText()}
              onScroll={(event) => {
                const highlight = event.currentTarget.previousElementSibling as HTMLDivElement | null;
                if (highlight) {
                  highlight.scrollTop = event.currentTarget.scrollTop;
                  highlight.scrollLeft = event.currentTarget.scrollLeft;
                }
                rememberScriptScroll(event.currentTarget.scrollTop);
              }}
              aria-label="编辑剧本"
              spellCheck={false}
            />
          </div>

          <footer>
            <span>{active.segments.length} 个片段</span>
            <span>{selected ? `${selected.title}${selected.invalid ? " · 范围失效" : ""}` : "拖选文字新建片段"}</span>
          </footer>
        </section>

        {!scriptMode && <section className="text-pane prompt-pane">
          <div className="pane-head">
            <div>
              <p>02</p>
              <h2>视频提示词</h2>
              <span>
                {selected
                  ? <>
                      {selected.title} · <em className={["prompt-total-duration", promptSelection && promptSelection.end > promptSelection.start ? "is-partial" : ""].filter(Boolean).join(" ")}>{selectedDurationText}</em> · {selectedIsGenerating ? generationStage : selected.prompt ? selected.modified ? "已修改" : "已生成" : "尚未生成"}
                    </>
                  : "请先在剧本中选择片段"}
              </span>
            </div>
          </div>

          <div
            className="prompt-continuous"
            ref={promptPaneRef}
            onScroll={(event) => {
              window.localStorage.setItem(`short-drama-prompt-scroll:${active.id}`, String(event.currentTarget.scrollTop));
            }}
          >
            {active.segments.length ? (
              <div className={`prompt-document-wrap ${generatingId ? "has-generation" : ""}`}>
                <div className="prompt-document-highlight" aria-hidden>
                  {promptLayout.entries.map(({segment}, index) => {
                    const segmentComment = promptComment?.segmentId === segment.id ? promptComment : null;
                    const shownSelection = segmentComment?.proposal ?? segmentComment?.original ?? "";
                    const shownPrompt = segmentComment?.previewPrompt ?? segment.prompt;
                    const shownStart = segmentComment?.previewStart ?? segmentComment?.start ?? 0;
                    const shownEnd = segmentComment?.previewEnd ?? segmentComment?.end ?? 0;
                    return (
                      <span className="prompt-document-fragment" key={segment.id}>
                        {index > 0 ? "\n\n" : ""}
                        <mark
                          className={[
                            segment.id === selectedId ? "selected" : "",
                            copiedSegmentId === segment.id ? "copied" : "",
                            completedGenerationId === segment.id ? "generation-complete" : "",
                          ].filter(Boolean).join(" ")}
                        >
                          {segmentComment ? (
                            <>
                              {shownPrompt.slice(0, shownStart)}
                              <span className={[
                                "comment-selection",
                                segmentComment.status === "generating" ? "is-generating" : "",
                                segmentComment.status === "review" ? "is-proposal" : "",
                              ].filter(Boolean).join(" ")}>{shownSelection}</span>
                              {shownPrompt.slice(shownEnd)}
                            </>
                          ) : generatingId === segment.id && segment.prompt && !generationStage.startsWith("已生成") ? (
                            <span className="comment-selection is-generating">{segment.prompt}</span>
                          ) : segment.prompt}
                        </mark>
                      </span>
                    );
                  })}
                </div>

                <textarea
                  ref={promptDocumentRef}
                  className={promptComment ? (promptComment.status === "generating" ? "comment-generation-active has-active-comment" : "has-active-comment") : undefined}
                  readOnly={Boolean(generatingId || promptComment)}
                  value={promptDisplayText}
                  onChange={(event) => updatePromptDocument(event.target.value, event.target.selectionStart ?? undefined)}
                  onSelect={() => selectPromptText()}
                  onClick={(event) => selectPromptText(event, false, true)}
                  onMouseUp={(event) => {
                    const textarea = event.currentTarget;
                    window.requestAnimationFrame(() => {
                      if (textarea.selectionStart === textarea.selectionEnd) {
                        setPromptSelection(null);
                      }
                    });
                  }}
                  onKeyUp={(event) => {
                    if (
                      event.key === "Escape" ||
                      event.currentTarget.selectionStart === event.currentTarget.selectionEnd
                    ) setPromptSelection(null);
                  }}
                  onBlur={() => {
                    window.requestAnimationFrame(() => {
                      const activeElement = document.activeElement as Element | null;
                      if (activeElement?.closest(".segment-popover")) return;
                      setPromptSelection(null);
                    });
                  }}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    selectPromptText(event, true);
                  }}
                  placeholder="尚未生成视频提示词……"
                  aria-label="编辑全部视频提示词"
                />

                <div className="prompt-document-overlays" aria-hidden>
                  {promptLayout.entries.map(({segment}, index) => {
                    const isComplete = completedGenerationId === segment.id;
                    if (!isComplete) return null;
                    const top = promptSegmentTops[segment.id] || 0;
                    const nextTop = index < promptLayout.entries.length - 1 ? promptSegmentTops[promptLayout.entries[index + 1].segment.id] : undefined;
                    const height = nextTop !== undefined ? nextTop - top : `calc(100% - ${top}px)`;
                    return (
                      <div key={`${segment.id}-curtain`} className="prompt-generation-reveal-curtain" style={{top, height}} />
                    );
                  })}
                </div>

                <div className="prompt-document-meta" aria-hidden>
                  {promptLayout.entries.map(({segment}) => {
                    const top = promptSegmentTops[segment.id] || 0;
                    const segmentIsGenerating = generatingId === segment.id;
                    return (
                      <span className="prompt-document-segment-label" style={{top}} key={`${segment.id}-label`}>
                        <b>{segment.title}</b>
                        {segmentIsGenerating && <small>{generationStage}</small>}
                      </span>
                    );
                  })}
                  {promptLayout.entries.flatMap(({segment}) =>
                    (shotDurationLabelTops[segment.id] || []).map(({shot, top}, occurrenceIndex) => {
                      const seconds = segment.shotDurations?.find((item) => item.shot === shot)?.seconds;
                      if (!seconds) return [];
                      const segmentTop = promptSegmentTops[segment.id] || 0;
                      const isOverlapping = occurrenceIndex === 0 && Math.abs(top - segmentTop) < 10;
                      const adjustedTop = isOverlapping ? top + 16 : top;
                      return [(
                        <span className="prompt-shot-duration-label" style={{top: adjustedTop}} key={`${segment.id}-duration-${shot}-${occurrenceIndex}`}>
                          <b>分镜 {String(shot).padStart(2, "0")}</b>
                          <small>约 {Math.max(1, Math.round(seconds))} 秒</small>
                        </span>
                      )];
                    }),
                  )}
                </div>

                <div className="prompt-document-tools">
                  {promptLayout.entries.map(({segment}, index) => {
                    const segmentIsGenerating = generatingId === segment.id;
                    const top = promptSegmentTops[segment.id] || 0;
                    const nextTop = index < promptLayout.entries.length - 1 ? promptSegmentTops[promptLayout.entries[index + 1].segment.id] : undefined;
                    const height = nextTop !== undefined ? nextTop - top : `calc(100% - ${top}px)`;
                    return (
                      <div key={`${segment.id}-copy-wrap`} className="prompt-segment-tool-wrap" style={{top, height}}>
                        <button
                          disabled={!segment.prompt || segmentIsGenerating}
                          onMouseDown={(event) => event.stopPropagation()}
                          onClick={async (event) => {
                            event.stopPropagation();
                            await navigator.clipboard.writeText(segment.prompt);
                            setCopiedSegmentId(segment.id);
                            window.setTimeout(() => setCopiedSegmentId((current) => current === segment.id ? "" : current), 1200);
                          }}
                        >
                          {segmentIsGenerating ? "生成中" : copiedSegmentId === segment.id ? "已复制" : "复制"}
                        </button>
                      </div>
                    );
                  })}
                </div>

                {generatingId && !selected?.prompt.trim() && (
                  <div className="prompt-shot-skeleton prompt-document-skeleton" style={{top: promptSegmentTops[generatingId] || 0}} aria-hidden>
                    <span /><span /><span />
                  </div>
                )}
              </div>
            ) : <span className="prompt-empty">请先在剧本中拖选文字并新建片段</span>}
          </div>

          <footer>
            <span>{selectedIsGenerating ? generationStage : generationStage || "修改后自动持久保存"}</span>
            {selectedIsGenerating && <button className="dark" onClick={stopGeneration}>停止生成</button>}
          </footer>
        </section>}
      </section>

      {menu && (
        <div
          className="segment-popover"
          style={{
            left: Math.max(12, Math.min(menu.x + 10, window.innerWidth - (["generate", "prompt-actions"].includes(menu.mode) ? 730 : 300))),
            top: Math.min(menu.y + 12, window.innerHeight - 90),
          }}
        >
          {menu.mode === "new" && (
            <>
              <button className="primary" onClick={addSegment}>＋ 新建片段</button>
              <button onClick={() => { setDraftRange(null); setMenu(null); }}>取消</button>
            </>
          )}
          {menu.mode === "actions" && selected && (
            <>
              <b>{selected.title}</b>
              <button disabled={selectedIsGenerating} onClick={() => startGeneration("replace")}>生成视频提示词</button>
              <button disabled={selectedIsGenerating} onClick={() => setMenu({...menu, mode: "generate"})}>生成设置</button>
              <button
                onClick={() => {
                  setAdjustingId(selected.id);
                  setDraftRange(null);
                  setMenu(null);
                  editorRef.current?.focus();
                }}
              >调整范围</button>
              <button onClick={() => { setRenaming(selected.title); setMenu({...menu, mode: "rename"}); }}>重命名</button>
              <button className="danger" onClick={() => setMenu({...menu, mode: "delete"})}>删除</button>
            </>
          )}
          {menu.mode === "generate" && selected && (
            <>
              <b>{selected.title}</b>
              <label>模型
                <select value={model} onChange={(event) => {
                  const next = event.target.value as "deepseek-v4-flash" | "deepseek-v4-pro" | "kimi-k3-high" | "kimi-k3-max";
                  document.cookie = `loveu_ai_model=${next}; Path=/; Max-Age=31536000; SameSite=None; Secure`;
                  setModel(next);
                  window.dispatchEvent(new CustomEvent("loveu_ai_model_changed", {detail: next}));
                }}>
                  <option value="deepseek-v4-flash">Flash</option>
                  <option value="deepseek-v4-pro">Pro</option>
                  <option value="kimi-k3-high">K3 High</option>
                  <option value="kimi-k3-max">K3 Max</option>
                </select>
              </label>
              <label>版本
                <select value={promptVersion} onChange={(event) => changePromptVersion(event.target.value)}>
                  {promptVersionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label title="启用分镜原子化、空间连续性与画面闭合三个验收节点"><input type="checkbox" checked={reviewEnabled} onChange={(event) => setReviewEnabled(event.target.checked)} />验收</label>
              <button onClick={() => setMenu({...menu, mode: "actions"})}>返回</button>
              <button className="primary" onClick={() => startGeneration("replace")}>生成</button>
            </>
          )}
          {menu.mode === "prompt-actions" && selected && (
            <>
              <b>{selected.title}</b>
              <label>版本
                <select value={promptVersion} onChange={(event) => changePromptVersion(event.target.value)}>
                  {promptVersionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label title="启用分镜原子化、空间连续性与画面闭合三个验收节点"><input type="checkbox" checked={reviewEnabled} onChange={(event) => setReviewEnabled(event.target.checked)} />验收</label>
              <button onClick={() => startGeneration("replace")}>完整重写</button>
              <button onClick={openFullPromptComment}>修改整体</button>
              <button disabled={!promptSelection} onClick={openPromptComment}>修改选中文字</button>
            </>
          )}
          {menu.mode === "rename" && selected && (
            <>
              <input
                autoFocus
                value={renaming}
                onChange={(event) => setRenaming(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && renaming.trim()) {
                    renameSegment();
                  }
                  if (event.key === "Escape") setMenu(null);
                }}
                aria-label="片段名称"
              />
              <button className="primary" onClick={renameSegment}>保存</button>
              <button onClick={() => setMenu(null)}>取消</button>
            </>
          )}
          {menu.mode === "adjust" && (
            <>
              <span>使用当前选区作为新范围</span>
              <button className="primary" onClick={saveAdjustedRange}>保存范围</button>
              <button onClick={() => { setAdjustingId(""); setDraftRange(null); setMenu(null); }}>取消</button>
            </>
          )}
          {menu.mode === "delete" && selected && (
            <>
              <span>删除 {selected.title}？对应提示词也会删除。</span>
              <button onClick={() => setMenu({...menu, mode: "actions"})}>取消</button>
              <button className="danger" onClick={deleteSegment}>删除</button>
            </>
          )}
        </div>
      )}

      {promptComment && selected?.id === promptComment.segmentId && (
        <aside
          ref={promptCommentPanelRef}
          className={`prompt-comment-panel ${commentAnchor?.above ? "above" : ""} ${commentDragging ? "dragging" : ""}`}
          style={commentAnchor ? {left: commentAnchor.left, top: commentAnchor.top} : undefined}
          aria-label="局部修改批注"
        >
          <header
            onPointerDown={startCommentDrag}
            onPointerMove={movePromptComment}
            onPointerUp={stopCommentDrag}
            onPointerCancel={stopCommentDrag}
          >
            <b>修改选中文字</b>
            <button onClick={closePromptComment}>×</button>
          </header>
          {promptComment.status !== "review" ? (
            <>
              <textarea
                autoFocus
                value={commentDraft}
                onChange={(event) => setCommentDraft(event.target.value)}
                placeholder="写下修改意见，例如：人物不要哭，改成强忍情绪"
                aria-label="修改意见"
              />
              {promptComment.error && <p className="prompt-comment-note error">{promptComment.error}</p>}
              <footer>
                <button onClick={closePromptComment}>取消</button>
                <button className="primary" disabled={!commentDraft.trim() || commentRunning} onClick={runPromptComment}>{commentRunning ? "修改中……" : "生成修改"}</button>
              </footer>
            </>
          ) : (
            <>
              <p className={`prompt-comment-note ${promptComment.warning ? "warning" : ""}`}>
                {promptComment.warning || "新文字已在原位置预览"}
              </p>
              {promptComment.error && <p className="prompt-comment-note error">{promptComment.error}</p>}
              <footer>
                <button onClick={closePromptComment}>取消修改</button>
                <button onClick={() => setPromptComment({
                  ...promptComment,
                  proposal: undefined,
                  previewPrompt: undefined,
                  previewStart: undefined,
                  previewEnd: undefined,
                  structural: undefined,
                  warning: undefined,
                  error: undefined,
                  status: "draft",
                })}>调整意见</button>
                <button onClick={runPromptComment} disabled={commentRunning}>{commentRunning ? "重试中……" : "重新生成"}</button>
                <button className="primary" disabled={Boolean(promptComment.error)} onClick={acceptPromptComment}>接受修改</button>
              </footer>
            </>
          )}
        </aside>
      )}
    </main>
  );
}
