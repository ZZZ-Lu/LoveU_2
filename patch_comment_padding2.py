import sys

with open('app/globals.css', 'r') as f:
    content = f.read()

target1 = """.prompt-document-highlight .comment-selection {
  background: #2f93df;
  color: #fff;
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
}"""

replacement1 = """.prompt-document-highlight .comment-selection {
  padding: 8px 0;
  margin: -8px 0;
  background: #2f93df;
  color: #fff;
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
}"""

if target1 in content:
    content = content.replace(target1, replacement1)
    print("Replaced target1")
else:
    print("target1 not found")

target2 = """.prompt-highlight .comment-selection {
  background: #2f93df;
  box-shadow: none;
  color: transparent;
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
  animation: comment-selection-enter 260ms ease-out;
}"""

replacement2 = """.prompt-highlight .comment-selection {
  padding: 8px 0;
  margin: -8px 0;
  background: #2f93df;
  box-shadow: none;
  color: transparent;
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
  animation: comment-selection-enter 260ms ease-out;
}"""

if target2 in content:
    content = content.replace(target2, replacement2)
    print("Replaced target2")
else:
    print("target2 not found")


with open('app/globals.css', 'w') as f:
    f.write(content)
