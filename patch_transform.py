import sys

with open('app/globals.css', 'r') as f:
    content = f.read()

target = """.prompt-document-wrap .prompt-shot-duration-label {
  transition: top 240ms ease-out;
  left: -22px;
  transform: translate(8px, 16px);
}"""

replacement = """.prompt-document-wrap .prompt-shot-duration-label {
  transition: top 240ms ease-out;
  left: -22px;
  transform: translate(8px, 2px);
}"""

if target in content:
    content = content.replace(target, replacement)
    print("Replaced!")
else:
    print("Not found!")

with open('app/globals.css', 'w') as f:
    f.write(content)
