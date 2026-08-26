import sys

with open('app/page.tsx', 'r') as f:
    content = f.read()

target = """                      {selected.title} · <em className="prompt-total-duration">{selectedDurationText}</em> · {selectedIsGenerating ? generationStage : selected.prompt ? selected.modified ? "已修改" : "已生成" : "尚未生成"}"""

replacement = """                      {selected.title} · <em className={["prompt-total-duration", promptSelection && promptSelection.end > promptSelection.start ? "is-partial" : ""].filter(Boolean).join(" ")}>{selectedDurationText}</em> · {selectedIsGenerating ? generationStage : selected.prompt ? selected.modified ? "已修改" : "已生成" : "尚未生成"}"""

if target in content:
    content = content.replace(target, replacement)
    with open('app/page.tsx', 'w') as f:
        f.write(content)
    print("Updated em className")
else:
    print("Target not found")
