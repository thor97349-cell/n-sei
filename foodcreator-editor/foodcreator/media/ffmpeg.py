"""Localiza e executa FFmpeg/FFprobe com progresso e cancelamento."""

from __future__ import annotations

import collections
import logging
import os
import queue
import re
import shutil
import subprocess
import sys
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from foodcreator.core.cancel import CancelToken
from foodcreator.core.errors import CancelledError, DependencyError, ProcessingError
from foodcreator.core.paths import project_root

log = logging.getLogger("foodcreator.ffmpeg")

_EXE = ".exe" if sys.platform == "win32" else ""
_CREATE_NO_WINDOW = 0x08000000 if sys.platform == "win32" else 0

INSTALL_HINT = (
    "Instale o FFmpeg (no Windows: abra o PowerShell e rode `winget install Gyan.FFmpeg`) "
    "ou copie ffmpeg.exe e ffprobe.exe para a pasta `bin` do FoodCreator Editor. "
    "Depois, reabra o aplicativo."
)


@dataclass(frozen=True)
class FFmpegTools:
    ffmpeg: str
    ffprobe: str
    version: tuple[int, int]

    @property
    def version_text(self) -> str:
        return f"{self.version[0]}.{self.version[1]}"


def _candidate_dirs(configured_dir: str | None) -> list[Path | None]:
    dirs: list[Path | None] = []
    if configured_dir:
        dirs.append(Path(configured_dir))
    dirs.append(project_root() / "bin")
    dirs.append(None)  # PATH do sistema
    return dirs


def _find_exe(name: str, directory: Path | None) -> str | None:
    if directory is None:
        return shutil.which(name)
    candidate = directory / f"{name}{_EXE}"
    return str(candidate) if candidate.is_file() else None


def parse_version(text: str) -> tuple[int, int]:
    """'ffmpeg version 6.1.1-3ubuntu5' -> (6, 1); 'n7.1' -> (7, 1); builds 'N-…' viram (99, 0)."""
    match = re.search(r"version\s+n?(\d+)\.(\d+)", text)
    if match:
        return int(match.group(1)), int(match.group(2))
    if re.search(r"version\s+N-", text):
        return 99, 0  # build de desenvolvimento: mais nova que qualquer release
    return 0, 0


def find_tools(configured_dir: str | None = None) -> FFmpegTools:
    for directory in _candidate_dirs(configured_dir):
        ffmpeg = _find_exe("ffmpeg", directory)
        ffprobe = _find_exe("ffprobe", directory)
        if ffmpeg and ffprobe:
            try:
                out = subprocess.run(
                    [ffmpeg, "-hide_banner", "-version"],
                    capture_output=True, text=True, encoding="utf-8", errors="replace",
                    timeout=20, creationflags=_CREATE_NO_WINDOW,
                )
            except (OSError, subprocess.SubprocessError) as exc:
                log.warning("FFmpeg em %s não executou: %s", ffmpeg, exc)
                continue
            version = parse_version(out.stdout)
            if version < (4, 4):
                raise DependencyError(
                    f"A versão do FFmpeg encontrada ({version[0]}.{version[1]}) é antiga demais.",
                    "Instale o FFmpeg 6 ou mais novo. " + INSTALL_HINT,
                )
            return FFmpegTools(ffmpeg=ffmpeg, ffprobe=ffprobe, version=version)
    raise DependencyError("FFmpeg não foi encontrado neste computador.", INSTALL_HINT)


def filter_script_args(tools: FFmpegTools, script_name: str) -> list[str]:
    """Passa o filtergraph por arquivo (evita o limite de tamanho da linha de comando do Windows)."""
    if tools.version >= (7, 0):
        return ["-/filter_complex", script_name]
    return ["-filter_complex_script", script_name]


def _popen(args: list[str], cwd: str | None) -> subprocess.Popen:
    log.info("Executando: %s", subprocess.list2cmdline(args))
    return subprocess.Popen(
        args,
        cwd=cwd,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        creationflags=_CREATE_NO_WINDOW,
    )


def _pump(stream, tag: str, q: "queue.Queue[tuple[str, str | None]]") -> None:
    for raw in iter(stream.readline, b""):
        q.put((tag, raw.decode("utf-8", errors="replace").rstrip("\r\n")))
    q.put((tag, None))


def run_ffmpeg(
    tools: FFmpegTools,
    args: list[str],
    cancel: CancelToken | None = None,
    on_progress: Callable[[float], None] | None = None,
    cwd: str | None = None,
    keep_stderr: bool = False,
) -> list[str]:
    """Roda o ffmpeg com `-progress`, chamando on_progress(segundos_processados).

    Devolve as linhas de stderr (todas se keep_stderr, senão as últimas 60).
    Cancelamento encerra o processo e levanta CancelledError.
    """
    full = [tools.ffmpeg, "-hide_banner", "-nostdin", "-y", "-progress", "pipe:1", "-nostats", *args]
    proc = _popen(full, cwd)
    q: "queue.Queue[tuple[str, str | None]]" = queue.Queue()
    threads = [
        threading.Thread(target=_pump, args=(proc.stdout, "out", q), daemon=True),
        threading.Thread(target=_pump, args=(proc.stderr, "err", q), daemon=True),
    ]
    for t in threads:
        t.start()

    stderr_lines: collections.deque[str] | list[str] = [] if keep_stderr else collections.deque(maxlen=60)
    open_streams = 2
    try:
        while open_streams:
            if cancel is not None and cancel.cancelled:
                raise CancelledError()
            try:
                tag, line = q.get(timeout=0.2)
            except queue.Empty:
                continue
            if line is None:
                open_streams -= 1
                continue
            if tag == "err":
                stderr_lines.append(line)
            elif on_progress and line.startswith("out_time_us="):
                value = line.split("=", 1)[1]
                if value.lstrip("-").isdigit():
                    on_progress(max(0.0, int(value) / 1_000_000))
        proc.wait()
    except BaseException:
        _terminate(proc)
        raise
    if proc.returncode != 0:
        tail = "\n".join(list(stderr_lines)[-15:])
        log.error("FFmpeg falhou (código %s):\n%s", proc.returncode, tail)
        raise ProcessingError(friendly_ffmpeg_error(tail), "Veja os detalhes no log do aplicativo.")
    return list(stderr_lines)


def _terminate(proc: subprocess.Popen) -> None:
    if proc.poll() is not None:
        return
    proc.terminate()
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.wait()


def run_ffprobe(tools: FFmpegTools, args: list[str], timeout: float = 60) -> str:
    full = [tools.ffprobe, "-hide_banner", "-v", "error", *args]
    log.debug("Executando: %s", subprocess.list2cmdline(full))
    try:
        out = subprocess.run(
            full, capture_output=True, timeout=timeout, creationflags=_CREATE_NO_WINDOW,
        )
    except subprocess.TimeoutExpired as exc:
        raise ProcessingError("O FFprobe demorou demais para ler o arquivo.") from exc
    except OSError as exc:
        raise DependencyError(f"Não foi possível executar o FFprobe: {exc}", INSTALL_HINT) from exc
    if out.returncode != 0:
        msg = out.stderr.decode("utf-8", errors="replace").strip()
        raise ProcessingError(friendly_ffmpeg_error(msg))
    return out.stdout.decode("utf-8", errors="replace")


def friendly_ffmpeg_error(stderr_tail: str) -> str:
    text = stderr_tail.lower()
    if "no space left" in text:
        return "Não há espaço livre suficiente no disco para exportar o vídeo."
    if "permission denied" in text:
        return "Sem permissão para ler ou gravar um dos arquivos (ele pode estar aberto em outro programa)."
    if "invalid data found" in text or "moov atom not found" in text:
        return "O arquivo parece estar corrompido ou incompleto e não pode ser lido."
    if "no such file" in text:
        return "Um dos arquivos não foi encontrado."
    if "unknown encoder" in text or "encoder not found" in text:
        return "O FFmpeg instalado não tem o codificador necessário (H.264/AAC). Instale uma versão completa."
    if "fontconfig" in text or ("font" in text and "error" in text):
        return "O FFmpeg não conseguiu carregar a fonte das legendas."
    last = stderr_tail.strip().splitlines()[-1] if stderr_tail.strip() else "erro desconhecido"
    return f"O FFmpeg não conseguiu processar o vídeo ({last})."


def env_info() -> dict[str, str]:
    """Resumo do ambiente para o log de diagnóstico."""
    return {"platform": sys.platform, "python": sys.version.split()[0], "cwd": os.getcwd()}
