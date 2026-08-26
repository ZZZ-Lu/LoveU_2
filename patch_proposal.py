import sys

with open('app/globals.css', 'r') as f:
    content = f.read()

# Replace the background color of is-proposal to the new green
content = content.replace("background: #bad1c8;", "background: rgba(126, 218, 141, 0.32);")
content = content.replace("background-color: #bad1c8;", "background-color: rgba(126, 218, 141, 0.32);")
content = content.replace("background-color: rgba(186, 209, 200, 0);", "background-color: rgba(126, 218, 141, 0);")

# Update padding and margin for is-proposal in .prompt-document-highlight
target_css = """.prompt-document-highlight .comment-selection.is-proposal {
  background: rgba(126, 218, 141, 0.32);
  color: var(--ink);
  animation: comment-proposal-enter 520ms ease-out;
}"""

replacement_css = """.prompt-document-highlight .comment-selection.is-proposal {
  background: rgba(126, 218, 141, 0.32);
  color: var(--ink);
  padding: 3px 0;
  margin: 0;
  border-radius: 2px;
  animation: comment-proposal-enter 520ms ease-out;
}"""

content = content.replace(target_css, replacement_css)

# Update the same for .prompt-highlight if it exists
target_css2 = """.prompt-highlight .comment-selection.is-proposal {
  background: rgba(126, 218, 141, 0.32);
  box-shadow: none;
  animation: comment-proposal-enter 520ms ease-out;
}"""

replacement_css2 = """.prompt-highlight .comment-selection.is-proposal {
  background: rgba(126, 218, 141, 0.32);
  box-shadow: none;
  padding: 3px 0;
  margin: 0;
  border-radius: 2px;
  animation: comment-proposal-enter 520ms ease-out;
}"""

content = content.replace(target_css2, replacement_css2)

with open('app/globals.css', 'w') as f:
    f.write(content)

print("Fixed proposal style!")
