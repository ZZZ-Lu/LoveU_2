import sys

with open('app/page.tsx', 'r') as f:
    content = f.read()

target = """                        <mark
                          className={[
                            segment.id === selectedId ? "selected" : "",
                            copiedSegmentId === segment.id ? "copied" : "",
                            generatingId === segment.id ? "generating" : "",
                            completedGenerationId === segment.id ? "generation-complete" : "",
                          ].filter(Boolean).join(" ")}
                        >
                          {segmentComment ? (
                            <>
                              {shownPrompt.slice(0, shownStart)}
                              <span className={[
                                "comment-selection",
                                segmentComment.status === "generating" ? "is-generating" : "",
                                segmentComment.status === "review" ? "is-proposal" : "",
                              ].filter(Boolean).join(" ")}>{shownSelection}</span>
                              {shownPrompt.slice(shownEnd)}
                            </>
                          ) : segment.prompt}
                        </mark>"""

replacement = """                        <mark
                          className={[
                            segment.id === selectedId ? "selected" : "",
                            copiedSegmentId === segment.id ? "copied" : "",
                            completedGenerationId === segment.id ? "generation-complete" : "",
                          ].filter(Boolean).join(" ")}
                        >
                          {segmentComment ? (
                            <>
                              {shownPrompt.slice(0, shownStart)}
                              <span className={[
                                "comment-selection",
                                segmentComment.status === "generating" ? "is-generating" : "",
                                segmentComment.status === "review" ? "is-proposal" : "",
                              ].filter(Boolean).join(" ")}>{shownSelection}</span>
                              {shownPrompt.slice(shownEnd)}
                            </>
                          ) : generatingId === segment.id && segment.prompt ? (
                            <span className="comment-selection is-generating">{segment.prompt}</span>
                          ) : segment.prompt}
                        </mark>"""

if target in content:
    content = content.replace(target, replacement)
    with open('app/page.tsx', 'w') as f:
        f.write(content)
    print("Patched page.tsx")
else:
    print("Target not found in page.tsx")
