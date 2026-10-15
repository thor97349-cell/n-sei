"""Pipeline de edição de um vídeo.

validar -> analisar -> cortar -> legendar -> zoom -> música -> exportar -> validar o MP4 final.
"""

from __future__ import annotations

import logging
import os
import shutil
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

from foodcreator.core.cache import AnalysisCache
from foodcreator.core.cancel import CancelToken
from foodcreator.core.errors import DependencyError, InvalidInputError, OutputExistsError, ProcessingError
from foodcreator.core.settings import EditSettings
from foodcreator.media.ffmpeg import FFmpegTools, filter_script_args, run_ffmpeg
from foodcreator.media.framing import build_framing_filter, choose_target_size
from foodcreator.media.probe import MediaInfo, probe
from foodcreator.media.render import build_render_plan
from foodcreator.media.silence import Timeline, compute_keep_segments, detect_silences, total_duration
from foodcreator.media.validate import OutputCheck, validate_output
from foodcreator.media.zoom import build_zoom_filter, compute_zoom_windows
from foodcreator.subtitles import transcribe as transcribe_mod
from foodcreator.subtitles.captions import Word, caption_layout, group_captions, remap_words, write_ass, write_srt

log = logging.getLogger("foodcreator.pipeline")

ProgressFn = Callable[[float, str], None]

SUBTITLE_FILE = "legendas.ass"
FILTER_FILE = "filtros.txt"


@dataclass
class ExportResult:
    input_path: str
    output_path: str
    srt_path: str | None
    duration_in: float
    duration_out: float
    segments: int
    check: OutputCheck
    warnings: list[str] = field(default_factory=list)

    @property
    def removed_seconds(self) -> float:
        return max(0.0, self.duration_in - self.duration_out)


class _Stages:
    """Converte o progresso de cada etapa numa fração única de 0 a 1."""

    def __init__(self, report: ProgressFn | None, weights: dict[str, float]):
        self.report = report
        total = sum(weights.values())
        self.ranges = {}
        acc = 0.0
        for name, w in weights.items():
            self.ranges[name] = (acc / total, (acc + w) / total)
            acc += w

    def update(self, stage: str, frac: float, msg: str) -> None:
        if self.report and stage in self.ranges:
            a, b = self.ranges[stage]
            self.report(a + (b - a) * min(1.0, max(0.0, frac)), msg)


class EditPipeline:
    def __init__(
        self,
        tools: FFmpegTools,
        settings: EditSettings,
        cancel: CancelToken | None = None,
        cache: AnalysisCache | None = None,
        transcriber: transcribe_mod.Transcriber | None = None,
        allow_model_download: bool = False,
        temp_root: str | None = None,
    ):
        self.tools = tools
        self.settings = settings
        self.cancel = cancel or CancelToken()
        self.cache = cache or AnalysisCache()
        self.transcriber = transcriber or transcribe_mod.transcribe
        self.allow_model_download = allow_model_download
        self.temp_root = temp_root

    # -- etapas ---------------------------------------------------------------------------

    def analyze(self, input_path: str) -> MediaInfo:
        return probe(self.tools, input_path)

    def keep_segments(self, info: MediaInfo, stages: _Stages, warnings: list[str]) -> list[tuple[float, float]]:
        s = self.settings
        if not s.cut_silence:
            return [(0.0, info.duration)]
        if not info.has_audio:
            return [(0.0, info.duration)]
        params = s.silence_params()
        key = {"threshold": params.threshold_db, "v": 1}
        silences = self.cache.get("silencios", info.path, key)
        if silences is None:
            silences = detect_silences(
                self.tools, info.path, info.duration, params.threshold_db, self.cancel,
                on_progress=lambda t: stages.update("silence", t / info.duration, "Analisando pausas no áudio…"),
            )
            self.cache.put("silencios", info.path, key, silences)
        segments = compute_keep_segments(info.duration, [tuple(x) for x in silences], params, info.fps)
        removed = info.duration - total_duration(segments)
        if removed > info.duration * 0.6:
            warnings.append(
                f"Os cortes removeriam {removed / info.duration:.0%} do vídeo. Confira se o áudio não está "
                "muito baixo; se estiver, use agressividade 'Leve' ou um limiar de silêncio menor."
            )
        return segments

    def words(self, info: MediaInfo, stages: _Stages) -> list[Word]:
        s = self.settings
        key = {"model": s.whisper_model, "lang": "pt", "v": 1}
        cached = self.cache.get("transcricao", info.path, key)
        if cached is not None:
            return [Word(*w) for w in cached]
        if not transcribe_mod.is_model_cached(s.whisper_model) and self.allow_model_download:
            size = transcribe_mod.MODEL_SIZES.get(s.whisper_model, "")
            stages.update("transcribe", 0.0, f"Baixando o modelo de transcrição ({size})… aguarde.")
        else:
            stages.update("transcribe", 0.0, f"Transcrevendo a fala (modelo {s.whisper_model})… isso pode demorar.")
        words = self.transcriber(
            info.path,
            model=s.whisper_model,
            cancel=self.cancel,
            on_progress=lambda f: stages.update("transcribe", f, "Transcrevendo a fala…"),
            allow_download=self.allow_model_download,
            duration=info.duration,
        )
        self.cache.put("transcricao", info.path, key, [[w.start, w.end, w.text] for w in words])
        return words

    # -- execução completa ----------------------------------------------------------------

    def process(
        self,
        input_path: str,
        output_path: str,
        overwrite: bool = False,
        progress: ProgressFn | None = None,
    ) -> ExportResult:
        s = self.settings
        problems = s.validate()
        if problems:
            raise InvalidInputError("Há configurações a corrigir:\n- " + "\n- ".join(problems))

        out = Path(output_path)
        src = Path(input_path)
        if out.suffix.lower() != ".mp4":
            raise InvalidInputError("O arquivo de saída precisa terminar em .mp4.")
        if src.exists() and out.resolve() == src.resolve():
            raise InvalidInputError("A saída não pode ser o próprio arquivo original.")
        if out.exists() and not overwrite:
            raise OutputExistsError(f"Já existe uma exportação com este nome: {out.name}")
        try:
            out.parent.mkdir(parents=True, exist_ok=True)
        except OSError as exc:
            raise ProcessingError(f"Não foi possível criar a pasta de saída: {out.parent}") from exc

        want_subs = s.subtitles
        stages = _Stages(progress, {
            "probe": 1, "silence": 8 if s.cut_silence else 0.01,
            "transcribe": 35 if want_subs else 0.01, "render": 52, "validate": 4,
        })
        warnings: list[str] = []

        stages.update("probe", 0, "Lendo informações do vídeo…")
        info = self.analyze(input_path)
        self.cancel.raise_if_cancelled()

        segments = self.keep_segments(info, stages, warnings)
        timeline = Timeline(segments)
        self.cancel.raise_if_cancelled()

        target = choose_target_size(info, s.output_format)
        framing, frame_warning = build_framing_filter(
            info, target, s.output_format, s.vertical_mode, s.vertical_offset
        )
        if frame_warning:
            warnings.append(frame_warning)

        tmp = Path(tempfile.mkdtemp(prefix="foodcreator_", dir=self.temp_root))
        part = out.with_name(f"{out.stem}.parcial.mp4")
        srt_final: str | None = None
        try:
            subtitle_file = None
            captions = []
            if want_subs:
                if info.has_audio:
                    words = remap_words(self.words(info, stages), timeline)
                    vertical = s.output_format == "vertical"
                    captions = group_captions(
                        words,
                        max_words=s.subtitle_max_words,
                        max_chars=caption_layout(target, vertical)["max_chars"],
                    )
                    if captions:
                        write_ass(captions, tmp / SUBTITLE_FILE, target, vertical, s.subtitle_style)
                        subtitle_file = SUBTITLE_FILE
                    else:
                        warnings.append("Nenhuma fala foi reconhecida; o vídeo foi exportado sem legendas.")
            self.cancel.raise_if_cancelled()

            zoom_filter = None
            if s.zoom:
                windows = compute_zoom_windows(
                    timeline.cut_points(), timeline.duration, s.zoom_duration,
                    s.zoom_min_interval, s.zoom_manual_times,
                )
                zoom_filter = build_zoom_filter(windows, target, s.zoom_factor)

            plan = build_render_plan(
                info=info,
                segments=segments,
                framing_filter=framing,
                zoom_filter=zoom_filter,
                subtitle_file=subtitle_file,
                music_path=s.music_path if s.music else None,
                normalize_voice=not s.preserve_original_audio,
                music_volume_db=s.music_volume_db,
                music_ducking=s.music_ducking,
                quality=s.quality,
                output_file=str(part),
            )
            warnings.extend(plan.warnings)
            (tmp / FILTER_FILE).write_text(plan.filter_script, encoding="utf-8")

            stages.update("render", 0, "Exportando o vídeo…")
            run_ffmpeg(
                self.tools,
                [*plan.input_args, *filter_script_args(self.tools, FILTER_FILE), *plan.output_args],
                cancel=self.cancel,
                on_progress=lambda t: stages.update(
                    "render", t / max(plan.expected_duration, 0.1), "Exportando o vídeo…"
                ),
                cwd=str(tmp),
            )

            stages.update("validate", 0, "Conferindo o arquivo final…")
            check = validate_output(self.tools, part, plan.expected_duration)

            if out.exists() and not overwrite:
                raise OutputExistsError(f"Já existe uma exportação com este nome: {out.name}")
            os.replace(part, out)
            check = OutputCheck(**{**check.__dict__, "path": str(out)})

            if captions and s.export_srt:
                srt_path = out.with_suffix(".srt")
                if srt_path.exists() and not overwrite:
                    warnings.append(f"Legenda .srt não salva: já existe {srt_path.name}.")
                else:
                    write_srt(captions, tmp / "legendas.srt")
                    shutil.move(str(tmp / "legendas.srt"), srt_path)
                    srt_final = str(srt_path)
        finally:
            if part.exists():
                try:
                    part.unlink()
                except OSError:
                    log.warning("Não foi possível apagar o arquivo parcial %s", part)
            shutil.rmtree(tmp, ignore_errors=True)

        stages.update("validate", 1.0, "Concluído")
        result = ExportResult(
            input_path=info.path,
            output_path=str(out),
            srt_path=srt_final,
            duration_in=info.duration,
            duration_out=check.duration,
            segments=len(segments),
            check=check,
            warnings=warnings,
        )
        log.info("Exportação concluída: %s -> %s (%d trechos)", info.path, out, len(segments))
        return result


def check_transcription_ready(settings: EditSettings) -> None:
    """Levanta DependencyError se legendas estão ativadas sem o faster-whisper instalado."""
    if settings.subtitles and not transcribe_mod.is_available():
        raise DependencyError("A transcrição (faster-whisper) não está instalada.", transcribe_mod.INSTALL_HINT)
