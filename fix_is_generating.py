import sys

with open('app/page.tsx', 'r') as f:
    content = f.read()

target = """                          ) : generatingId === segment.id && segment.prompt ? (
                            <span className="comment-selection is-generating">{segment.prompt}</span>
                          ) : segment.prompt}"""
replacement = """                          ) : generatingId === segment.id && segment.prompt && !generationStage.startsWith("已生成") ? (
                            <span className="comment-selection is-generating">{segment.prompt}</span>
                          ) : segment.prompt}"""

if target in content:
    content = content.replace(target, replacement)
    with open('app/page.tsx', 'w') as f:
        f.write(content)
    print("Fixed generating span logic")
else:
    print("Target not found")
