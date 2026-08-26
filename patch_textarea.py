import sys

with open('app/page.tsx', 'r') as f:
    content = f.read()

target = """                  className={promptComment?.status === "generating" ? "comment-generation-active" : undefined}"""
replacement = """                  className={promptComment ? (promptComment.status === "generating" ? "comment-generation-active has-active-comment" : "has-active-comment") : undefined}"""

if target in content:
    with open('app/page.tsx', 'w') as f:
        f.write(content.replace(target, replacement))
    print("Patched page.tsx successfully")
else:
    print("Target not found")
