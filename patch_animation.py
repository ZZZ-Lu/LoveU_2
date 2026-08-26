import sys

with open('app/globals.css', 'r') as f:
    content = f.read()

target1 = """.prompt-document-highlight mark.generating {
  background-image: linear-gradient(
    90deg,
    rgba(218, 199, 126, 0.32) 0%,
    rgba(255, 244, 185, 0.88) 46%,
    rgba(218, 199, 126, 0.32) 100%
  );"""
replacement1 = """.prompt-document-highlight mark.generating {
  background-image: linear-gradient(
    90deg,
    rgba(218, 199, 126, 0.32) 0%,
    rgba(218, 199, 126, 0.88) 46%,
    rgba(218, 199, 126, 0.32) 100%
  );"""

target2 = """.prompt-segment.generating.has-content .prompt-text-wrap::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  top: -44px;
  z-index: 3;
  height: 44px;
  pointer-events: none;
  background: linear-gradient(180deg, transparent, rgba(221, 174, 28, 0.34), transparent);
  animation: prompt-generation-scan 1.8s ease-in-out infinite;
}"""
replacement2 = """.prompt-segment.generating.has-content .prompt-text-wrap::after {
  content: "";
  position: absolute;
  inset: -4px -8px;
  z-index: 3;
  pointer-events: none;
  background: rgba(218, 199, 126, 0.24);
  border-radius: 4px;
  animation: prompt-overlay-breathe 1.25s ease-in-out infinite alternate;
}"""

target3 = """@keyframes prompt-generation-scan {
  from { top: -44px; }
  to { top: 100%; }
}"""
replacement3 = """@keyframes prompt-overlay-breathe {
  from { opacity: 0.3; }
  to { opacity: 1; }
}"""

if target1 in content:
    content = content.replace(target1, replacement1)
    print("Target 1 found and replaced")
else:
    print("Target 1 not found")

if target2 in content:
    content = content.replace(target2, replacement2)
    print("Target 2 found and replaced")
else:
    print("Target 2 not found")

if target3 in content:
    content = content.replace(target3, replacement3)
    print("Target 3 found and replaced")
else:
    print("Target 3 not found")

with open('app/globals.css', 'w') as f:
    f.write(content)
