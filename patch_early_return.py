import sys

with open('app/api/deepseek/route.ts', 'r') as f:
    content = f.read()

target = """    if (!body.settings?.reviewEnabled) {
      setFinalDebugInput(debugRun.id, draftCall.rawInput);
      completeDebugRun(debugRun.id, draft.prompt);
      return new Response(draft.prompt, {headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        ...(localEditWarning ? {"X-Local-Edit-Warning": encodeURIComponent(localEditWarning)} : {}),
      }});
    }"""

replacement = """    let finalPrompt = draft.prompt;
    let finalRawInput = draftCall.rawInput;

    if (body.settings?.reviewEnabled) {"""

target2 = """    const merged = reviews.reduce((all, review) => ({mustFix: [...all.mustFix, ...review.mustFix], shouldFix: [...all.shouldFix, ...review.shouldFix], optional: [...all.optional, ...review.optional]}), emptyReview());

    let finalPrompt = draft.prompt;
    let finalRawInput = draftCall.rawInput;
    if (merged.mustFix.length || merged.shouldFix.length) {"""

replacement2 = """    const merged = reviews.reduce((all, review) => ({mustFix: [...all.mustFix, ...review.mustFix], shouldFix: [...all.shouldFix, ...review.shouldFix], optional: [...all.optional, ...review.optional]}), emptyReview());

    if (merged.mustFix.length || merged.shouldFix.length) {"""

target3 = """        logNode("review_final", recheckStarted, recheckCall.rawInput, recheckCall.rawOutput, parseReview(recheckCall.rawOutput));
      }
    }"""

replacement3 = """        logNode("review_final", recheckStarted, recheckCall.rawInput, recheckCall.rawOutput, parseReview(recheckCall.rawOutput));
      }
    }
    } // End of reviewEnabled block"""

if target in content and target2 in content and target3 in content:
    content = content.replace(target, replacement)
    content = content.replace(target2, replacement2)
    content = content.replace(target3, replacement3)
    with open('app/api/deepseek/route.ts', 'w') as f:
        f.write(content)
    print("Patched route.ts early return successfully")
else:
    print("Target 1 found:", target in content)
    print("Target 2 found:", target2 in content)
    print("Target 3 found:", target3 in content)
