"""Trabalhos em segundo plano (QThread) para a interface nunca congelar."""

from __future__ import annotations

import logging
from dataclasses import dataclass

from PySide6.QtCore import QObject, Signal, Slot

from foodcreator.core.cancel import CancelToken
from foodcreator.core.errors import CancelledError, FoodCreatorError
from foodcreator.core.pipeline import EditPipeline
from foodcreator.core.settings import EditSettings
from foodcreator.media.ffmpeg import FFmpegTools
from foodcreator.media.probe import probe

log = logging.getLogger("foodcreator.workers")


class ProbeWorker(QObject):
    """Lê duração/resolução de cada vídeo importado."""

    probed = Signal(str, object)  # caminho, MediaInfo
    failed = Signal(str, str)  # caminho, mensagem
    finished = Signal()

    def __init__(self, tools: FFmpegTools, paths: list[str]):
        super().__init__()
        self.tools = tools
        self.paths = paths

    @Slot()
    def run(self) -> None:
        for path in self.paths:
            try:
                self.probed.emit(path, probe(self.tools, path))
            except FoodCreatorError as exc:
                self.failed.emit(path, exc.user_text())
            except Exception as exc:  # noqa: BLE001
                log.exception("Erro inesperado ao analisar %s", path)
                self.failed.emit(path, f"Erro inesperado ao ler o arquivo: {exc}")
        self.finished.emit()


@dataclass
class Job:
    row: int
    input_path: str
    output_path: str
    overwrite: bool


class ExportWorker(QObject):
    file_started = Signal(int)
    progress = Signal(int, float, float, str)  # linha, fração do arquivo, fração total, mensagem
    file_done = Signal(int, object)  # linha, ExportResult
    file_failed = Signal(int, str)
    file_cancelled = Signal(int)
    finished = Signal(int, int, bool)  # concluídos, falhas, cancelado

    def __init__(self, tools: FFmpegTools, settings: EditSettings, jobs: list[Job],
                 cancel: CancelToken, allow_model_download: bool):
        super().__init__()
        self.tools = tools
        self.settings = settings
        self.jobs = jobs
        self.cancel = cancel
        self.allow_model_download = allow_model_download

    @Slot()
    def run(self) -> None:
        done = failed = 0
        total = len(self.jobs)
        pipeline = EditPipeline(
            self.tools, self.settings, cancel=self.cancel, allow_model_download=self.allow_model_download
        )
        for index, job in enumerate(self.jobs):
            if self.cancel.cancelled:
                break
            self.file_started.emit(job.row)

            def report(frac: float, msg: str, _i=index, _row=job.row) -> None:
                self.progress.emit(_row, frac, (_i + frac) / total, msg)

            try:
                result = pipeline.process(job.input_path, job.output_path, job.overwrite, report)
                done += 1
                self.file_done.emit(job.row, result)
            except CancelledError:
                self.file_cancelled.emit(job.row)
                break
            except FoodCreatorError as exc:
                failed += 1
                log.warning("Falha em %s: %s", job.input_path, exc.message)
                self.file_failed.emit(job.row, exc.user_text())
            except Exception as exc:  # noqa: BLE001
                failed += 1
                log.exception("Erro inesperado em %s", job.input_path)
                self.file_failed.emit(job.row, f"Erro inesperado: {exc}. Detalhes no log do aplicativo.")
        self.finished.emit(done, failed, self.cancel.cancelled)
