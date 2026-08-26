import sys

with open('app/api/deepseek/route.ts', 'r') as f:
    content = f.read()

target = """      const postSystem = `你是一个专门处理分镜数据的精准文本提取程序。
用户的原始提示词中有一个被选中的片段（选区）<selection>，以及相邻的 <before> 和 <after> 作为上下文。
AI 基于用户的修改指令 <comment>，生成了修改后的内容 <modified>。
因为 AI 倾向于发散，<modified> 中不仅包含选区被修改后的结果，还常常错误地把 <before> 或 <after> 里的未修改分镜也输出了一遍。

请你结合上下文和用户的修改指令，仔细对比 <selection> 和 <modified>，精确提取出 <modified> 中【真正对应于原 <selection> 范围及其修改目标】的那部分分镜内容。
${allowShotExpansion ? "注意：用户指令可能要求新增分镜，因此你提取的内容可以比原选区多出一些分镜，但你必须严格剔除那些明显属于 <before> 或 <after> 的相邻分镜。" : "注意：用户不允许新增分镜，你需要严格保留原选区中存在的分镜范围，丢弃多余的分镜。"}

输出要求：
1. 你的输出将直接替换原剧本中的选区内容，请务必保证上下文逻辑顺畅。
2. 直接输出提取后的最终提示词文本，绝对不要包含任何额外的解释说明、XML 标签或 markdown 格式。`;"""

replacement = """      const postSystem = `你是一个专门处理分镜数据的精准文本提取程序。
用户的原始提示词中有一个被选中的片段（选区）<selection>，以及相邻的 <before> 和 <after> 作为上下文。
AI 基于用户的修改指令 <comment>，生成了修改后的内容 <modified>。
因为 AI 倾向于发散，<modified> 中不仅包含选区被修改后的结果，还常常错误地把 <before> 或 <after> 里的未修改分镜也输出了一遍。

请你结合上下文和用户的修改指令，仔细对比 <selection> 和 <modified>，精确提取出 <modified> 中【真正对应于原 <selection> 范围及其修改目标】的那部分分镜内容。分镜数量的增加或减少都是有可能的，但你必须严格剔除那些明显属于 <before> 或 <after> 的相邻未修改分镜。

输出要求：
1. 你的输出将直接替换原剧本中的选区内容，请务必保证上下文逻辑顺畅。
2. 直接输出提取后的最终提示词文本，绝对不要包含任何额外的解释说明、XML 标签或 markdown 格式。`;"""

if target in content:
    content = content.replace(target, replacement)
    with open('app/api/deepseek/route.ts', 'w') as f:
        f.write(content)
    print("Patched route.ts successfully")
else:
    print("Target not found")
