"""Leitura de informações do vídeo (duração, resolução, FPS, áudio)."""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from fractions import Fraction
from pathlib import Path

from foodcreator.core.errors import InvalidInputError, ProcessingError
from foodcreator.media.ffmpeg import FFmpegTools, run_ffprobe

log = logging.getLogger("foodcreator.probe")

VIDEO_EXTENSIONS = (".mp4", ".mov", ".m4v", ".mkv", ".avi", ".webm", ".mts", ".m2ts", ".3gp", ".wmv")


@dataclass(frozen=True)
class MediaInfo:
    path: str
    duration: float
    width: int  # já considerando rotação (dimensão exibida)
    height: int
    fps: float
    video_codec: str
    has_audio: bool
    audio_codec: str | None
    sample_rate: int | None
    channels: int | None
    sample_aspect: float  # 1.0 = pixel quadrado
    size_bytes: int

    @property
    def display_width(self) -> int:
        return round(self.width * self.sample_aspect)

    @property
    def resolution_text(self) -> str:
        return f"{self.display_width}×{self.height}"

    @property
    def is_vertical(self) -> bool:
        return self.height > self.display_width


def _fraction(text: str | None) -> float:
    if not text or text in ("0/0", "N/A"):
        return 0.0
    try:
        return float(Fraction(text))
    except (ValueError, ZeroDivisionError):
        return 0.0


def _rotation(stream: dict) -> int:
    rotate = stream.get("tags", {}).get("rotate")
    if rotate is not None:
        try:
            return int(float(rotate)) % 360
        except ValueError:
            pass
    for side in stream.get("side_data_list", []) or []:
        if "rotation" in side:
            try:
                return int(float(side["rotation"])) % 360
            except (TypeError, ValueError):
                pass
    return 0


def validate_input_path(path: str | Path) -> Path:
    p = Path(path)
    if not str(path).strip():
        raise InvalidInputError("Nenhum arquivo foi informado.")
    if not p.exists():
        raise InvalidInputError(f"O arquivo não existe: {p}", "Verifique se ele foi movido ou renomeado.")
    if not p.is_file():
        raise InvalidInputError(f"O caminho não é um arquivo: {p}")
    try:
        size = p.stat().st_size
        with p.open("rb") as fh:
            fh.read(16)
    except OSError as exc:
        raise InvalidInputError(
            f"Não foi possível ler o arquivo: {p.name}", "Feche outros programas que estejam usando o vídeo."
        ) from exc
    if size == 0:
        raise InvalidInputError(f"O arquivo está vazio: {p.name}")
    return p


def probe(tools: FFmpegTools, path: str | Path) -> MediaInfo:
    p = validate_input_path(path)
    try:
        raw = run_ffprobe(
            tools, ["-print_format", "json", "-show_format", "-show_streams", str(p)]
        )
        data = json.loads(raw or "{}")
    except (ProcessingError, json.JSONDecodeError) as exc:
        raise InvalidInputError(
            f"Não foi possível ler '{p.name}' como vídeo.",
            "Confira se o arquivo é um vídeo válido (MP4, MOV, MKV…) e se não está corrompido.",
        ) from exc

    streams = data.get("streams", [])
    video = next(
        (s for s in streams
         if s.get("codec_type") == "video" and not s.get("disposition", {}).get("attached_pic")),
        None,
    )
    if video is None:
        raise InvalidInputError(f"'{p.name}' não contém uma faixa de vídeo.")
    audio = next((s for s in streams if s.get("codec_type") == "audio"), None)

    duration = _fraction(data.get("format", {}).get("duration")) or _fraction(video.get("duration"))
    if duration <= 0:
        raise InvalidInputError(f"Não foi possível descobrir a duração de '{p.name}'.")

    width, height = int(video.get("width") or 0), int(video.get("height") or 0)
    if width <= 0 or height <= 0:
        raise InvalidInputError(f"Não foi possível descobrir a resolução de '{p.name}'.")
    if _rotation(video) in (90, 270):
        width, height = height, width

    fps = _fraction(video.get("avg_frame_rate")) or _fraction(video.get("r_frame_rate")) or 30.0
    if not 1 <= fps <= 240:
        fps = 30.0
    sar = _fraction(video.get("sample_aspect_ratio")) or 1.0

    info = MediaInfo(
        path=str(p),
        duration=duration,
        width=width,
        height=height,
        fps=fps,
        video_codec=str(video.get("codec_name", "?")),
        has_audio=audio is not None,
        audio_codec=audio.get("codec_name") if audio else None,
        sample_rate=int(audio["sample_rate"]) if audio and audio.get("sample_rate") else None,
        channels=int(audio["channels"]) if audio and audio.get("channels") else None,
        sample_aspect=sar if 0.25 <= sar <= 4 else 1.0,
        size_bytes=p.stat().st_size,
    )
    log.info("Mídia analisada: %s", info)
    return info


def format_duration(seconds: float) -> str:
    seconds = max(0, round(seconds))
    h, rem = divmod(seconds, 3600)
    m, s = divmod(rem, 60)
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"
