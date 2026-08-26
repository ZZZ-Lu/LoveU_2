import sys

with open('app/globals.css', 'r') as f:
    content = f.read()

target = """@keyframes prompt-generation-reveal {
  from { opacity: 0; clip-path: inset(0 0 100% 0); }
  to { opacity: 1; clip-path: inset(0); }
}"""
replacement = """@keyframes prompt-generation-reveal {
  from { opacity: 0; clip-path: inset(0 0 100% 0); }
  to { opacity: 1; clip-path: inset(0); }
}

@keyframes prompt-curtain-reveal {
  from { transform: scaleY(1); opacity: 1; }
  to { transform: scaleY(0); opacity: 0.1; }
}"""

if target in content:
    content = content.replace(target, replacement)
    with open('app/globals.css', 'w') as f:
        f.write(content)
    print("Added curtain keyframe")
else:
    print("Target not found")
