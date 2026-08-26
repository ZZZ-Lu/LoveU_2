import sys

with open('app/globals.css', 'r') as f:
    content = f.read()

content = content.replace("background-color: transparent;", "background-color: rgba(186, 209, 200, 0);")

with open('app/globals.css', 'w') as f:
    f.write(content)

print("Fixed animation start color!")
