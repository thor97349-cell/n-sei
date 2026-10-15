"""Agrupa palavras transcritas em legendas e grava arquivos ASS (queimados no vídeo) e SRT.

O texto vem exatamente como o modelo transcreveu: nada é reescrito ou inventado.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from foodcreator.media.silence import Timeline


@dataclass(frozen=True)
class Word:
    start: float
    end: float
    text: str


@dataclass(frozen=True)
class Caption:
    start: float
    end: float
    words: tuple[Word, ...]

    @property
    def text(self) -> str:
        return " ".join(w.text for w in self.words)


def remap_words(words: list[Word], timeline: Timeline) -> list[Word]:
    """Leva os tempos das palavras do vídeo original para o vídeo cortado."""
    out: list[Word] = []
    for w in words:
        text = w.text.strip()
        if not text:
            continue
        start = timeline.map(w.start, prefer="next")
        end = timeline.map(w.end, prefer="prev")
        if end <= start:
            end = start + max(0.1, w.end - w.start)
        if out and start < out[-1].start:
            start = out[-1].start
        out.append(Word(round(start, 3), round(min(end, timeline.duration), 3), text))
    return out


_SENTENCE_END = (".", "!", "?", "…")
# Palavras curtas que soam estranhas no fim de uma legenda ("pão de | açúcar").
_CONNECTORS = {
    "a", "o", "as", "os", "e", "de", "do", "da", "dos", "das", "em", "no", "na", "nos", "nas",
    "um", "uma", "que", "com", "pra", "para", "por", "pelo", "pela", "se", "mas", "ou", "é",
}


def group_captions(
    words: list[Word],
    max_words: int = 4,
    max_chars: int = 32,
    max_duration: float = 3.0,
    max_gap: float = 0.6,
) -> list[Caption]:
    captions: list[Caption] = []
    current: list[Word] = []

    def flush() -> None:
        if current:
            captions.append(Caption(current[0].start, current[-1].end, tuple(current)))
            current.clear()

    for w in words:
        if current:
            chars = len(" ".join(x.text for x in current)) + 1 + len(w.text)
            natural_break = w.start - current[-1].end > max_gap or current[-1].text.endswith(_SENTENCE_END)
            too_long = len(current) >= max_words or chars > max_chars or w.end - current[0].start > max_duration
            if natural_break:
                flush()
            elif too_long:
                carry = None
                if len(current) > 1 and current[-1].text.lower().strip(",") in _CONNECTORS:
                    carry = current.pop()
                flush()
                if carry:
                    current.append(carry)
        current.append(w)
    flush()

    # Estende um pouco cada legenda para facilitar a leitura, sem invadir a próxima.
    adjusted: list[Caption] = []
    for i, c in enumerate(captions):
        limit = captions[i + 1].start - 0.02 if i + 1 < len(captions) else c.end + 0.6
        end = min(max(c.end + 0.2, c.start + 0.6), limit)
        adjusted.append(Caption(c.start, max(end, c.start + 0.05), c.words))
    return adjusted


def _ass_time(t: float) -> str:
    cs = max(0, int(round(t * 100)))
    h, rem = divmod(cs, 360000)
    m, rem = divmod(rem, 6000)
    s, cs = divmod(rem, 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def _srt_time(t: float) -> str:
    ms = max(0, int(round(t * 1000)))
    h, rem = divmod(ms, 3600000)
    m, rem = divmod(rem, 60000)
    s, ms = divmod(rem, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def _ass_escape(text: str) -> str:
    return text.replace("\\", "/").replace("{", "(").replace("}", ")").replace("\n", " ")


HIGHLIGHT = "{\\c&H00D7FF&}"  # amarelo-ouro (formato BGR do ASS)


def caption_layout(size: tuple[int, int], vertical: bool) -> dict:
    w, h = size
    font = round(w * 0.075) if vertical else round(h * 0.062)
    return {
        "font_size": font,
        "outline": max(2, round(font * 0.08)),
        "shadow": max(1, round(font * 0.03)),
        "margin_v": round(h * 0.22) if vertical else round(h * 0.07),
        "margin_lr": round(w * 0.06),
        "max_chars": 22 if vertical else 40,
    }


def write_ass(
    captions: list[Caption],
    path: str | Path,
    size: tuple[int, int],
    vertical: bool,
    style: str = "dinamica",
    font_name: str = "Arial",
) -> None:
    w, h = size
    lay = caption_layout(size, vertical)
    header = (
        "[Script Info]\n"
        "ScriptType: v4.00+\n"
        f"PlayResX: {w}\n"
        f"PlayResY: {h}\n"
        "WrapStyle: 0\n"
        "ScaledBorderAndShadow: yes\n"
        "YCbCr Matrix: TV.709\n\n"
        "[V4+ Styles]\n"
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, "
        "Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, "
        "Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n"
        f"Style: Default,{font_name},{lay['font_size']},&H00FFFFFF,&H00FFFFFF,&H00000000,&H96000000,"
        f"-1,0,0,0,100,100,0,0,1,{lay['outline']},{lay['shadow']},2,"
        f"{lay['margin_lr']},{lay['margin_lr']},{lay['margin_v']},1\n\n"
        "[Events]\n"
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
    )
    events: list[str] = []
    for c in captions:
        if style == "dinamica" and len(c.words) > 1:
            for i, word in enumerate(c.words):
                start = c.start if i == 0 else word.start
                end = c.words[i + 1].start if i + 1 < len(c.words) else c.end
                if end <= start:
                    continue
                parts = [
                    (HIGHLIGHT + _ass_escape(x.text) + "{\\r}") if j == i else _ass_escape(x.text)
                    for j, x in enumerate(c.words)
                ]
                events.append(f"Dialogue: 0,{_ass_time(start)},{_ass_time(end)},Default,,0,0,0,,{' '.join(parts)}")
        else:
            events.append(f"Dialogue: 0,{_ass_time(c.start)},{_ass_time(c.end)},Default,,0,0,0,,{_ass_escape(c.text)}")
    Path(path).write_text(header + "\n".join(events) + "\n", encoding="utf-8")


def write_srt(captions: list[Caption], path: str | Path) -> None:
    blocks = [
        f"{i}\n{_srt_time(c.start)} --> {_srt_time(c.end)}\n{c.text}\n"
        for i, c in enumerate(captions, start=1)
    ]
    Path(path).write_text("\n".join(blocks), encoding="utf-8")
