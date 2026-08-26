import sys

with open('app/globals.css', 'r') as f:
    content = f.read()

target1 = """.prompt-document-highlight .comment-selection {
  padding: 3px 0;
  border-radius: 2px;
  background: #2f93df;
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
}"""

replacement1 = """.prompt-document-highlight .comment-selection {
  padding: 3px 0;
  border-radius: 2px;
  background: #2f93df;
  color: #fff;
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
}"""

if target1 in content:
    content = content.replace(target1, replacement1)
    print("Replaced comment-selection")
else:
    print("target1 not found")

target2 = """.prompt-document-wrap > textarea {
  position: relative;
  z-index: 1;
  field-sizing: content;
  overflow: hidden;
  resize: none;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--ink);
  font-family: inherit;
  font-size: 13px;
  line-height: 1.9;
}"""

replacement2 = """.prompt-document-wrap > textarea {
  position: relative;
  z-index: 1;
  field-sizing: content;
  overflow: hidden;
  resize: none;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--ink);
  font-family: inherit;
  font-size: 13px;
  line-height: 1.9;
}

.prompt-document-wrap > textarea.comment-active {
  color: transparent;
  caret-color: transparent;
}"""

if target2 in content:
    content = content.replace(target2, replacement2)
    print("Replaced textarea comment-active")
else:
    print("target2 not found")


with open('app/globals.css', 'w') as f:
    f.write(content)
