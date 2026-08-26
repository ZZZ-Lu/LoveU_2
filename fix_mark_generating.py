import sys

with open('app/globals.css', 'r') as f:
    content = f.read()

target = """.prompt-document-highlight mark.generating {
  background: rgba(218, 199, 126, 0.32);
  animation: prompt-skeleton-breathe 1.25s ease-in-out infinite alternate;
}"""
replacement = """.prompt-document-highlight mark.generating {
  background: rgba(255, 244, 185, 0.76);
  color: var(--ink);
  -webkit-backdrop-filter: blur(1.15px);
  backdrop-filter: blur(1.15px);
  animation: prompt-skeleton-breathe 1.25s ease-in-out infinite alternate;
}"""

if target in content:
    content = content.replace(target, replacement)
    with open('app/globals.css', 'w') as f:
        f.write(content)
    print("Fixed mark.generating")
else:
    print("Target not found")
