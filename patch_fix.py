import sys

with open('app/globals.css', 'r') as f:
    content = f.read()

# Fix padding for comment-selection
content = content.replace("padding: 8.6px 0;\n  margin: -8.6px 0;", "padding: 5.85px 0;\n  margin: -5.85px 0;")
content = content.replace("padding: 8px 0;\n  margin: -8px 0;", "padding: 5.85px 0;\n  margin: -5.85px 0;")

# Fix transform for labels
content = content.replace("transform: translateY(9px);", "transform: translateY(4px);")
content = content.replace("transform: translateY(7px);", "transform: translateY(4px);")
content = content.replace("transform: translate(8px, 9px);", "transform: translate(8px, 4px);")
content = content.replace("transform: translate(8px, 7px);", "transform: translate(8px, 4px);")

with open('app/globals.css', 'w') as f:
    f.write(content)

print("Fixed!")
