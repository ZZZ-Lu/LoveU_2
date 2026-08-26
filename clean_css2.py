import sys

with open('app/globals.css', 'r') as f:
    lines = f.readlines()

new_lines = []
skip = False
for i, line in enumerate(lines):
    if ".prompt-segment.generation-complete .prompt-highlight," in line or ".prompt-segment.generation-complete textarea {" in line or ".prompt-segment.copied" in line or ".prompt-segment textarea {" in line or ".prompt-segment textarea.comment-generation-active::selection {" in line:
        skip = True
    
    if skip and line.strip() == "}":
        skip = False
        continue
    
    if skip:
        continue
    
    new_lines.append(line)

content = "".join(new_lines)
with open('app/globals.css', 'w') as f:
    f.write(content)
