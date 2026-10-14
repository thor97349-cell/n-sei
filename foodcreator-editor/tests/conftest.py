"""Fixtures: vídeos curtos gerados com o próprio FFmpeg (nomes com acentos e espaços)."""

from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path

import pytest

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")


@pytest.fixture(autouse=True)
def isolated_home(tmp_path, monkeypatch):
    """Cada teste usa uma pasta de dados própria (config, cache, logs)."""
    home = tmp_path / "app_home"
    monkeypatch.setenv("FOODCREATOR_HOME", str(home))
    return home


@pytest.fixture(scope="session")
def tools():
    from foodcreator.core.errors import DependencyError
    from foodcreator.media.ffmpeg import find_tools

    try:
        return find_tools(os.environ.get("FOODCREATOR_FFMPEG_DIR"))
    except DependencyError as exc:
        pytest.skip(f"FFmpeg indisponível: {exc.message}")


def _ffmpeg(*args: str) -> None:
    exe = os.environ.get("FOODCREATOR_FFMPEG_DIR")
    exe = str(Path(exe) / "ffmpeg") if exe else shutil.which("ffmpeg")
    subprocess.run([exe, "-v", "error", "-y", *args], check=True)


@pytest.fixture(scope="session")
def media_dir(tmp_path_factory, tools):
    return tmp_path_factory.mktemp("mídia de teste")


@pytest.fixture(scope="session")
def speech_video(media_dir) -> Path:
    """12 s, 640×360, 25 fps. Áudio: 2 s de "fala" (tom) + 2 s de silêncio, repetido.

    Silêncios em 2–4, 6–8 e 10–12 s.
    """
    path = media_dir / "Avaliação do pão de açúcar.mp4"
    _ffmpeg(
        "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=25",
        "-f", "lavfi", "-i", "aevalsrc='if(lt(mod(t\\,4)\\,2)\\,0.4*sin(2*PI*440*t)\\,0)':s=48000",
        "-t", "12", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", str(path),
    )
    return path


@pytest.fixture(scope="session")
def silent_video(media_dir) -> Path:
    """4 s, 1920×1080, 30 fps, sem faixa de áudio."""
    path = media_dir / "receita sem áudio.mp4"
    _ffmpeg("-f", "lavfi", "-i", "testsrc2=size=1920x1080:rate=30", "-t", "4",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", str(path))
    return path


@pytest.fixture(scope="session")
def vertical_video(media_dir) -> Path:
    """3 s, 720×1280 (vertical), com áudio contínuo."""
    path = media_dir / "desafio vertical.mov"
    _ffmpeg(
        "-f", "lavfi", "-i", "testsrc2=size=720x1280:rate=30",
        "-f", "lavfi", "-i", "sine=frequency=330:sample_rate=44100",
        "-t", "3", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", str(path),
    )
    return path


@pytest.fixture(scope="session")
def music_file(media_dir) -> Path:
    path = media_dir / "música livre.m4a"
    _ffmpeg("-f", "lavfi", "-i", "sine=frequency=220:sample_rate=44100", "-t", "5", "-c:a", "aac", str(path))
    return path


@pytest.fixture(scope="session")
def not_a_video(media_dir) -> Path:
    path = media_dir / "anotações.txt"
    path.write_text("isto não é um vídeo", encoding="utf-8")
    return path


@pytest.fixture(scope="session")
def corrupt_video(media_dir) -> Path:
    path = media_dir / "corrompido.mp4"
    path.write_bytes(b"\x00\x00\x00\x18ftypmp42" + os.urandom(2048))
    return path


@pytest.fixture
def fake_transcriber():
    """Simula o faster-whisper: devolve palavras nos trechos com "fala" do speech_video."""
    from foodcreator.subtitles.captions import Word

    calls = []

    def transcribe(path, model, cancel, on_progress, allow_download, duration):
        calls.append(path)
        words = []
        for base in (0.0, 4.0, 8.0):
            for i, text in enumerate(["Nossa,", "que", "pão", "de", "açúcar", "incrível!"]):
                words.append(Word(base + i * 0.3, base + i * 0.3 + 0.25, text))
        if on_progress:
            on_progress(1.0)
        return words

    transcribe.calls = calls
    return transcribe
