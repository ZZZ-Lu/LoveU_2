@echo off
setlocal
set "PROJECT=C:\Users\Administrator\Documents\Codex\2026-07-15\ai-agent-21-1-1-2"
cd /d "%PROJECT%"

echo Reading the latest LoveU version from GitHub...
git config user.name "ZZZ-Lu"
git config user.email "ZZZ-Lu@users.noreply.github.com"
git fetch origin main
if errorlevel 1 goto :error

echo Preparing current project on top of origin/main...
git reset --soft origin/main
if errorlevel 1 goto :error
git add -A

git diff --cached --quiet
if errorlevel 1 (
  git commit -m "feat: update prompt testing and generation workflow"
  if errorlevel 1 goto :error
) else (
  echo No new local changes need committing.
)

echo.
echo Pushing to GitHub: ZZZ-Lu/LoveU main...
git push origin main
if errorlevel 1 goto :error

echo.
echo Upload complete.
echo https://github.com/ZZZ-Lu/LoveU
pause
exit /b 0

:error
echo.
echo Upload failed. Keep this window open and send the error message to Codex.
pause
exit /b 1
