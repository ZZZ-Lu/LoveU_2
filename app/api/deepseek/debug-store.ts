export type DebugRound = {
  index: number;
  sentenceIndex: number;
  reactStep: number;
  scriptUnit: string;
  startedAt: number;
  durationMs: number;
  rawModelInput: string;
  rawModelOutput: string;
  workingNote: string;
  action: string;
  actionInput: unknown;
  observation: unknown;
  workspaceAfter: unknown;
  imaginationRawInput?: string;
  imaginationRawOutput?: string;
};

export type DebugRun = {
  id: string;
  startedAt: number;
  completedAt?: number;
  status: "running" | "completed" | "failed";
  model: string;
  thinkingMode: string;
  segmentText: string;
  rounds: DebugRound[];
  finalRawModelInput?: string;
  finalOutput?: string;
  error?: string;
};

const globalStore = globalThis as typeof globalThis & {__shortDramaDebugRuns?: DebugRun[]};
const runs = globalStore.__shortDramaDebugRuns || [];
globalStore.__shortDramaDebugRuns = runs;

export function createDebugRun(segmentText: string, model = "deepseek-v4-pro") {
  const run: DebugRun = {
    id: `run-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    startedAt: Date.now(), status: "running", model,
    thinkingMode: "disabled", segmentText, rounds: [],
  };
  runs.unshift(run); runs.splice(20); return run;
}

export function addDebugRound(runId: string, round: DebugRound) {
  runs.find((item) => item.id === runId)?.rounds.push(round);
}

export function setFinalDebugInput(runId: string, input: string) {
  const run = runs.find((item) => item.id === runId);
  if (run) run.finalRawModelInput = input;
}

export function completeDebugRun(runId: string, finalOutput: string) {
  const run = runs.find((item) => item.id === runId);
  if (!run) return;
  run.status = "completed"; run.completedAt = Date.now(); run.finalOutput = finalOutput;
}

export function failDebugRun(runId: string, error: string) {
  const run = runs.find((item) => item.id === runId);
  if (!run) return;
  run.status = "failed"; run.completedAt = Date.now(); run.error = error;
}

export const listDebugRuns = () => runs;
export const clearDebugRuns = () => runs.splice(0);
