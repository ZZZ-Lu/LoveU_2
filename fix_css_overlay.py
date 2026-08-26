import sys

with open('app/globals.css', 'r') as f:
    lines = f.readlines()

new_lines = []
skip = False
for line in lines:
    if ".prompt-document-meta," in line and ".prompt-document-tools," in line and ".prompt-document-overlays {" in line:
        pass
    if ".prompt-generation-overlay {" in line:
        skip = True
    
    if skip and line.strip() == "}":
        skip = False
        continue
    
    if skip:
        continue
    
    new_lines.append(line)

content = "".join(new_lines).replace(".prompt-document-meta,\n.prompt-document-tools,\n.prompt-document-overlays {", ".prompt-document-meta,\n.prompt-document-tools {")
with open('app/globals.css', 'w') as f:
    f.write(content)
