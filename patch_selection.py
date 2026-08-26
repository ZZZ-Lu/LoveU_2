import sys

with open('app/api/deepseek/route.ts', 'r') as f:
    content = f.read()

target_task = "    const task = body.mode === \"selection\"\n      ? `执行一次精准的局部替换。只有 <selection> 内的文字允许改变，<before> 与 <after> 只是边界参照，严禁复述或改写。\\n\\n<before>\\n${clip(body.selectionPrefix, 500)}\\n</before>\\n\\n<selection>\\n${clip(body.selectedPromptText)}\\n</selection>\\n\\n<after>\\n${clip(body.selectionSuffix, 500)}\\n</after>\\n\\n<comment>\\n${clip(body.editInstruction)}\\n</comment>\\n\\n先像导演一样在脑中连续播放选区前、选区和选区后的画面，围绕用户批注进行局部意识流推演：检查动作承接、人物位置、朝向、视线、情绪和运镜是否顺畅；可以推翻自己的初步想法，但不得复述或改写 <before>、<after>。想清楚后再给出替换文本。${allowShotExpansion ? \"用户明确要求改变分镜结构，可以在选区位置新增任意数量的【分镜】；完整返回修改后的选区及新增分镜，分镜编号稍后由程序统一整理。\" : \"保持原选区的功能、粒度和分镜范围。若原选区没有【分镜】标题，不得新增标题；若有，标题数量不得增加。严禁在输出中擅自增加、切分或合并【分镜】。重要指令：只输出修改的分镜内容，绝不要输出相邻或其它未修改的分镜内容。\"}`\n      : body.mode === \"improve\" ? `在现有提示词基础上重新想象并改进：\\n${clip(body.existingPrompt)}` : \"从头想象并撰写这个片段的视频提示词。\";"

replacement_task = "    const task = body.mode === \"selection\"\n      ? `执行一次精准的局部修改推演。针对 <selection> 内的文字进行修改，<before> 与 <after> 只是边界参照。\\n\\n<before>\\n${clip(body.selectionPrefix, 500)}\\n</before>\\n\\n<selection>\\n${clip(body.selectedPromptText)}\\n</selection>\\n\\n<after>\\n${clip(body.selectionSuffix, 500)}\\n</after>\\n\\n<comment>\\n${clip(body.editInstruction)}\\n</comment>\\n\\n先像导演一样在脑中连续播放选区前、选区和选区后的画面，围绕用户批注进行局部意识流推演：检查动作承接、人物位置、朝向、视线、情绪和运镜是否顺畅；想清楚后再给出修改结果。`\n      : body.mode === \"improve\" ? `在现有提示词基础上重新想象并改进：\\n${clip(body.existingPrompt)}` : \"从头想象并撰写这个片段的视频提示词。\";"

target_gate = "    const localEditGate = `你正在执行有边界的导演式局部修改。必须先进行自然连续的局部意识流推演，再给出替换结果。推演只讨论怎样落实批注并与前后画面顺畅衔接；不得复述边界参照。${allowShotExpansion ? \"本次允许按用户要求在选区中新增任意数量的分镜，但不能带入选区之外的原文。\" : \"不得借推演扩写相邻分镜。\"}重要指令：只输出修改的分镜内容，绝不要输出相邻或其它未修改的分镜内容。输出格式必须且只能是：<analysis>局部意识流推演</analysis><replacement>可直接替换原选区的文字</replacement>。`;"
replacement_gate = "    const localEditGate = `你正在执行有边界的导演式局部修改。必须先进行自然连续的局部意识流推演，再给出修改结果。输出格式必须且只能是：<analysis>局部意识流推演</analysis><replacement>修改后的分镜提示词</replacement>。`;"

target_retry = "          const retryInstruction = `上一次输出不符合局部修改范围。请重新完成同一修改，只返回可直接替换 <selection> 的文字。不得复述 <before> 或 <after>。${allowShotExpansion ? \"按用户要求在选区中新增分镜，至少新增一个，数量不设上限；不要带入选区之外的原文。\" : \"不得带入其他分镜，必须保留选区原有的分镜标题范围。\"}重要指令：只输出修改的分镜内容，绝不要输出相邻或其它未修改的分镜内容。输出仍严格使用 <analysis>...</analysis><replacement>...</replacement>。`;"
replacement_retry = "          const retryInstruction = `上一次输出不符合局部修改格式。请重新输出，严格使用 <analysis>...</analysis><replacement>...</replacement>。`;"

if target_task in content and target_gate in content:
    content = content.replace(target_task, replacement_task)
    content = content.replace(target_gate, replacement_gate)
    content = content.replace(target_retry, replacement_retry)
    with open('app/api/deepseek/route.ts', 'w') as f:
        f.write(content)
    print("Patched route.ts initial successfully")
else:
    print("Task target found:", target_task in content)
    print("Gate target found:", target_gate in content)
