import sys

with open('app/page.tsx', 'r') as f:
    content = f.read()

target = """                <div className="prompt-document-meta" aria-hidden>
                  {promptLayout.entries.map(({segment}) => {
                    const top = promptSegmentTops[segment.id] || 0;
                    const segmentIsGenerating = generatingId === segment.id;
                    return (
                      <span className="prompt-document-segment-label" style={{top}} key={`${segment.id}-label`}>
                        <b>{segment.title}</b>
                        {segmentIsGenerating && <small>{generationStage}</small>}
                      </span>
                    );
                  })}
                  {promptLayout.entries.flatMap(({segment}) =>
                    (shotDurationLabelTops[segment.id] || []).map(({shot, top}, occurrenceIndex) => {
                      const seconds = segment.shotDurations?.find((item) => item.shot === shot)?.seconds;
                      if (!seconds) return [];
                      return [(
                        <span className="prompt-shot-duration-label" style={{top}} key={`${segment.id}-duration-${shot}-${occurrenceIndex}`}>
                          <b>分镜 {String(shot).padStart(2, "0")}</b>
                          <small>约 {Math.max(1, Math.round(seconds))} 秒</small>
                        </span>
                      )];
                    }),
                  )}
                </div>

                <div className="prompt-document-tools">
                  {promptLayout.entries.map(({segment}) => {
                    const segmentIsGenerating = generatingId === segment.id;
                    const top = promptSegmentTops[segment.id] || 0;
                    return (
                      <button
                        style={{top}}
                        key={`${segment.id}-copy`}
                        disabled={!segment.prompt || segmentIsGenerating}
                        onMouseDown={(event) => event.stopPropagation()}
                        onClick={async (event) => {
                          event.stopPropagation();
                          await navigator.clipboard.writeText(segment.prompt);
                          setCopiedSegmentId(segment.id);
                          window.setTimeout(() => setCopiedSegmentId((current) => current === segment.id ? "" : current), 1200);
                        }}
                      >
                        {segmentIsGenerating ? "生成中" : copiedSegmentId === segment.id ? "已复制" : "复制"}
                      </button>
                    );
                  })}
                </div>"""

replacement = """                <div className="prompt-document-meta" aria-hidden>
                  {promptLayout.entries.map(({segment}, index) => {
                    const top = promptSegmentTops[segment.id] || 0;
                    const segmentIsGenerating = generatingId === segment.id;
                    const nextTop = index < promptLayout.entries.length - 1 ? promptSegmentTops[promptLayout.entries[index + 1].segment.id] : undefined;
                    const height = nextTop !== undefined ? nextTop - top : `calc(100% - ${top}px)`;
                    return (
                      <div key={`${segment.id}-label-wrap`} className="prompt-segment-label-wrap" style={{top, height}}>
                        <span className="prompt-document-segment-label">
                          <b>{segment.title}</b>
                          {segmentIsGenerating && <small>{generationStage}</small>}
                        </span>
                      </div>
                    );
                  })}
                  {promptLayout.entries.flatMap(({segment}) =>
                    (shotDurationLabelTops[segment.id] || []).map(({shot, top}, occurrenceIndex) => {
                      const seconds = segment.shotDurations?.find((item) => item.shot === shot)?.seconds;
                      if (!seconds) return [];
                      return [(
                        <span className="prompt-shot-duration-label" style={{top}} key={`${segment.id}-duration-${shot}-${occurrenceIndex}`}>
                          <b>分镜 {String(shot).padStart(2, "0")}</b>
                          <small>约 {Math.max(1, Math.round(seconds))} 秒</small>
                        </span>
                      )];
                    }),
                  )}
                </div>

                <div className="prompt-document-tools">
                  {promptLayout.entries.map(({segment}, index) => {
                    const segmentIsGenerating = generatingId === segment.id;
                    const top = promptSegmentTops[segment.id] || 0;
                    const nextTop = index < promptLayout.entries.length - 1 ? promptSegmentTops[promptLayout.entries[index + 1].segment.id] : undefined;
                    const height = nextTop !== undefined ? nextTop - top : `calc(100% - ${top}px)`;
                    return (
                      <div key={`${segment.id}-copy-wrap`} className="prompt-segment-tool-wrap" style={{top, height}}>
                        <button
                          disabled={!segment.prompt || segmentIsGenerating}
                          onMouseDown={(event) => event.stopPropagation()}
                          onClick={async (event) => {
                            event.stopPropagation();
                            await navigator.clipboard.writeText(segment.prompt);
                            setCopiedSegmentId(segment.id);
                            window.setTimeout(() => setCopiedSegmentId((current) => current === segment.id ? "" : current), 1200);
                          }}
                        >
                          {segmentIsGenerating ? "生成中" : copiedSegmentId === segment.id ? "已复制" : "复制"}
                        </button>
                      </div>
                    );
                  })}
                </div>"""

if target in content:
    with open('app/page.tsx', 'w') as f:
        f.write(content.replace(target, replacement))
    print("Replaced!")
else:
    print("Not found!")
