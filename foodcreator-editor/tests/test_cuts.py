"""Etapa 3: regras dos cortes de silêncio."""

import pytest

from foodcreator.core.settings import EditSettings, SilenceParams
from foodcreator.media.silence import (
    Timeline, compute_keep_segments, compute_removals, parse_silencedetect, total_duration,
)

PARAMS = SilenceParams(threshold_db=-35, min_silence=0.8, padding=0.25, long_pause=3.0, long_pause_keep=1.6)


def test_parse_silencedetect_handles_open_silence_at_end():
    lines = [
        "[silencedetect @ 0x1] silence_start: 2.0",
        "[silencedetect @ 0x1] silence_end: 4.0 | silence_duration: 2.0",
        "[silencedetect @ 0x1] silence_start: 10.5",
    ]
    assert parse_silencedetect(lines, 12.0) == [(2.0, 4.0), (10.5, 12.0)]


def test_short_pauses_are_preserved():
    assert compute_removals(10, [(2.0, 2.6)], PARAMS) == []


def test_padding_keeps_word_edges():
    (start, end), = compute_removals(10, [(2.0, 4.0)], PARAMS)
    assert start == pytest.approx(2.25)
    assert end == pytest.approx(3.75)


def test_long_pause_is_shortened_not_removed():
    (start, end), = compute_removals(20, [(5.0, 11.0)], PARAMS)
    kept = (11.0 - 5.0) - (end - start)
    assert kept == pytest.approx(1.6)


def test_leading_and_trailing_silence():
    removals = compute_removals(10, [(0.0, 1.5), (8.5, 10.0)], PARAMS)
    assert removals[0] == (0.0, pytest.approx(1.25))
    assert removals[1] == (pytest.approx(8.75), 10.0)


def test_fully_silent_video_is_not_emptied():
    assert compute_keep_segments(5.0, [(0.0, 5.0)], PARAMS) == [(0.0, 5.0)]


def test_keep_segments_cover_all_sound():
    silences = [(2.0, 4.0), (6.0, 8.0), (10.0, 12.0)]
    segments = compute_keep_segments(12.0, silences, PARAMS, fps=25)
    assert segments[0][0] == 0.0
    # Todo trecho com som (0–2, 4–6, 8–10) continua inteiro.
    for s, e in [(0, 2), (4, 6), (8, 10)]:
        assert any(a <= s and e <= b for a, b in segments)
    assert total_duration(segments) == pytest.approx(7.25, abs=0.05)
    # Bordas alinhadas aos quadros (25 fps).
    for a, _ in segments:
        assert round(a * 25, 6) == pytest.approx(round(a * 25))


def test_aggressiveness_changes_parameters():
    base = EditSettings()
    light = EditSettings(aggressiveness="leve").silence_params()
    strong = EditSettings(aggressiveness="forte").silence_params()
    assert light.min_silence > base.silence_params().min_silence > strong.min_silence
    assert light.padding > strong.padding
    # Nunca abaixo da margem mínima que protege as palavras.
    assert EditSettings(aggressiveness="forte", speech_padding=0.01).silence_params().padding >= 0.12


def test_timeline_maps_original_time_to_cut_time():
    tl = Timeline([(0.0, 2.0), (4.0, 6.0)])
    assert tl.duration == 4.0
    assert tl.map(1.0) == 1.0
    assert tl.map(5.0) == 3.0
    assert tl.map(3.0, prefer="next") == 2.0  # caiu no corte: vai para o próximo trecho
    assert tl.map(3.0, prefer="prev") == 2.0
    assert tl.cut_points() == [2.0]
