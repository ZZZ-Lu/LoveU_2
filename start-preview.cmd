@echo off
setlocal
cd /d "%~dp0"
set "DEEPSEEK_LOCAL_PROXY_URL=http://127.0.0.1:8788/chat/completions"

echo Starting DeepSeek local proxy...
start "LoveU DeepSeek Proxy" /min cmd /c "node scripts\deepseek-local-proxy.mjs"
timeout /t 1 /nobreak >nul

echo Starting LoveU preview at http://localhost:3000/
echo Keep this window open. Close it to stop the preview.
npx.cmd next dev -p 3000 -H 0.0.0.0
