import sys

with open('app/globals.css', 'r') as f:
    content = f.read()

target1 = """
.prompt-document-highlight .comment-selection.is-generating {
  background: rgba(255, 244, 185, 0.76);
  -webkit-backdrop-filter: blur(1.15px);
  backdrop-filter: blur(1.15px);
"""

replacement1 = """
.prompt-document-highlight .comment-selection.is-generating {
  background: rgba(255, 244, 185, 0.76);
  color: var(--ink);
  -webkit-backdrop-filter: blur(1.15px);
  backdrop-filter: blur(1.15px);
"""

target2 = """
.prompt-document-highlight .comment-selection.is-proposal {
  background: rgba(111, 159, 141, .48);
  animation: comment-proposal-enter 520ms ease-out;
}
"""

replacement2 = """
.prompt-document-highlight .comment-selection.is-proposal {
  background: rgba(111, 159, 141, .48);
  color: var(--ink);
  animation: comment-proposal-enter 520ms ease-out;
}
"""

if target1 in content:
    content = content.replace(target1, replacement1)
if target2 in content:
    content = content.replace(target2, replacement2)

with open('app/globals.css', 'w') as f:
    f.write(content)

print("Fixed!")
