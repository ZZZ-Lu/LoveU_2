import promptVersionArchive from "../../../fewshot-prompt-versions.json";

export type ArchivedPromptOption = {
  value: string;
  id: string;
  label: string;
  note: string;
  template: string;
};

export const FUSION_PROMPT_VERSION = "fusion-v14-5-v7-2";
export const V14_5_PROMPT_VERSION = "v-1784457548938";
export const V7_2_TEST_PROMPT_VERSION = "github-v7-2-test";
export const V7_3_2_2_PROMPT_VERSION = "github-v7-3-2-2";

const archivedOptions: ArchivedPromptOption[] = promptVersionArchive.versions.map((item) => ({
  value: item.id.startsWith("builtin-") ? item.id.slice("builtin-".length) : item.id,
  id: item.id,
  label: item.label.replace(/\s*·\s*内置\s*$/u, ""),
  note: item.id.startsWith("builtin-") ? "内置版本" : "GitHub Prompt 版本归档",
  template: item.prompt,
}));

export const ARCHIVED_PROMPT_OPTIONS: ArchivedPromptOption[] = [
  {
    value: FUSION_PROMPT_VERSION,
    id: FUSION_PROMPT_VERSION,
    label: "V14-5 × V7-2 · 表演融合",
    note: "V14-5与V7-2并行生成后，由独立节点融合",
    template: "",
  },
  ...archivedOptions,
];

export const DEFAULT_ARCHIVED_PROMPT_VERSION =
  archivedOptions.find((item) => !item.id.startsWith("builtin-"))?.value
  || archivedOptions[0]?.value
  || "v4";

export const getArchivedPromptTemplate = (version: string) => {
  const normalized = version.trim().toLowerCase();
  return (
    ARCHIVED_PROMPT_OPTIONS.find((item) => item.value === version || item.id === version)?.template
    || ARCHIVED_PROMPT_OPTIONS.find(
      (item) => item.value.toLowerCase() === normalized || item.id.toLowerCase() === normalized,
    )?.template
    || (normalized === "v7-3-2-2" || normalized === "github-v7-3-2-2"
      ? ARCHIVED_PROMPT_OPTIONS.find((item) => item.id === V7_3_2_2_PROMPT_VERSION)?.template
      : undefined)
    || ARCHIVED_PROMPT_OPTIONS.find((item) => item.value === DEFAULT_ARCHIVED_PROMPT_VERSION)?.template
    || ""
  );
};
