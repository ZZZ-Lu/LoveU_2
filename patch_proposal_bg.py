import sys

with open('app/globals.css', 'r') as f:
    content = f.read()

content = content.replace("background: rgba(111, 159, 141, .48);", "background: #bad1c8;")
content = content.replace("background-color: rgba(111, 159, 141, .48);", "background-color: #bad1c8;")
content = content.replace("background-color: rgba(111, 159, 141, .08);", "background-color: transparent;")

with open('app/globals.css', 'w') as f:
    f.write(content)

print("Fixed background!")
