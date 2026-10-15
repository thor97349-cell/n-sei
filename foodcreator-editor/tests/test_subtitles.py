"""Etapa 4: legendas (agrupamento, sincronização com os cortes e arquivos ASS/SRT)."""

import pytest

from foodcreator.core.errors import DependencyError, ModelDownloadRequired
from foodcreator.media.silence import Timeline
from foodcreator.subtitles import transcribe
from foodcreator.subtitles.captions import (
    Word, _ass_time, _srt_time, group_captions, remap_words, write_ass, write_srt,
)


def _words(texts, start=0.0, step=0.3):
    return [Word(start + i * step, start + i * step + 0.25, t) for i, t in enumerate(texts)]


def test_text_is_kept_exactly_as_transcribed():
    words = _words(["Nossa,", "que", "pão", "de", "açúcar", "incrível!"])
    captions = group_captions(words, max_words=4)
    assert " ".join(c.text for c in captions) == "Nossa, que pão de açúcar incrível!"


def test_caption_does_not_end_on_connector():
    captions = group_captions(_words(["Nossa,", "que", "pão", "de", "açúcar", "incrível!"]), max_words=4)
    assert captions[0].text == "Nossa, que pão"
    assert captions[1].text == "de açúcar incrível!"


def test_break_on_long_gap_and_sentence_end():
    words = [Word(0, 0.3, "Ficou"), Word(0.3, 0.6, "ótimo."), Word(0.7, 1.0, "Agora"), Word(3.0, 3.3, "sim")]
    assert [c.text for c in group_captions(words, max_words=10)] == ["Ficou ótimo.", "Agora", "sim"]


def test_captions_never_overlap():
    captions = group_captions(_words([f"p{i}" for i in range(20)], step=0.2), max_words=3)
    for a, b in zip(captions, captions[1:]):
        assert a.end <= b.start


def test_remap_follows_the_cuts():
    timeline = Timeline([(0.0, 2.25), (3.75, 6.25)])
    words = remap_words([Word(0.5, 0.8, "oi"), Word(4.0, 4.3, "tchau"), Word(5.0, 5.2, " ")], timeline)
    assert [w.text for w in words] == ["oi", "tchau"]
    assert words[1].start == pytest.approx(2.25 + 0.25)


def test_time_formats():
    assert _ass_time(3725.456) == "1:02:05.46"
    assert _srt_time(3725.456) == "01:02:05,456"


def test_write_ass_and_srt(tmp_path):
    captions = group_captions(_words(["Muito", "bom", "esse", "brigadeiro!"]), max_words=4)
    ass = tmp_path / "leg.ass"
    write_ass(captions, ass, (1080, 1920), vertical=True, style="dinamica")
    content = ass.read_text(encoding="utf-8")
    assert "PlayResX: 1080" in content and "PlayResY: 1920" in content
    assert content.count("Dialogue:") == 4  # uma por palavra destacada
    assert "brigadeiro!" in content
    srt = tmp_path / "leg.srt"
    write_srt(captions, srt)
    assert srt.read_text(encoding="utf-8").startswith("1\n00:00:00,000 --> ")

    write_ass(captions, ass, (1920, 1080), vertical=False, style="classica")
    assert ass.read_text(encoding="utf-8").count("Dialogue:") == 1


def test_model_download_requires_permission(monkeypatch):
    if not transcribe.is_available():
        with pytest.raises(DependencyError):
            transcribe.transcribe("x.mp4", model="tiny", allow_download=False)
        return
    assert not transcribe.is_model_cached("tiny")
    with pytest.raises(ModelDownloadRequired) as exc:
        transcribe.transcribe("x.mp4", model="tiny", allow_download=False)
    assert "75 MB" in exc.value.size_text


def test_model_sizes_are_documented():
    for name in ("tiny", "base", "small", "medium", "large-v3"):
        assert name in transcribe.MODEL_SIZES and name in transcribe.MODEL_NOTES
