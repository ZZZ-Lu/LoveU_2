import sys

with open('app/globals.css', 'r') as f:
    content = f.read()

content = content.replace("transform: translateY(4px);", "transform: translateY(0);")
content = content.replace("transform: translate(8px, 4px);", "transform: translate(8px, 0);")

with open('app/globals.css', 'w') as f:
    f.write(content)

print("Fixed!")
