import sys

with open('app/page.tsx', 'r') as f:
    content = f.read()

target = """                <div className="prompt-document-meta" aria-hidden>"""
replacement = """                <div className="prompt-document-overlays" aria-hidden>
                  {promptLayout.entries.map(({segment}, index) => {
                    const isComplete = completedGenerationId === segment.id;
                    if (!isComplete) return null;
                    const top = promptSegmentTops[segment.id] || 0;
                    const nextTop = index < promptLayout.entries.length - 1 ? promptSegmentTops[promptLayout.entries[index + 1].segment.id] : undefined;
                    const height = nextTop !== undefined ? nextTop - top : `calc(100% - ${top}px)`;
                    return (
                      <div key={`${segment.id}-curtain`} className="prompt-generation-reveal-curtain" style={{top, height}} />
                    );
                  })}
                </div>

                <div className="prompt-document-meta" aria-hidden>"""

if target in content:
    content = content.replace(target, replacement)
    with open('app/page.tsx', 'w') as f:
        f.write(content)
    print("Added overlays in page.tsx")
else:
    print("Target not found")
