"""Verificação das dependências externas, com orientações em português."""

from __future__ import annotations

import sys
from dataclasses import dataclass

from foodcreator.core.errors import DependencyError
from foodcreator.media.ffmpeg import FFmpegTools, find_tools
from foodcreator.subtitles import transcribe


@dataclass(frozen=True)
class DependencyStatus:
    name: str
    ok: bool
    detail: str
    required: bool = True


def check_dependencies(ffmpeg_dir: str | None = None) -> tuple[FFmpegTools | None, list[DependencyStatus]]:
    statuses: list[DependencyStatus] = []
    py_ok = sys.version_info >= (3, 10)
    statuses.append(DependencyStatus(
        "Python", py_ok, sys.version.split()[0] + ("" if py_ok else " (use Python 3.11)")
    ))

    tools = None
    try:
        tools = find_tools(ffmpeg_dir)
        statuses.append(DependencyStatus("FFmpeg", True, f"versão {tools.version_text}"))
    except DependencyError as exc:
        statuses.append(DependencyStatus("FFmpeg", False, exc.user_text()))

    if transcribe.is_available():
        statuses.append(DependencyStatus("Transcrição (faster-whisper)", True, "instalada", required=False))
    else:
        statuses.append(DependencyStatus(
            "Transcrição (faster-whisper)", False,
            "não instalada — as legendas automáticas ficam desativadas. " + transcribe.INSTALL_HINT,
            required=False,
        ))
    return tools, statuses
