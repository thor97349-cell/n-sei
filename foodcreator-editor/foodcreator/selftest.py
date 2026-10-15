"""Autoteste: confere a instalação e roda o pipeline real num vídeo gerado na hora.

Uso: `python -m foodcreator --autoteste` (ou autoteste.bat no Windows).
Não usa a interface gráfica nem a internet. Os vídeos gerados ficam em output/autoteste.
"""

from __future__ import annotations

import importlib.util
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from foodcreator.core.errors import FoodCreatorError
from foodcreator.core.paths import default_output_dir, unique_path
from foodcreator.core.pipeline import EditPipeline
from foodcreator.core.settings import EditSettings
from foodcreator.media.ffmpeg import _CREATE_NO_WINDOW, FFmpegTools, find_tools
from foodcreator.media.probe import probe

REQUIRED_ENCODERS = ("libx264", "aac")
REQUIRED_FILTERS = ("silencedetect", "ass", "sidechaincompress", "boxblur", "overlay", "concat")


class _Report:
    def __init__(self) -> None:
        self.failures = 0

    def ok(self, text: str) -> None:
        print(f"  [OK]     {text}")

    def fail(self, text: str) -> None:
        self.failures += 1
        print(f"  [FALHOU] {text}")

    def info(self, text: str) -> None:
        print(f"  [INFO]   {text}")


def _ffmpeg_list(tools: FFmpegTools, what: str) -> str:
    out = subprocess.run(
        [tools.ffmpeg, "-hide_banner", what], capture_output=True, text=True,
        encoding="utf-8", errors="replace", timeout=30, creationflags=_CREATE_NO_WINDOW,
    )
    return out.stdout


def _has(listing: str, name: str) -> bool:
    return any(len(parts) > 1 and parts[1] == name for parts in (line.split() for line in listing.splitlines()))


def _make_test_video(tools: FFmpegTools, path: Path) -> None:
    """12 s, 1280×720: 2 s com som + 2 s de silêncio, repetido (silêncios em 2–4, 6–8, 10–12 s)."""
    subprocess.run(
        [tools.ffmpeg, "-hide_banner", "-v", "error", "-y",
         "-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=30",
         "-f", "lavfi", "-i", "aevalsrc='if(lt(mod(t\\,4)\\,2)\\,0.4*sin(2*PI*440*t)\\,0)':s=48000",
         "-t", "12", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", str(path)],
        check=True, capture_output=True, timeout=300, creationflags=_CREATE_NO_WINDOW,
    )


def run(output_dir: Path | None = None) -> int:
    # O console do Windows pode não ter UTF-8: troca caracteres sem suporte em vez de quebrar.
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(errors="replace")
    report = _Report()
    print("FoodCreator Editor — autoteste\n")

    print("1. Ambiente")
    if sys.version_info >= (3, 10):
        report.ok(f"Python {sys.version.split()[0]}")
    else:
        report.fail(f"Python {sys.version.split()[0]} é antigo demais (use 3.11)")
    if importlib.util.find_spec("PySide6") is not None:
        report.ok("PySide6 (interface) instalado")
    else:
        report.fail("PySide6 não instalado: rode instalar.bat")
    if importlib.util.find_spec("faster_whisper") is not None:
        report.ok("faster-whisper (legendas) instalado")
    else:
        report.info("faster-whisper não instalado: legendas automáticas desativadas (opcional)")

    print("\n2. FFmpeg")
    try:
        tools = find_tools()
    except FoodCreatorError as exc:
        report.fail(exc.user_text())
        return _finish(report)
    report.ok(f"FFmpeg {tools.version_text} em {tools.ffmpeg}")
    encoders = _ffmpeg_list(tools, "-encoders")
    filters = _ffmpeg_list(tools, "-filters")
    for name in REQUIRED_ENCODERS:
        (report.ok if _has(encoders, name) else report.fail)(f"codificador {name}")
    for name in REQUIRED_FILTERS:
        (report.ok if _has(filters, name) else report.fail)(f"filtro {name}")
    if report.failures:
        return _finish(report)

    print("\n3. Pipeline real (vídeo de teste gerado agora)")
    out_dir = output_dir or default_output_dir() / "autoteste"
    out_dir.mkdir(parents=True, exist_ok=True)
    tmp = Path(tempfile.mkdtemp(prefix="foodcreator_autoteste_"))
    try:
        source = tmp / "vídeo de teste ção.mp4"  # acentos e espaços de propósito
        try:
            _make_test_video(tools, source)
            report.ok("vídeo de teste gerado (12 s, 1280×720, com pausas)")
        except (subprocess.SubprocessError, OSError) as exc:
            report.fail(f"não foi possível gerar o vídeo de teste: {exc}")
            return _finish(report)

        try:
            info = probe(tools, source)
            report.ok(f"análise: {info.duration:.1f} s, {info.resolution_text}, {info.fps:.0f} fps, "
                      f"áudio {'sim' if info.has_audio else 'não'}")
        except FoodCreatorError as exc:
            report.fail(f"análise do vídeo: {exc.user_text()}")
            return _finish(report)

        cases = [
            ("cópia simples (sem cortes nem zoom)", "copia_simples.mp4",
             EditSettings(cut_silence=False, zoom=False), 12.0),
            ("YouTube 16:9 com cortes e zoom", "youtube_cortes.mp4", EditSettings(), 7.25),
            ("Shorts 9:16 com cortes e zoom", "shorts_cortes.mp4", EditSettings(output_format="vertical"), 7.25),
        ]
        for label, name, settings, expected in cases:
            target = unique_path(out_dir / name)
            try:
                result = EditPipeline(tools, settings, temp_root=str(tmp)).process(str(source), str(target))
            except FoodCreatorError as exc:
                report.fail(f"{label}: {exc.user_text()}")
                continue
            check = result.check
            if abs(check.duration - expected) > 0.5:
                report.fail(f"{label}: duração {check.duration:.2f} s, esperado ~{expected} s")
                continue
            report.ok(f"{label}: {check.width}×{check.height}, {check.duration:.2f} s, "
                      f"H.264 + AAC, {check.size_bytes / 1e6:.1f} MB -> {target}")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    return _finish(report)


def _finish(report: _Report) -> int:
    print()
    if report.failures:
        print(f"RESULTADO: {report.failures} problema(s) encontrado(s). Veja as linhas [FALHOU] acima.")
        return 1
    print("RESULTADO: tudo certo. Abra a pasta output\\autoteste para assistir aos vídeos gerados.")
    return 0
