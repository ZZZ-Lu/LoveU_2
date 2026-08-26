import sys

with open('app/api/deepseek/selection-boundary.ts', 'r') as f:
    content = f.read()

target = """const shotMarkers = (value: string) => {
  const marker = /【\s*(?:(?:新增)?分镜|镜头)\s*([0-9一二三四五六七八九十〇零a-zA-Z-]*)\s*】/g;
  return [...value.matchAll(marker)].map((match) => ({
    number: chineseNumber(match[1]),
    index: match.index || 0,
  }));
};"""

replacement = """const shotMarkers = (value: string) => {
  const marker = /【\s*分镜\s*([0-9一二三四五六七八九十〇零]+)\s*】/g;
  return [...value.matchAll(marker)].map((match) => ({
    number: chineseNumber(match[1]),
    index: match.index || 0,
  }));
};"""

if target in content:
    with open('app/api/deepseek/selection-boundary.ts', 'w') as f:
        f.write(content.replace(target, replacement))
    print("Reverted selection-boundary.ts successfully")
else:
    print("Target not found")
