import sys

with open('app/page.tsx', 'r') as f:
    content = f.read()

target = """  const selectedDurationSeconds = selectedDurationIsCurrent
    ? selected!.shotDurations!.reduce((total, item) => total + Math.max(1, Math.round(item.seconds)), 0)
    : null;"""

replacement = """  const selectedDurationSeconds = useMemo(() => {
    if (!selectedDurationIsCurrent || !selected?.shotDurations?.length) return null;
    
    if (promptSelection && promptSelection.end > promptSelection.start) {
      const marker = /【分镜\s*(\d+)\s*】/g;
      const shotIntervals: Array<{shot: number; start: number; end: number}> = [];
      let match: RegExpExecArray | null;
      let lastShot: number | null = null;
      let lastStart = 0;
      
      while ((match = marker.exec(selected.prompt)) !== null) {
        if (lastShot !== null) {
          shotIntervals.push({shot: lastShot, start: lastStart, end: match.index});
        }
        lastShot = Number(match[1]);
        lastStart = match.index;
      }
      if (lastShot !== null) {
        shotIntervals.push({shot: lastShot, start: lastStart, end: selected.prompt.length});
      }
      
      const overlappingShots = new Set<number>();
      for (const interval of shotIntervals) {
        if (promptSelection.start < interval.end && promptSelection.end > interval.start) {
          overlappingShots.add(interval.shot);
        }
      }
      
      if (overlappingShots.size > 0) {
        return selected.shotDurations
          .filter((item) => overlappingShots.has(item.shot))
          .reduce((total, item) => total + Math.max(1, Math.round(item.seconds)), 0);
      }
    }
    
    return selected.shotDurations.reduce((total, item) => total + Math.max(1, Math.round(item.seconds)), 0);
  }, [selectedDurationIsCurrent, selected?.shotDurations, selected?.prompt, promptSelection]);"""

if target in content:
    content = content.replace(target, replacement)
    with open('app/page.tsx', 'w') as f:
        f.write(content)
    print("Updated duration logic")
else:
    print("Target not found")
