import sys

with open('app/api/deepseek/route.ts', 'r') as f:
    content = f.read()

target = '保持原选区的功能、粒度和分镜范围。若原选区没有【分镜】标题，不得新增标题；若有，标题数量不得增加。'
replacement = '保持原选区的功能、粒度和分镜范围。若原选区没有【分镜】标题，不得新增标题；若有，标题数量不得增加。严禁在输出中擅自增加、切分或合并【分镜】。'

if target in content:
    with open('app/api/deepseek/route.ts', 'w') as f:
        f.write(content.replace(target, replacement))
    print("Patched route.ts successfully")
else:
    print("Target not found in route.ts")
