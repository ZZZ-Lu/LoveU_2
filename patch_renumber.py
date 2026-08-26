import sys

with open('app/page.tsx', 'r') as f:
    content = f.read()

target = """  const renumber = (text: string) => text.replace(
    /【\s*分镜\s*[0-9一二三四五六七八九十〇零]+\s*】/g,
    () => `【分镜${++shot}】`,
  );"""

replacement = """  const renumber = (text: string) => text.replace(
    /【\s*(?:(?:新增)?分镜|镜头)\s*[0-9一二三四五六七八九十〇零a-zA-Z-]*\s*】/g,
    () => `【分镜${++shot}】`,
  );"""

if target in content:
    with open('app/page.tsx', 'w') as f:
        f.write(content.replace(target, replacement))
    print("Patched successfully")
else:
    print("Target not found")
