import sys

with open('app/globals.css', 'r') as f:
    content = f.read()

target = """.prompt-document-wrap > textarea::selection {
  background: #2f93df;
  color: #fff;
}"""
replacement = """.prompt-document-wrap > textarea::selection {
  background: #2f93df;
  color: #fff;
}

.prompt-document-wrap > textarea.has-active-comment::selection {
  background: transparent;
  color: transparent;
}"""

if target in content:
    with open('app/globals.css', 'w') as f:
        f.write(content.replace(target, replacement))
    print("Patched globals.css successfully")
else:
    print("Target not found")
