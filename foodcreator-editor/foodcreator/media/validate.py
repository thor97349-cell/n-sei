"""Confere se o MP4 exportado abre e tem vídeo H.264 e áudio AAC com a duração esperada."""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from pathlib import Path

from foodcreator.core.errors import ProcessingError
from foodcreator.media.ffmpeg import FFmpegTools, run_ffmpeg, run_ffprobe

log = logging.getLogger("foodcreator.validate")


@dataclass(frozen=True)
class OutputCheck:
    path: str
    duration: float
    width: int
    height: int
    video_codec: str
    audio_codec: str
    size_bytes: int


def validate_output(tools: FFmpegTools, path: str | Path, expected_duration: float | None = None) -> OutputCheck:
    p = Path(path)
    if not p.is_file() or p.stat().st_size == 0:
        raise ProcessingError("O arquivo final não foi criado ou está vazio.")
    try:
        data = json.loads(run_ffprobe(tools, ["-print_format", "json", "-show_format", "-show_streams", str(p)]))
    except (ProcessingError, json.JSONDecodeError) as exc:
        raise ProcessingError("O arquivo final não pôde ser aberto; a exportação parece corrompida.") from exc

    streams = data.get("streams", [])
    video = next((s for s in streams if s.get("codec_type") == "video"), None)
    audio = next((s for s in streams if s.get("codec_type") == "audio"), None)
    if video is None:
        raise ProcessingError("O arquivo final não tem faixa de vídeo.")
    if audio is None:
        raise ProcessingError("O arquivo final não tem faixa de áudio.")
    if video.get("codec_name") != "h264":
        raise ProcessingError(f"Vídeo final com codec inesperado: {video.get('codec_name')}.")
    if audio.get("codec_name") != "aac":
        raise ProcessingError(f"Áudio final com codec inesperado: {audio.get('codec_name')}.")

    duration = float(data.get("format", {}).get("duration") or 0)
    if expected_duration:
        tolerance = max(0.5, expected_duration * 0.02)
        if abs(duration - expected_duration) > tolerance:
            raise ProcessingError(
                f"A duração do vídeo final ({duration:.1f}s) difere da esperada ({expected_duration:.1f}s)."
            )

    # Decodifica o começo e o fim para garantir que o arquivo não está truncado.
    run_ffmpeg(tools, ["-v", "error", "-xerror", "-i", str(p), "-t", "2", "-f", "null", "-"])
    run_ffmpeg(tools, ["-v", "error", "-xerror", "-sseof", "-2", "-i", str(p), "-f", "null", "-"])

    check = OutputCheck(
        path=str(p),
        duration=duration,
        width=int(video.get("width") or 0),
        height=int(video.get("height") or 0),
        video_codec="h264",
        audio_codec="aac",
        size_bytes=p.stat().st_size,
    )
    log.info("Saída validada: %s", check)
    return check
