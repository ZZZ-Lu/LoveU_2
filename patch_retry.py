import sys
with open('app/api/deepseek/route.ts', 'r') as f:
    content = f.read()

# Let's check what's going on around the try-catch block for parseSelectionOutput
