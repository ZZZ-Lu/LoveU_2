import sys

with open('app/page.tsx', 'r') as f:
    content = f.read()

target1 = """  const updatePromptDocument = (nextText: string) => {
    const previousText = promptLayout.text;
    if (nextText === previousText) return;
    let prefix = 0;
    while (
      prefix < previousText.length &&
      prefix < nextText.length &&
      previousText[prefix] === nextText[prefix]
    ) prefix += 1;"""

replacement1 = """  const updatePromptDocument = (nextText: string, selectionStart?: number) => {
    const previousText = promptLayout.text;
    if (nextText === previousText) return;
    let prefix = 0;
    while (
      prefix < previousText.length &&
      prefix < nextText.length &&
      previousText[prefix] === nextText[prefix]
    ) prefix += 1;
    
    if (selectionStart !== undefined) {
      const lengthDiff = nextText.length - previousText.length;
      if (lengthDiff > 0) {
        prefix = Math.min(prefix, selectionStart - lengthDiff);
      } else {
        prefix = Math.min(prefix, selectionStart);
      }
    }"""

target2 = """                  onChange={(event) => updatePromptDocument(event.target.value)}"""
replacement2 = """                  onChange={(event) => updatePromptDocument(event.target.value, event.target.selectionStart ?? undefined)}"""

if target1 in content and target2 in content:
    content = content.replace(target1, replacement1)
    content = content.replace(target2, replacement2)
    with open('app/page.tsx', 'w') as f:
        f.write(content)
    print("Patched successfully")
else:
    print("Target not found")
