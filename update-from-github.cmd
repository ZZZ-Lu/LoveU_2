@echo off
setlocal
set "PROJECT=C:\Users\Administrator\Documents\Codex\2026-07-15\ai-agent-21-1-1-2"
cd /d "%PROJECT%"

echo Updating LoveU from GitHub...
git pull --ff-only origin main
if errorlevel 1 goto :error

echo.
echo Update complete.
git log -3 --oneline
pause
exit /b 0

:error
echo.
echo Update failed. No local files were overwritten.
echo Keep this window open and send the message above to Codex.
pause
exit /b 1
