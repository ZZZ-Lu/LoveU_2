import sys

with open('app/api/deepseek/route.ts', 'r') as f:
    content = f.read()

target1 = "严禁在输出中擅自增加、切分或合并【分镜】。"
replacement1 = "严禁在输出中擅自增加、切分或合并【分镜】。重要指令：只输出修改的分镜内容，绝不要输出相邻或其它未修改的分镜内容。"

target2 = "不得借推演扩写相邻分镜。\"}输出格式必须且只能是：<analysis>局部意识流推演</analysis><replacement>可直接替换原选区的文字</replacement>。`;"
replacement2 = "不得借推演扩写相邻分镜。\"}重要指令：只输出修改的分镜内容，绝不要输出相邻或其它未修改的分镜内容。输出格式必须且只能是：<analysis>局部意识流推演</analysis><replacement>可直接替换原选区的文字</replacement>。`;"

target3 = "按用户要求在选区中新增分镜，至少新增一个，数量不设上限；不要带入选区之外的原文。\" : \"不得带入其他分镜，必须保留选区原有的分镜标题范围。\"}输出仍严格使用 <analysis>...</analysis><replacement>...</replacement>。`;"
replacement3 = "按用户要求在选区中新增分镜，至少新增一个，数量不设上限；不要带入选区之外的原文。\" : \"不得带入其他分镜，必须保留选区原有的分镜标题范围。\"}重要指令：只输出修改的分镜内容，绝不要输出相邻或其它未修改的分镜内容。输出仍严格使用 <analysis>...</analysis><replacement>...</replacement>。`;"

if target1 in content and target2 in content and target3 in content:
    content = content.replace(target1, replacement1)
    content = content.replace(target2, replacement2)
    content = content.replace(target3, replacement3)
    with open('app/api/deepseek/route.ts', 'w') as f:
        f.write(content)
    print("Patched route.ts successfully")
else:
    print(f"Target 1 found: {target1 in content}")
    print(f"Target 2 found: {target2 in content}")
    print(f"Target 3 found: {target3 in content}")
