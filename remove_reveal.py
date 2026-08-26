import sys

with open('app/globals.css', 'r') as f:
    content = f.read()

target = """.prompt-document-highlight mark.generation-complete {
  animation: prompt-generation-reveal 720ms ease-out;
}"""
replacement = """.prompt-document-highlight mark.generation-complete {
  /* animation handled by overlay curtain */
}"""

if target in content:
    content = content.replace(target, replacement)
    with open('app/globals.css', 'w') as f:
        f.write(content)
    print("Removed reveal animation on mark")
else:
    print("Target not found")
