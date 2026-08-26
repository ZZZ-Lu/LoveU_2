import sys

with open('app/globals.css', 'r') as f:
    content = f.read()

target = """.prompt-document-meta,
.prompt-document-meta,
.prompt-document-tools {
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
}"""
replacement = """.prompt-document-meta,
.prompt-document-overlays,
.prompt-document-tools {
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
}

.prompt-generation-reveal-curtain {
  position: absolute;
  left: 0;
  right: 0;
  background: var(--paper);
  transform-origin: bottom;
  animation: prompt-curtain-reveal 720ms ease-out forwards;
}"""

if target in content:
    content = content.replace(target, replacement)
    with open('app/globals.css', 'w') as f:
        f.write(content)
    print("Fixed meta and added curtain")
else:
    print("Target not found")
