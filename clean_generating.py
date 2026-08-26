import sys

with open('app/globals.css', 'r') as f:
    lines = f.readlines()

new_lines = []
skip = False
for line in lines:
    if ".prompt-document-highlight mark.generating {" in line:
        skip = True
    
    if skip and line.strip() == "}":
        skip = False
        continue
    
    if skip:
        continue
    
    new_lines.append(line)

with open('app/globals.css', 'w') as f:
    f.write("".join(new_lines))
print("Cleaned CSS")
