import sys

with open('app/globals.css', 'r') as f:
    content = f.read()

target = """@media (prefers-reduced-motion: reduce) {
  .prompt-shot-skeleton span,
  .prompt-document-highlight mark.generating,
  .prompt-document-highlight .comment-selection.is-generating,
  .prompt-highlight .comment-selection.is-generating {"""
replacement = """@media (prefers-reduced-motion: reduce) {
  .prompt-shot-skeleton span,
  .prompt-document-highlight .comment-selection.is-generating,
  .prompt-highlight .comment-selection.is-generating {"""

if target in content:
    content = content.replace(target, replacement)
    with open('app/globals.css', 'w') as f:
        f.write(content)
    print("Fixed media query")
else:
    print("Target not found")
