"""Monta o comando único do FFmpeg: cortes + enquadramento + zoom + legendas + áudio -> MP4."""

from __future__ import annotations

from dataclasses import dataclass, field
from fractions import Fraction

from foodcreator.core.settings import QUALITY_PRESETS
from foodcreator.media.audio import build_audio_graph
from foodcreator.media.probe import MediaInfo
from foodcreator.media.silence import Interval, total_duration


@dataclass
class RenderPlan:
    input_args: list[str]
    filter_script: str
    output_args: list[str]
    expected_duration: float
    warnings: list[str] = field(default_factory=list)


def output_fps(fps: float) -> str:
    fps = min(60.0, max(1.0, fps))
    if abs(fps - round(fps)) < 0.01:
        return str(int(round(fps)))
    return str(Fraction(fps).limit_denominator(1001))


def _chain(src: str, chain: str, dst: str) -> str:
    """Liga uma cadeia (que pode ter subgrafos internos com ';') entre dois rótulos."""
    return f"[{src}]{chain}[{dst}]"


def build_render_plan(
    info: MediaInfo,
    segments: list[Interval],
    framing_filter: str,
    zoom_filter: str | None,
    subtitle_file: str | None,
    music_path: str | None,
    normalize_voice: bool,
    music_volume_db: float,
    music_ducking: bool,
    quality: str,
    output_file: str,
) -> RenderPlan:
    n = len(segments)
    duration = total_duration(segments)
    lines: list[str] = []

    input_args = ["-i", info.path]
    if music_path:
        input_args += ["-stream_loop", "-1", "-i", music_path]

    # 1) Cortes: um trim por trecho, depois concat (mantém áudio e vídeo juntos por trecho).
    has_audio = info.has_audio
    if n == 1:
        s, e = segments[0]
        lines.append(f"[0:v:0]trim=start={s:.4f}:end={e:.4f},setpts=PTS-STARTPTS[vcat]")
        if has_audio:
            lines.append(f"[0:a:0]atrim=start={s:.4f}:end={e:.4f},asetpts=PTS-STARTPTS[acat]")
    else:
        lines.append("[0:v:0]split=" + str(n) + "".join(f"[vs{i}]" for i in range(n)))
        if has_audio:
            lines.append("[0:a:0]asplit=" + str(n) + "".join(f"[as{i}]" for i in range(n)))
        pads = []
        for i, (s, e) in enumerate(segments):
            lines.append(f"[vs{i}]trim=start={s:.4f}:end={e:.4f},setpts=PTS-STARTPTS[v{i}]")
            pads.append(f"[v{i}]")
            if has_audio:
                lines.append(f"[as{i}]atrim=start={s:.4f}:end={e:.4f},asetpts=PTS-STARTPTS[a{i}]")
                pads.append(f"[a{i}]")
        outs = "[vcat][acat]" if has_audio else "[vcat]"
        lines.append("".join(pads) + f"concat=n={n}:v=1:a={1 if has_audio else 0}{outs}")

    # 2) Taxa de quadros constante + enquadramento.
    lines.append(_chain("vcat", f"fps={output_fps(info.fps)}," + framing_filter, "vframe"))
    current = "vframe"

    # 3) Zoom.
    if zoom_filter:
        lines.append(_chain(current, zoom_filter, "vzoom"))
        current = "vzoom"

    # 4) Legendas (arquivo .ass relativo à pasta temporária, que é o diretório de trabalho).
    if subtitle_file:
        lines.append(_chain(current, f"ass={subtitle_file}", "vsub"))
        current = "vsub"
    lines.append(_chain(current, "format=yuv420p", "vout"))

    # 5) Áudio.
    lines += build_audio_graph(
        voice_label="acat" if has_audio else None,
        music_label="1:a:0" if music_path else None,
        duration=duration,
        normalize_voice=normalize_voice,
        music_volume_db=music_volume_db,
        ducking=music_ducking,
    )

    preset, crf = QUALITY_PRESETS.get(quality, QUALITY_PRESETS["equilibrada"])
    output_args = [
        "-map", "[vout]", "-map", "[aout]",
        "-c:v", "libx264", "-preset", preset, "-crf", str(crf),
        "-pix_fmt", "yuv420p", "-profile:v", "high",
        "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
        "-map_metadata", "-1",  # remove metadados do celular (ex.: localização GPS)
        "-metadata:s:a:0", "language=por",
        "-movflags", "+faststart",
        "-max_muxing_queue_size", "4096",
        "-t", f"{duration:.3f}",
        "-f", "mp4",
        output_file,
    ]

    warnings = []
    if not has_audio:
        warnings.append(
            "O vídeo original não tem áudio: não houve cortes de silêncio nem transcrição"
            + ("." if music_path else ", e foi adicionada uma faixa de áudio silenciosa.")
        )
    return RenderPlan(input_args, ";\n".join(lines), output_args, duration, warnings)
