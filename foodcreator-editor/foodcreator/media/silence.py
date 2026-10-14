"""Detecção de silêncios e cálculo dos trechos que ficam no vídeo.

Regras:
- Silêncios mais curtos que `min_silence` não são tocados (pausas naturais ficam).
- Sempre sobra `padding` de margem antes e depois da fala (não corta palavras).
- Pausas longas (>= `long_pause`) são encurtadas para `long_pause_keep`, não removidas:
  costumam ser degustação, demonstração ou reação silenciosa.
- Nenhum trecho com som é removido; só o miolo dos silêncios.
"""

from __future__ import annotations

import bisect
import logging
import re

from foodcreator.core.cancel import CancelToken
from foodcreator.core.settings import SilenceParams
from foodcreator.media.ffmpeg import FFmpegTools, run_ffmpeg

log = logging.getLogger("foodcreator.silence")

Interval = tuple[float, float]

DETECT_MIN_DURATION = 0.25  # detecta tudo acima disso; o filtro fino é feito em Python
MIN_CUT = 0.2  # remoções menores que isso não valem um corte
_EDGE = 0.05

_START_RE = re.compile(r"silence_start:\s*(-?[\d.]+)")
_END_RE = re.compile(r"silence_end:\s*(-?[\d.]+)")


def parse_silencedetect(stderr_lines: list[str], duration: float) -> list[Interval]:
    silences: list[Interval] = []
    start: float | None = None
    for line in stderr_lines:
        m = _START_RE.search(line)
        if m:
            start = max(0.0, float(m.group(1)))
            continue
        m = _END_RE.search(line)
        if m and start is not None:
            end = min(duration, float(m.group(1)))
            if end > start:
                silences.append((start, end))
            start = None
    if start is not None and duration > start:
        silences.append((start, duration))
    return silences


def detect_silences(
    tools: FFmpegTools,
    path: str,
    duration: float,
    threshold_db: float,
    cancel: CancelToken | None = None,
    on_progress=None,
) -> list[Interval]:
    lines = run_ffmpeg(
        tools,
        ["-i", path, "-map", "0:a:0", "-vn", "-sn", "-dn",
         "-af", f"silencedetect=noise={threshold_db}dB:d={DETECT_MIN_DURATION}", "-f", "null", "-"],
        cancel=cancel,
        on_progress=on_progress,
        keep_stderr=True,
    )
    silences = parse_silencedetect(lines, duration)
    log.info("%d silêncios detectados (limiar %s dB)", len(silences), threshold_db)
    return silences


def compute_removals(duration: float, silences: list[Interval], params: SilenceParams) -> list[Interval]:
    removals: list[Interval] = []
    for s, e in sorted(silences):
        s, e = max(0.0, s), min(duration, e)
        length = e - s
        if length < params.min_silence:
            continue
        side = params.padding
        if length >= params.long_pause:
            side = max(side, params.long_pause_keep / 2)
        at_start = s <= _EDGE
        at_end = e >= duration - _EDGE
        cut_start = s if at_start else s + side
        cut_end = e if at_end else e - side
        if at_start and at_end:
            continue  # vídeo inteiro em silêncio: não remove nada
        if cut_end - cut_start >= MIN_CUT:
            removals.append((cut_start, cut_end))
    return removals


def snap(value: float, fps: float) -> float:
    return round(value * fps) / fps if fps > 0 else value


def compute_keep_segments(
    duration: float, silences: list[Interval], params: SilenceParams, fps: float = 0.0
) -> list[Interval]:
    """Trechos [início, fim) do original que vão para o vídeo final, em ordem."""
    removals = compute_removals(duration, silences, params)
    segments: list[Interval] = []
    cursor = 0.0
    for rs, re_ in removals:
        if rs > cursor:
            segments.append((cursor, rs))
        cursor = max(cursor, re_)
    if cursor < duration:
        segments.append((cursor, duration))

    # Alinha aos quadros para manter áudio e vídeo sincronizados.
    snapped: list[Interval] = []
    for s, e in segments:
        s2 = 0.0 if s <= 0 else snap(s, fps)
        e2 = duration if e >= duration else snap(e, fps)
        if snapped and s2 < snapped[-1][1]:
            s2 = snapped[-1][1]
        if e2 > s2:
            snapped.append((s2, e2))
    return snapped or [(0.0, duration)]


def total_duration(segments: list[Interval]) -> float:
    return sum(e - s for s, e in segments)


class Timeline:
    """Converte tempos do vídeo original para o vídeo já cortado."""

    def __init__(self, segments: list[Interval]):
        self.segments = segments
        self._starts = [s for s, _ in segments]
        self._offsets = []
        acc = 0.0
        for s, e in segments:
            self._offsets.append(acc)
            acc += e - s
        self.duration = acc

    def map(self, t: float, prefer: str = "next") -> float:
        """Tempo no vídeo final. Se `t` caiu num trecho removido, vai para o início do
        próximo trecho (prefer='next') ou para o fim do anterior (prefer='prev')."""
        i = bisect.bisect_right(self._starts, t) - 1
        if i >= 0:
            s, e = self.segments[i]
            if t <= e:
                return self._offsets[i] + (t - s)
            if prefer == "prev" or i + 1 >= len(self.segments):
                return self._offsets[i] + (e - s)
            return self._offsets[i + 1]
        return 0.0

    def cut_points(self) -> list[float]:
        """Momentos do vídeo final onde há um corte (emenda entre trechos)."""
        return self._offsets[1:]
