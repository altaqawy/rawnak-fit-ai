@echo off
cd /d "%~dp0"
where py >nul 2>nul
if not errorlevel 1 (
  py -3 fusion\launch_studio.py
) else (
  where python >nul 2>nul
  if errorlevel 1 (
    echo Install Python 3 from https://www.python.org/downloads/ and run again.
  ) else (
    python fusion\launch_studio.py
  )
)
pause
