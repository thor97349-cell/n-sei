"""Etapa 1: análise de mídia (duração, resolução, FPS, áudio) e detecção de silêncio."""

import pytest

from foodcreator.media.ffmpeg import filter_script_args, friendly_ffmpeg_error, parse_version
from foodcreator.media.probe import _rotation, format_duration, probe
from foodcreator.media.silence import detect_silences


def test_probe_reads_video_and_audio_info(tools, speech_video):
    info = probe(tools, speech_video)
    assert (info.width, info.height) == (640, 360)
    assert info.fps == pytest.approx(25.0)
    assert info.video_codec == "h264"
    assert info.has_audio
    assert info.audio_codec == "aac"
    assert info.sample_rate == 48000
    assert not info.is_vertical
    assert info.resolution_text == "640×360"


def test_probe_video_without_audio(tools, silent_video):
    info = probe(tools, silent_video)
    assert not info.has_audio
    assert info.audio_codec is None
    assert (info.width, info.height) == (1920, 1080)
    assert info.duration == pytest.approx(4.0, abs=0.1)


def test_probe_vertical_video(tools, vertical_video):
    info = probe(tools, vertical_video)
    assert info.is_vertical
    assert (info.width, info.height) == (720, 1280)


def test_rotation_metadata_is_detected():
    assert _rotation({"tags": {"rotate": "90"}}) == 90
    assert _rotation({"side_data_list": [{"rotation": -90}]}) == 270
    assert _rotation({}) == 0


def test_detect_silences_finds_the_gaps(tools, speech_video):
    silences = detect_silences(tools, str(speech_video), 12.0, -35)
    assert len(silences) == 3
    for (start, end), (exp_s, exp_e) in zip(silences, [(2, 4), (6, 8), (10, 12)]):
        assert start == pytest.approx(exp_s, abs=0.1)
        assert end == pytest.approx(exp_e, abs=0.1)


def test_format_duration():
    assert format_duration(12.4) == "0:12"
    assert format_duration(3725) == "1:02:05"


def test_parse_version():
    assert parse_version("ffmpeg version 6.1.1-3ubuntu5 Copyright") == (6, 1)
    assert parse_version("ffmpeg version n7.1 Copyright") == (7, 1)
    assert parse_version("ffmpeg version 7.0.2-static https://") == (7, 0)
    assert parse_version("ffmpeg version N-118000-gabc Copyright") == (99, 0)
    assert parse_version("lixo") == (0, 0)


def test_filter_script_option_depends_on_version():
    from foodcreator.media.ffmpeg import FFmpegTools

    assert filter_script_args(FFmpegTools("f", "p", (6, 1)), "x.txt") == ["-filter_complex_script", "x.txt"]
    assert filter_script_args(FFmpegTools("f", "p", (7, 1)), "x.txt") == ["-/filter_complex", "x.txt"]


def test_friendly_errors_are_in_portuguese():
    assert "espaço" in friendly_ffmpeg_error("av_interleaved_write_frame(): No space left on device")
    assert "corrompido" in friendly_ffmpeg_error("moov atom not found")
    assert "permissão" in friendly_ffmpeg_error("Permission denied")
