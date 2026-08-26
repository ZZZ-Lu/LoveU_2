import sys

with open('app/globals.css', 'r') as f:
    content = f.read()

target = """.prompt-document-tools button {
  position: sticky;
  top: 50%;
  z-index: 4;
  display: inline-grid;
  place-items: center;
  height: 26px;
  padding: 0 9px;
  transform: translate(calc(-100% + 8px), -50%);
  border: 1px solid var(--ink);
  background: var(--paper);
  color: var(--ink);
  font-size: 9px;
  line-height: normal;
  pointer-events: auto;
}"""

replacement = """.prompt-document-tools button {
  position: sticky;
  top: 50%;
  z-index: 4;
  display: inline-grid;
  place-items: center;
  height: 26px;
  padding: 0 9px;
  transform: translate(calc(-100% + 8px), -50%);
  border: 1px solid var(--ink);
  background: var(--paper);
  color: var(--ink);
  font-size: 9px;
  line-height: normal;
  pointer-events: auto;
  white-space: nowrap;
}"""

if target in content:
    with open('app/globals.css', 'w') as f:
        f.write(content.replace(target, replacement))
    print("Replaced!")
else:
    print("Not found!")
