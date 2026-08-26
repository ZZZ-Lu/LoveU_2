import sys

with open('app/page.tsx', 'r') as f:
    content = f.read()

target = """    setGeneratingId(segmentId);
    setCompletedGenerationId("");
    setGenerationStage(reviewEnabled ? "正在创作、验收并修改提示词……" : "正在运行 Few-shot 核心节点……");"""
replacement = """    setGeneratingId(segmentId);
    setCompletedGenerationId("");
    setGenerationStage(reviewEnabled ? "正在创作、验收并修改提示词……" : "正在运行 Few-shot 核心节点……");
    requestAnimationFrame(() => scrollPromptToSegment(segmentId));"""

if target in content:
    content = content.replace(target, replacement)
    with open('app/page.tsx', 'w') as f:
        f.write(content)
    print("Fixed scroll in page.tsx")
else:
    print("Target not found")
