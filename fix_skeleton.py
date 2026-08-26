import sys

with open('app/globals.css', 'r') as f:
    content = f.read()

target = """.prompt-shot-skeleton span {
  display: block;
  width: 88%;
  height: 20px;
  background: rgba(218, 199, 126, 0.34);
  animation: prompt-skeleton-breathe 1.25s ease-in-out infinite alternate;
}"""
replacement = """.prompt-shot-skeleton span {
  display: block;
  width: 88%;
  height: 20px;
  background: rgba(255, 244, 185, 0.76);
  -webkit-backdrop-filter: blur(1.15px);
  backdrop-filter: blur(1.15px);
  animation: prompt-skeleton-breathe 1.25s ease-in-out infinite alternate;
}"""

if target in content:
    content = content.replace(target, replacement)
    with open('app/globals.css', 'w') as f:
        f.write(content)
    print("Fixed skeleton")
else:
    print("Target not found")
