import sys

with open('app/globals.css', 'r') as f:
    content = f.read()

target = """  animation: prompt-document-flow 1.8s ease-in-out infinite, prompt-overlay-breathe 1.25s ease-in-out infinite alternate;"""
replacement = """  animation: prompt-document-flow 1.8s ease-in-out infinite;"""

if target in content:
    content = content.replace(target, replacement)
    with open('app/globals.css', 'w') as f:
        f.write(content)
    print("Reverted mark animation successfully")
else:
    print("Target not found")
