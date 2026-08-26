import sys

with open('app/api/deepseek/route.ts', 'r') as f:
    content = f.read()

target = """const parseSelectionOutput = (raw: string, original: string, allowShotExpansion = false) => {
  const imagination = raw.match(/<analysis>([\\s\\S]*?)<\\/analysis>/i)?.[1]?.trim() || "";
  const tagged = raw.match(/<replacement>([\\s\\S]*?)<\\/replacement>/i)?.[1]?.trim();
  const fallback = raw.split(/最终提示词\\s*[：:]?/).at(-1)?.trim() || raw.trim();
  const constrained = constrainSelectionReplacement(tagged || fallback, original, {allowShotExpansion});
  return {prompt: constrained.replacement, imagination, cropped: constrained.cropped};
};"""

replacement = """const parseSelectionOutput = (raw: string, original: string, allowShotExpansion = false) => {
  const imagination = raw.match(/<analysis>([\\s\\S]*?)<\\/analysis>/i)?.[1]?.trim() || "";
  const tagged = raw.match(/<replacement>([\\s\\S]*?)<\\/replacement>/i)?.[1]?.trim();
  const fallback = raw.split(/最终提示词\\s*[：:]?/).at(-1)?.trim() || raw.trim();
  const prompt = (tagged || fallback).trim();
  return {prompt, imagination, cropped: false};
};"""

if target in content:
    content = content.replace(target, replacement)
    with open('app/api/deepseek/route.ts', 'w') as f:
        f.write(content)
    print("Patched parseSelectionOutput successfully")
else:
    print("parseSelectionOutput target not found")
