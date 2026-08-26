import sys

with open('app/api/deepseek/route.ts', 'r') as f:
    content = f.read()

target = """    setFinalDebugInput(debugRun.id, finalRawInput);
    completeDebugRun(debugRun.id, finalPrompt);"""

replacement = """    if (body.mode === "selection") {
      const postStarted = Date.now();
      const postSystem = `你是一个专门处理分镜数据的精准文本提取程序。
用户的原始提示词中有一个被选中的片段（选区）<selection>。AI 基于局部修改指令，生成了修改后的内容 <modified>。
因为 AI 倾向于发散，<modified> 中可能不仅包含选区被修改后的结果，还可能多输出了选区前后的相邻未修改的分镜。

请你仔细对比 <selection> 和 <modified>，精确提取出 <modified> 中【真正对应于原 <selection> 范围】的那部分分镜内容。
${allowShotExpansion ? "注意：用户允许在选区内新增分镜，因此你提取的内容可以比原选区多出一些分镜，但你必须丢弃那些明显属于选区前、后边界参照的无关分镜。" : "注意：用户不允许新增分镜，你需要严格保留原选区中存在的分镜范围，丢弃多余的分镜。"}

输出要求：
1. 你的输出将直接替换原剧本中的选区内容，请务必保证上下文逻辑顺畅。
2. 直接输出提取后的最终提示词文本，绝对不要包含任何额外的解释说明、XML 标签或 markdown 格式。`;
      const postInput = `原选区内容：\\n<selection>\\n${clip(body.selectedPromptText)}\\n</selection>\\n\\nAI修改后生成的完整内容：\\n<modified>\\n${finalPrompt}\\n</modified>`;
      
      const postCall = await callDeepSeek(apiKey, [{role: "system", content: postSystem}, {role: "user", content: postInput}], request.signal, true, 0.1);
      if (postCall.rawOutput) {
        finalRawInput = postCall.rawInput;
        finalPrompt = postCall.rawOutput.trim();
        logNode("director_selection_postprocess", postStarted, postCall.rawInput, postCall.rawOutput, {prompt: finalPrompt});
      }
    }

    setFinalDebugInput(debugRun.id, finalRawInput);
    completeDebugRun(debugRun.id, finalPrompt);"""

if target in content:
    content = content.replace(target, replacement)
    with open('app/api/deepseek/route.ts', 'w') as f:
        f.write(content)
    print("Patched route.ts post process successfully")
else:
    print("Target not found")
