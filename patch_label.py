import sys

with open('app/globals.css', 'r') as f:
    content = f.read()

target1 = """.prompt-document-segment-label {
  transition: top 240ms ease-out;
  position: absolute;
  left: -22px;"""
replacement1 = """.prompt-document-segment-label {
  transition: top 240ms ease-out;
  position: absolute;
  left: -28px;
  text-align: left;"""

target2 = """.prompt-document-wrap .prompt-shot-duration-label {
  transition: top 240ms ease-out;
  left: -22px;
  transform: translate(8px, 0);
}"""
replacement2 = """.prompt-document-wrap .prompt-shot-duration-label {
  transition: top 240ms ease-out;
  left: -28px;
  transform: none;
}"""

if target1 in content and target2 in content:
    content = content.replace(target1, replacement1)
    content = content.replace(target2, replacement2)
    with open('app/globals.css', 'w') as f:
        f.write(content)
    print("Patched successfully")
else:
    print("Target 1:", target1 in content)
    print("Target 2:", target2 in content)

