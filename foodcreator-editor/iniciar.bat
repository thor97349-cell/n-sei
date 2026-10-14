@echo off
cd /d "%~dp0"
if not exist .venv\Scripts\pythonw.exe (
    echo O aplicativo ainda nao foi instalado. Rode instalar.bat primeiro.
    pause
    exit /b 1
)
start "" .venv\Scripts\pythonw.exe -m foodcreator
