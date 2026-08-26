import sys

with open('app/globals.css', 'r') as f:
    content = f.read()

target = """@media (prefers-reduced-motion: reduce) {
  .prompt-shot-skeleton span,
  .prompt-segment.generating.has-content .prompt-text-wrap::after,
  .prompt-highlight .comment-selection.is-generating,
}"""
replacement = """@media (prefers-reduced-motion: reduce) {
  .prompt-shot-skeleton span,
  .prompt-highlight .comment-selection.is-generating,
  .prompt-generation-overlay {
    animation: none !important;
  }
}"""

if target in content:
    content = content.replace(target, replacement)
    with open('app/globals.css', 'w') as f:
        f.write(content)
    print("Fixed media query")
else:
    print("Target not found")
