"""Transcrição local em português com faster-whisper (opcional).

O modelo só é baixado com autorização explícita: `allow_download=False` faz a função
levantar ModelDownloadRequired, que a interface converte numa pergunta ao usuário.
"""

from __future__ import annotations

import importlib.util
import logging
from pathlib import Path
from typing import Callable

from foodcreator.core.cancel import CancelToken
from foodcreator.core.errors import CancelledError, DependencyError, ModelDownloadRequired, ProcessingError
from foodcreator.core.paths import app_data_dir
from foodcreator.subtitles.captions import Word

log = logging.getLogger("foodcreator.transcribe")

# Tamanho aproximado do download de cada modelo.
MODEL_SIZES = {
    "tiny": "~75 MB",
    "base": "~145 MB",
    "small": "~480 MB",
    "medium": "~1,5 GB",
    "large-v3": "~3 GB",
}
MODEL_NOTES = {
    "tiny": "muito rápido, menos preciso",
    "base": "rápido, precisão razoável",
    "small": "recomendado: bom equilíbrio para português",
    "medium": "mais preciso, bem mais lento",
    "large-v3": "o mais preciso, muito lento sem placa de vídeo",
}

INSTALL_HINT = (
    "Instale a transcrição com `pip install -r requirements-transcricao.txt` "
    "(ou rode novamente o instalar.bat e responda S) e reabra o aplicativo."
)

Transcriber = Callable[..., list[Word]]


def is_available() -> bool:
    return importlib.util.find_spec("faster_whisper") is not None


def models_dir() -> str:
    path = app_data_dir() / "modelos"
    path.mkdir(parents=True, exist_ok=True)
    return str(path)


def is_model_cached(model: str) -> bool:
    """Confere no disco, sem importar o faster-whisper (que é lento para carregar)."""
    snapshots = Path(models_dir()) / f"models--Systran--faster-whisper-{model}" / "snapshots"
    return any(snapshots.glob("*/model.bin"))


def _load_model(model: str, allow_download: bool):
    if not is_available():
        raise DependencyError("A transcrição (faster-whisper) não está instalada.", INSTALL_HINT)
    from faster_whisper import WhisperModel
    from faster_whisper.utils import download_model

    cached = is_model_cached(model)
    if not cached and not allow_download:
        raise ModelDownloadRequired(model, MODEL_SIZES.get(model, "tamanho desconhecido"))
    if not cached:
        log.info("Baixando modelo %s (%s)", model, MODEL_SIZES.get(model))
    try:
        model_path = download_model(model, cache_dir=models_dir(), local_files_only=cached)
        return WhisperModel(model_path, device="cpu", compute_type="int8")
    except Exception as exc:  # noqa: BLE001
        log.exception("Falha ao carregar o modelo %s", model)
        raise ProcessingError(
            f"Não foi possível baixar ou carregar o modelo de transcrição '{model}'.",
            "Verifique a conexão com a internet e o espaço em disco, ou escolha um modelo menor.",
        ) from exc


def transcribe(
    path: str,
    model: str = "small",
    cancel: CancelToken | None = None,
    on_progress: Callable[[float], None] | None = None,
    allow_download: bool = False,
    duration: float = 0.0,
) -> list[Word]:
    whisper = _load_model(model, allow_download)
    try:
        segments, _info = whisper.transcribe(
            path,
            language="pt",
            word_timestamps=True,
            vad_filter=True,  # ignora trechos sem voz (reduz "falas inventadas" no silêncio)
            beam_size=5,
            condition_on_previous_text=False,
        )
        words: list[Word] = []
        for seg in segments:
            if cancel is not None:
                cancel.raise_if_cancelled()
            # Descarta trechos que o próprio modelo marca como provável não-fala.
            if seg.no_speech_prob > 0.6 and seg.avg_logprob < -1.0:
                continue
            for w in seg.words or []:
                text = w.word.strip()
                if text:
                    words.append(Word(float(w.start), float(w.end), text))
            if on_progress and duration > 0:
                on_progress(min(1.0, seg.end / duration))
    except CancelledError:
        raise
    except Exception as exc:  # noqa: BLE001
        log.exception("Falha na transcrição")
        raise ProcessingError("A transcrição falhou.", "Veja o log para detalhes ou desative as legendas.") from exc
    log.info("Transcrição concluída: %d palavras", len(words))
    return words
