import sys

with open('app/globals.css', 'r') as f:
    content = f.read()

content = content.replace("padding: 5.85px 0;", "padding: 8.625px 0;")
content = content.replace("margin: -5.85px 0;", "margin: -8.625px 0;")

with open('app/globals.css', 'w') as f:
    f.write(content)

print("Fixed padding!")
