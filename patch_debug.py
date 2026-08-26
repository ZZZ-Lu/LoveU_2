import sys

with open('app/debug/page.tsx', 'r') as f:
    content = f.read()

target = 'const nodeName: Record<string, string> = {director_draft: "Few-shot导演初稿", review_fidelity: "剧本忠实度验收", review_rhythm: "镜头节奏验收", review_visual: "画面连续性验收", director_revision: "Few-shot导演修改", review_final: "最终复验"};'
replacement = 'const nodeName: Record<string, string> = {director_draft: "Few-shot导演初稿", review_fidelity: "剧本忠实度验收", review_rhythm: "镜头节奏验收", review_visual: "画面连续性验收", director_revision: "Few-shot导演修改", review_final: "最终复验", director_selection_postprocess: "后置分镜提取", director_selection_out_of_bounds: "初稿越界重试"};'

if target in content:
    with open('app/debug/page.tsx', 'w') as f:
        f.write(content.replace(target, replacement))
    print("Patched debug/page.tsx successfully")
else:
    print("Target not found")
