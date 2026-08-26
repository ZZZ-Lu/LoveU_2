import sys

with open('app/globals.css', 'r') as f:
    content = f.read()

target = """.prompt-document-tools {
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
}"""
replacement = """.prompt-document-meta,
.prompt-document-tools,
.prompt-document-overlays {
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
}

.prompt-generation-overlay {
  position: absolute;
  left: 0;
  right: 0;
  background: rgba(218, 199, 126, 0.24);
  border-radius: 4px;
  animation: prompt-overlay-breathe 1.25s ease-in-out infinite alternate;
}"""

if target in content:
    content = content.replace(target, replacement)
else:
    print("Fallback target")
    # try fallback
    target2 = """.prompt-document-meta,
.prompt-document-tools {
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
}"""
    if target2 in content:
        content = content.replace(target2, replacement)

with open('app/globals.css', 'w') as f:
    f.write(content)
print("Patched css")
