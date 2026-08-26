import sys

with open('app/globals.css', 'r') as f:
    content = f.read()

target1 = """.prompt-document-wrap .prompt-shot-duration-label {
  transition: top 240ms ease-out;
  left: -22px;
  transform: translate(8px, 7px);
}"""

replacement1 = """.prompt-document-wrap .prompt-shot-duration-label {
  transition: top 240ms ease-out;
  left: -22px;
  transform: translate(8px, 9px);
}"""

if target1 in content:
    content = content.replace(target1, replacement1)
    print("Replaced target1")
else:
    print("target1 not found")

target2 = """.prompt-document-segment-label {
  transition: top 240ms ease-out;
  position: absolute;
  left: -22px;
  display: grid;
  width: 54px;
  gap: 2px;
  color: var(--muted);
  transform: translateY(7px);
  white-space: nowrap;
}"""

replacement2 = """.prompt-document-segment-label {
  transition: top 240ms ease-out;
  position: absolute;
  left: -22px;
  display: grid;
  width: 54px;
  gap: 2px;
  color: var(--muted);
  transform: translateY(9px);
  white-space: nowrap;
}"""

if target2 in content:
    content = content.replace(target2, replacement2)
    print("Replaced target2")
else:
    print("target2 not found")

with open('app/globals.css', 'w') as f:
    f.write(content)
