import sys
with open('app/globals.css', 'r') as f:
    content = f.read()

target = """.prompt-document-highlight mark.generating {
  background-image: linear-gradient(
    90deg,
    rgba(218, 199, 126, 0.32) 0%,
    rgba(218, 199, 126, 0.88) 46%,
    rgba(218, 199, 126, 0.32) 100%
  );
  background-size: 220% 100%;
  animation: prompt-document-flow 1.8s ease-in-out infinite;
}"""
replacement = """.prompt-document-highlight mark.generating {
  background: rgba(218, 199, 126, 0.32);
  animation: prompt-skeleton-breathe 1.25s ease-in-out infinite alternate;
}"""

if target in content:
    content = content.replace(target, replacement)
    print("Replaced target 1")

with open('app/globals.css', 'w') as f:
    f.write(content)
