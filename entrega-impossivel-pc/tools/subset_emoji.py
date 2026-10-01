#!/usr/bin/env python3
"""Recorta a fonte Noto Color Emoji só com os emojis usados no jogo.

O jogo embute `assets/fonts/NotoColorEmoji.ttf` como fonte reserva das fontes de texto
(Liberation Sans). A fonte completa tem ~10 MB; o recorte fica com poucos KB. Rode depois
de usar um emoji novo em qualquer texto do jogo:

    python3 tools/subset_emoji.py [caminho/da/NotoColorEmoji-completa.ttf]

Caracteres que a Liberation Sans já desenha (setas, ★, travessões...) não entram. Se
algum caractere não existir em nenhuma das duas fontes, o script avisa.
Precisa de Python 3 com fontTools (`pip install fonttools`).
"""
import pathlib
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "assets/fonts/NotoColorEmoji.ttf"
FULL = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path("/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf")
TEXT_FONTS = [ROOT / "assets/fonts/LiberationSans-Regular.ttf", ROOT / "assets/fonts/LiberationSans-Bold.ttf"]
# Junções e seletores usados por emojis compostos.
ALWAYS = {0x200D, 0xFE0F}


def used_characters() -> set[int]:
    chars: set[int] = set()
    for path in list(ROOT.glob("autoload/**/*.gd")) + list(ROOT.glob("game/**/*.gd")):
        for char in path.read_text(encoding="utf-8"):
            if ord(char) > 0x7F:
                chars.add(ord(char))
    return chars


def main() -> None:
    text_cmap: set[int] = set()
    for path in TEXT_FONTS:
        text_cmap |= set(TTFont(path).getBestCmap())
    full = TTFont(FULL)
    emoji_cmap = set(full.getBestCmap())
    wanted = set(ALWAYS)
    missing = []
    for code in sorted(used_characters()):
        if code in text_cmap:
            continue
        if code in emoji_cmap:
            wanted.add(code)
        elif code not in ALWAYS:
            missing.append(code)
    options = subset.Options()
    options.layout_features = ["*"]
    options.notdef_outline = True
    font = subset.load_font(str(FULL), options)
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=sorted(wanted))
    subsetter.subset(font)
    subset.save_font(font, str(OUTPUT), options)
    emojis = "".join(chr(c) for c in sorted(wanted - ALWAYS))
    print(f"{len(wanted - ALWAYS)} emojis -> {OUTPUT.relative_to(ROOT)} ({OUTPUT.stat().st_size // 1024} KB)")
    print(emojis)
    if missing:
        print("SEM GLIFO em nenhuma fonte:", " ".join(f"{chr(c)} (U+{c:04X})" for c in missing))


if __name__ == "__main__":
    main()
