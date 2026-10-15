@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo === FoodCreator Editor - instalacao ===
echo.

set "PY="
where py >nul 2>nul && py -3.11 -c "import sys" >nul 2>nul && set "PY=py -3.11"
if not defined PY where py >nul 2>nul && py -3 -c "import sys" >nul 2>nul && set "PY=py -3"
if not defined PY where python >nul 2>nul && set "PY=python"
if not defined PY (
    echo Python nao encontrado.
    echo Instale o Python 3.11 em https://www.python.org/downloads/
    echo e marque a opcao "Add python.exe to PATH" durante a instalacao.
    pause
    exit /b 1
)

if not exist .venv (
    echo Criando ambiente virtual com %PY% ...
    %PY% -m venv .venv || goto erro
)

.venv\Scripts\python -m pip install --upgrade pip || goto erro
.venv\Scripts\python -m pip install -r requirements.txt || goto erro

echo.
set "RESP=N"
set /p RESP=Instalar legendas automaticas (faster-whisper, cerca de 300 MB de bibliotecas)? [S/N] 
if /i "%RESP%"=="S" (
    .venv\Scripts\python -m pip install -r requirements-transcricao.txt || goto erro
)

echo.
where ffmpeg >nul 2>nul
if errorlevel 1 if not exist bin\ffmpeg.exe (
    echo AVISO: FFmpeg nao encontrado.
    echo Instale abrindo o PowerShell e rodando:  winget install Gyan.FFmpeg
    echo ou copie ffmpeg.exe e ffprobe.exe para a pasta "bin" deste projeto.
)

echo.
echo Instalacao concluida. Use iniciar.bat para abrir o aplicativo.
pause
exit /b 0

:erro
echo.
echo Ocorreu um erro na instalacao. Veja as mensagens acima.
pause
exit /b 1
