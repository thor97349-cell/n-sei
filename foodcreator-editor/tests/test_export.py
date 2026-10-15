"""Etapas 2–5: exportação real com FFmpeg e verificação do MP4 final."""

import json
import subprocess

import pytest

from foodcreator.core.cache import AnalysisCache
from foodcreator.core.cancel import CancelToken
from foodcreator.core.errors import CancelledError, InvalidInputError, OutputExistsError, ProcessingError
from foodcreator.core.pipeline import EditPipeline
from foodcreator.core.settings import EditSettings
from foodcreator.media import silence as silence_mod
from foodcreator.media.validate import validate_output


def _streams(tools, path):
    out = subprocess.run(
        [tools.ffprobe, "-v", "error", "-print_format", "json", "-show_streams", "-show_format", str(path)],
        capture_output=True, check=True,
    )
    data = json.loads(out.stdout)
    return {s["codec_type"]: s for s in data["streams"]}, float(data["format"]["duration"])


def _pipeline(tools, tmp_path, **kwargs):
    settings = EditSettings(**kwargs)
    return EditPipeline(tools, settings, cache=AnalysisCache(tmp_path / "cache"), temp_root=str(tmp_path))


def test_export_horizontal_has_audio_and_video(tools, speech_video, tmp_path):
    out = tmp_path / "saída" / "pão_youtube.mp4"
    progress = []
    result = _pipeline(tools, tmp_path).process(
        str(speech_video), str(out), progress=lambda f, m: progress.append(f)
    )
    assert out.is_file()
    streams, duration = _streams(tools, out)
    assert streams["video"]["codec_name"] == "h264"
    assert streams["audio"]["codec_name"] == "aac"
    assert streams["video"]["pix_fmt"] == "yuv420p"
    assert (streams["video"]["width"], streams["video"]["height"]) == (854, 480)
    # 12 s com 3 silêncios de 2 s -> cerca de 7,25 s
    assert duration == pytest.approx(7.25, abs=0.2)
    assert result.segments == 3
    assert result.removed_seconds == pytest.approx(4.75, abs=0.2)
    assert progress and progress[-1] == pytest.approx(1.0)
    assert progress == sorted(progress)
    # Original intacto, nenhum arquivo temporário sobrando.
    assert speech_video.stat().st_size > 0
    assert sorted(p.name for p in out.parent.iterdir()) == ["pão_youtube.mp4"]
    assert not list(tmp_path.glob("foodcreator_*"))


def test_export_vertical_shorts(tools, speech_video, tmp_path):
    out = tmp_path / "shorts.mp4"
    result = _pipeline(tools, tmp_path, output_format="vertical", cut_silence=False).process(
        str(speech_video), str(out)
    )
    streams, duration = _streams(tools, out)
    assert (streams["video"]["width"], streams["video"]["height"]) == (480, 854)
    assert duration == pytest.approx(12.0, abs=0.1)
    assert any("Reenquadramento vertical" in w for w in result.warnings)


def test_export_with_subtitles_music_and_blur(tools, speech_video, music_file, tmp_path, fake_transcriber):
    out = tmp_path / "completo.mp4"
    pipeline = _pipeline(
        tools, tmp_path, output_format="vertical", vertical_mode="blur", subtitles=True,
        music=True, music_path=str(music_file), music_license_confirmed=True, preserve_original_audio=False,
    )
    pipeline.transcriber = fake_transcriber
    result = pipeline.process(str(speech_video), str(out))
    streams, duration = _streams(tools, out)
    assert {"video", "audio"} <= set(streams)
    assert duration == pytest.approx(7.25, abs=0.2)
    assert result.srt_path and result.srt_path.endswith("completo.srt")
    srt = (tmp_path / "completo.srt").read_text(encoding="utf-8")
    assert "açúcar" in srt
    assert not any("Reenquadramento" in w for w in result.warnings)


def test_export_video_without_audio_gets_silent_track(tools, silent_video, tmp_path):
    out = tmp_path / "sem audio.mp4"
    result = _pipeline(tools, tmp_path, subtitles=True).process(str(silent_video), str(out))
    streams, duration = _streams(tools, out)
    assert streams["audio"]["codec_name"] == "aac"
    assert (streams["video"]["width"], streams["video"]["height"]) == (1920, 1080)
    assert duration == pytest.approx(4.0, abs=0.1)
    assert any("não tem áudio" in w for w in result.warnings)


def test_vertical_source_to_vertical_output(tools, vertical_video, tmp_path):
    out = tmp_path / "vertical.mp4"
    result = _pipeline(tools, tmp_path, output_format="vertical").process(str(vertical_video), str(out))
    assert (result.check.width, result.check.height) == (720, 1280)
    assert result.warnings == []


def test_never_overwrites_without_permission(tools, speech_video, tmp_path):
    out = tmp_path / "existe.mp4"
    out.write_bytes(b"exportacao anterior")
    with pytest.raises(OutputExistsError):
        _pipeline(tools, tmp_path).process(str(speech_video), str(out))
    assert out.read_bytes() == b"exportacao anterior"
    _pipeline(tools, tmp_path, cut_silence=False, zoom=False).process(str(speech_video), str(out), overwrite=True)
    assert out.stat().st_size > 1000


def test_output_cannot_be_the_original(tools, speech_video, tmp_path):
    with pytest.raises(InvalidInputError):
        _pipeline(tools, tmp_path).process(str(speech_video), str(speech_video), overwrite=True)


def test_invalid_settings_are_reported(tools, speech_video, tmp_path):
    with pytest.raises(InvalidInputError, match="licença"):
        _pipeline(tools, tmp_path, music=True, music_path=str(speech_video)).process(
            str(speech_video), str(tmp_path / "x.mp4")
        )


def test_cancel_leaves_no_partial_file(tools, speech_video, tmp_path):
    cancel = CancelToken()
    pipeline = _pipeline(tools, tmp_path)
    pipeline.cancel = cancel

    def progress(frac, msg):
        if frac > 0.2:
            cancel.cancel()

    out = tmp_path / "cancelado" / "cancelado.mp4"
    with pytest.raises(CancelledError):
        pipeline.process(str(speech_video), str(out), progress=progress)
    assert not out.exists()
    assert list(out.parent.iterdir()) == []


def test_resume_uses_cached_analysis(tools, speech_video, tmp_path, monkeypatch, fake_transcriber):
    pipeline = _pipeline(tools, tmp_path, subtitles=True)
    pipeline.transcriber = fake_transcriber
    pipeline.process(str(speech_video), str(tmp_path / "a.mp4"))
    assert len(fake_transcriber.calls) == 1

    def boom(*a, **k):
        raise AssertionError("deveria usar o cache")

    monkeypatch.setattr(silence_mod, "detect_silences", boom)
    monkeypatch.setattr("foodcreator.core.pipeline.detect_silences", boom)
    pipeline.process(str(speech_video), str(tmp_path / "b.mp4"))
    assert len(fake_transcriber.calls) == 1


def test_validate_output_rejects_broken_file(tools, tmp_path, corrupt_video):
    with pytest.raises(ProcessingError):
        validate_output(tools, corrupt_video)
    with pytest.raises(ProcessingError):
        validate_output(tools, tmp_path / "nao_existe.mp4")
