@echo off
chcp 65001 >nul
set PYTHONIOENCODING=utf-8
cd /d "%~dp0"
if not exist .venv\Scripts\python.exe (
    echo O aplicativo ainda nao foi instalado. Rode instalar.bat primeiro.
    pause
    exit /b 1
)
.venv\Scripts\python.exe -m foodcreator --autoteste
echo.
pause
