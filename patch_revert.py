import sys

with open('app/page.tsx', 'r') as f:
    content = f.read()

target = """    if (!entry) {
      setGenerationStage("片段边界已保留；请在单个片段内直接编辑");
      requestAnimationFrame(() => {
        const textarea = promptDocumentRef.current;
        if (!textarea) return;
        textarea.value = previousText;
      });
      return;
    }"""

replacement = """    if (!entry) {
      setGenerationStage("片段边界已保留；请在单个片段内直接编辑");
      requestAnimationFrame(() => {
        const textarea = promptDocumentRef.current;
        if (!textarea) return;
        textarea.value = previousText;
        if (selectionStart !== undefined) {
          const lengthDiff = nextText.length - previousText.length;
          const restoredCaret = lengthDiff > 0 ? selectionStart - lengthDiff : selectionStart;
          textarea.setSelectionRange(restoredCaret, restoredCaret);
        }
      });
      return;
    }"""

if target in content:
    with open('app/page.tsx', 'w') as f:
        f.write(content.replace(target, replacement))
    print("Patched revert block successfully")
else:
    print("Target not found")
