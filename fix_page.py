import sys

with open('app/page.tsx', 'r') as f:
    content = f.read()

target = """                <div className="prompt-document-overlays" aria-hidden>
                  {promptLayout.entries.map(({segment}, index) => {
                    const segmentIsGenerating = generatingId === segment.id;
                    if (!segmentIsGenerating || !selected?.prompt.trim()) return null;
                    const top = promptSegmentTops[segment.id] || 0;
                    const nextTop = index < promptLayout.entries.length - 1 ? promptSegmentTops[promptLayout.entries[index + 1].segment.id] : undefined;
                    const height = nextTop !== undefined ? nextTop - top : `calc(100% - ${top}px)`;
                    return (
                      <div key={`${segment.id}-overlay`} className="prompt-generation-overlay" style={{top, height}} />
                    );
                  })}
                </div>

                <div className="prompt-document-tools">"""
replacement = """                <div className="prompt-document-tools">"""

if target in content:
    content = content.replace(target, replacement)
    with open('app/page.tsx', 'w') as f:
        f.write(content)
    print("Reverted page overlays")
else:
    print("Target not found in page.tsx")
