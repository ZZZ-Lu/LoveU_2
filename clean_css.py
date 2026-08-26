import sys

with open('app/globals.css', 'r') as f:
    lines = f.readlines()

new_lines = []
skip = False
for i, line in enumerate(lines):
    if ".prompt-segment.generating.has-content textarea {" in line or ".prompt-segment.generating.has-content .prompt-text-wrap::after {" in line or ".prompt-segment.generating.is-empty .prompt-text-wrap {" in line or ".prompt-segment.generating.is-empty textarea," in line:
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
