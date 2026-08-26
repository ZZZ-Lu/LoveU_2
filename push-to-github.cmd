@echo off
setlocal
cd /d "%~dp0"

echo Project directory:
cd
echo.
echo Pushing main to GitHub...
echo.

set "GIT_PROXY="
for /f "usebackq delims=" %%P in (`powershell -NoProfile -Command "$p = Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings'; if ($p.ProxyEnable -eq 1) { $p.ProxyServer }"`) do set "GIT_PROXY=%%P"

if defined GIT_PROXY (
  echo Using Windows proxy: %GIT_PROXY%
) else (
  echo No Windows proxy detected. Using direct connection.
)

git credential-manager github list | findstr /r "." >nul
if errorlevel 1 (
  echo.
  echo GitHub login is required.
  echo A browser login window will open. Complete the authorization there.
  echo.
  git credential-manager github login
  if errorlevel 1 goto failed
  echo.
  echo GitHub login completed. Starting push...
  echo.
)

if defined GIT_PROXY (
  git -c http.proxy=http://%GIT_PROXY% -c https.proxy=http://%GIT_PROXY% push origin main
) else (
  git push origin main
)
if errorlevel 1 goto failed

echo.
echo Push completed successfully.
git log -1 --oneline
goto end

:failed
echo.
echo Push failed. Check the network or GitHub login message above.

:end
echo.
pause
endlocal
