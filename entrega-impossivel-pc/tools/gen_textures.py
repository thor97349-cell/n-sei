#!/usr/bin/env python3
"""Gera as texturas do chão do jogo (asfalto, grama, terra, concreto, bloquete,
pedra portuguesa, paralelepípedo) e um ruído "macro" para variação.

Tudo é gerado por código (sem fotos): as texturas são pequenas (512x512), emendam
sem costura (tileable) e saem em assets/textures/ junto com os arquivos .import
(compressão de GPU + mipmaps). Rodar de novo gera exatamente as mesmas imagens.

Uso:  python3 tools/gen_textures.py
Precisa de: numpy, Pillow.
"""
from __future__ import annotations

import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

N = 512
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "textures")


# --- ruídos que emendam nas bordas ------------------------------------------------------

def _smooth(t: np.ndarray) -> np.ndarray:
    return t * t * (3.0 - 2.0 * t)


def value_noise(n: int, cells: int, rng: np.random.Generator) -> np.ndarray:
    """Ruído de valor periódico (emenda nas bordas)."""
    grid = rng.random((cells, cells))
    coords = np.arange(n) * cells / n
    i0 = np.floor(coords).astype(int)
    f = _smooth(coords - i0)
    i1 = (i0 + 1) % cells
    i0 %= cells
    top = grid[i0][:, i0] * (1 - f)[None, :] + grid[i0][:, i1] * f[None, :]
    bottom = grid[i1][:, i0] * (1 - f)[None, :] + grid[i1][:, i1] * f[None, :]
    return top * (1 - f)[:, None] + bottom * f[:, None]


def fbm(n: int, cells: int, rng: np.random.Generator, octaves: int = 5, gain: float = 0.5) -> np.ndarray:
    total = np.zeros((n, n))
    amplitude = 1.0
    norm = 0.0
    for octave in range(octaves):
        c = cells * 2 ** octave
        if c > n:
            break
        total += value_noise(n, c, rng) * amplitude
        norm += amplitude
        amplitude *= gain
    return total / norm


def worley(n: int, cells: int, rng: np.random.Generator, jitter: float = 1.0):
    """Voronoi periódico: distância ao ponto mais próximo (F1), ao segundo (F2) e o id da célula."""
    points = 0.5 + (rng.random((cells, cells, 2)) - 0.5) * jitter
    ys, xs = np.mgrid[0:n, 0:n] * (cells / n)
    cx = np.floor(xs).astype(int)
    cy = np.floor(ys).astype(int)
    f1 = np.full((n, n), 9.0)
    f2 = np.full((n, n), 9.0)
    ident = np.zeros((n, n), dtype=int)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            gx = (cx + dx) % cells
            gy = (cy + dy) % cells
            px = cx + dx + points[gy, gx, 0]
            py = cy + dy + points[gy, gx, 1]
            d = np.hypot(xs - px, ys - py)
            closer = d < f1
            f2 = np.where(closer, f1, np.minimum(f2, d))
            ident = np.where(closer, gy * cells + gx, ident)
            f1 = np.where(closer, d, f1)
    return f1, f2, ident


def blur(a: np.ndarray, radius: int) -> np.ndarray:
    """Desfoque que respeita a emenda (média com rolagens)."""
    out = a.copy()
    for _ in range(radius):
        out = (out + np.roll(out, 1, 0) + np.roll(out, -1, 0) + np.roll(out, 1, 1) + np.roll(out, -1, 1)) / 5.0
    return out


def normalize(a: np.ndarray) -> np.ndarray:
    lo, hi = np.percentile(a, 0.5), np.percentile(a, 99.5)
    return np.clip((a - lo) / max(hi - lo, 1e-6), 0.0, 1.0)


# --- saída ------------------------------------------------------------------------------

def save_rgb(name: str, rgb: np.ndarray) -> None:
    img = Image.fromarray((np.clip(rgb, 0, 1) * 255 + 0.5).astype(np.uint8), "RGB")
    img.save(os.path.join(OUT, name + ".png"), optimize=True)
    _write_import(name, normal=False)


def save_rgba(name: str, rgba: np.ndarray, lossless: bool = False) -> None:
    img = Image.fromarray((np.clip(rgba, 0, 1) * 255 + 0.5).astype(np.uint8), "RGBA")
    img.save(os.path.join(OUT, name + ".png"), optimize=True)
    _write_import(name, normal=False, lossless=lossless)


def save_normal(name: str, height: np.ndarray, strength: float) -> None:
    """Mapa de normal a partir da altura: R = -dh/du, G = -dh/dv (linhas da imagem), B = cima."""
    dx = (np.roll(height, -1, 1) - np.roll(height, 1, 1)) * 0.5 * strength
    dy = (np.roll(height, -1, 0) - np.roll(height, 1, 0)) * 0.5 * strength
    n = np.dstack([-dx, -dy, np.ones_like(height)])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    save_rgb_raw = (n * 0.5 + 0.5)
    img = Image.fromarray((np.clip(save_rgb_raw, 0, 1) * 255 + 0.5).astype(np.uint8), "RGB")
    img.save(os.path.join(OUT, name + ".png"), optimize=True)
    _write_import(name, normal=True)


def _write_import(name: str, normal: bool, lossless: bool = False) -> None:
    text = f"""[remap]

importer="texture"
type="CompressedTexture2D"

[deps]

source_file="res://assets/textures/{name}.png"

[params]

compress/mode={0 if lossless else 2}
compress/high_quality=false
compress/lossy_quality=0.7
compress/uastc_level=0
compress/rdo_quality_loss=0.0
compress/hdr_compression=1
compress/normal_map={1 if normal else 2}
compress/channel_pack=0
mipmaps/generate=true
mipmaps/limit=-1
roughness/mode=0
roughness/src_normal=""
process/channel_remap/red=0
process/channel_remap/green=1
process/channel_remap/blue=2
process/channel_remap/alpha=3
process/fix_alpha_border=false
process/premult_alpha=false
process/normal_map_invert_y=false
process/hdr_as_srgb=false
process/hdr_clamp_exposure=false
process/size_limit=0
detect_3d/compress_to=0
"""
    path = os.path.join(OUT, name + ".png.import")
    # Mantém o uid/destino que o Godot já gravou (se existir): só troca os parâmetros.
    if os.path.exists(path):
        old = open(path, encoding="utf-8").read()
        head = old.split("[params]")[0]
        text = head + "[params]" + text.split("[params]")[1]
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)


def mix(a, b, t):
    return a * (1 - t) + b * t


def color(r, g, b):
    return np.array([r, g, b], dtype=float)


# --- texturas ---------------------------------------------------------------------------

def asphalt() -> None:
    """Asfalto (3,5 m): betume escuro com agregado de pedrinhas claras e escuras e poros."""
    rng = np.random.default_rng(11)
    base = fbm(N, 8, rng, 6) * 0.6 + fbm(N, 64, rng, 3) * 0.4
    # Pedrinhas do agregado: células pequenas, cada uma com um tom.
    f1, f2, ident = worley(N, 96, rng, 0.9)
    stone_tone = rng.random(96 * 96)[ident]
    stone = np.clip(1.0 - f1 / 0.42, 0.0, 1.0) ** 0.6
    stone_mask = (stone > 0.25) & (stone_tone > 0.35)
    f1b, _, identb = worley(N, 180, rng, 0.9)
    fine_tone = rng.random(180 * 180)[identb]
    fine = np.clip(1.0 - f1b / 0.4, 0.0, 1.0)
    pores = (value_noise(N, 128, rng) > 0.86).astype(float) * (value_noise(N, 256, rng) > 0.5)
    lum = 0.42 + 0.14 * (base - 0.5)
    lum = np.where(stone_mask, lum + (stone_tone - 0.35) * 0.55 * stone, lum)
    lum += (fine_tone - 0.5) * 0.16 * fine
    lum -= pores * 0.18
    lum = np.clip(lum, 0.05, 0.95)
    # Levíssimo tom quente/frio nas pedras.
    warm = (stone_tone - 0.5) * 0.04 * stone_mask
    rgb = np.dstack([lum + warm, lum, lum - warm * 0.8])
    save_rgb("asphalt_albedo", rgb)
    height = stone * stone_mask * 0.8 + fine * 0.25 - pores * 0.6 + base * 0.3
    save_normal("asphalt_normal", blur(height, 1), 6.0)


def grass() -> None:
    """Gramado (2 m): milhares de folhinhas em tons de verde, algumas secas, terra no fundo."""
    rng = np.random.default_rng(23)
    scale = 3
    size = N * scale // 2  # desenha maior e reduz (antisserrilhado)
    img = Image.new("RGB", (size, size), (46, 58, 24))
    hmap = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(img)
    hdraw = ImageDraw.Draw(hmap)
    patch = fbm(size // 4, 6, rng, 4)
    greens = [(62, 92, 28), (74, 106, 34), (88, 118, 40), (54, 82, 26), (98, 124, 46), (70, 96, 38)]
    dry = [(128, 122, 62), (112, 104, 52), (140, 132, 76)]
    count = 52000
    xs = rng.random(count) * size
    ys = rng.random(count) * size
    angles = rng.random(count) * np.pi * 2
    lengths = rng.uniform(5, 14, count) * scale / 2
    for i in range(count):
        px, py = xs[i], ys[i]
        dryness = patch[int(py) // 4 % (size // 4), int(px) // 4 % (size // 4)]
        if rng.random() < 0.05 + 0.12 * max(dryness - 0.55, 0) * 4:
            col = dry[rng.integers(len(dry))]
        else:
            col = greens[rng.integers(len(greens))]
        shade = rng.uniform(0.75, 1.2)
        col = tuple(int(min(255, c * shade)) for c in col)
        dx = np.cos(angles[i]) * lengths[i]
        dy = np.sin(angles[i]) * lengths[i]
        width = 2 if rng.random() < 0.7 else 3
        h = int(90 + 165 * rng.random())
        for ox in (-size, 0, size):
            for oy in (-size, 0, size):
                x0, y0 = px + ox, py + oy
                if -20 < x0 < size + 20 and -20 < y0 < size + 20:
                    draw.line((x0, y0, x0 + dx, y0 + dy), fill=col, width=width)
                    hdraw.line((x0, y0, x0 + dx, y0 + dy), fill=h, width=width)
    img = img.resize((N, N), Image.LANCZOS)
    hmap = hmap.resize((N, N), Image.LANCZOS)
    rgb = np.asarray(img).astype(float) / 255.0
    height = np.asarray(hmap).astype(float) / 255.0
    save_rgb("grass_albedo", rgb)
    save_normal("grass_normal", height, 3.0)


def dirt() -> None:
    """Terra batida (3 m): torrões, pedrinhas e rachaduras finas."""
    rng = np.random.default_rng(37)
    base = fbm(N, 6, rng, 6)
    clods = fbm(N, 24, rng, 4)
    f1, f2, ident = worley(N, 40, rng)
    pebble_tone = rng.random(40 * 40)[ident]
    pebble = np.clip(1.0 - f1 / 0.3, 0, 1) * (pebble_tone > 0.8)
    f1c, f2c, _ = worley(N, 7, rng)
    crack = np.clip(1.0 - (f2c - f1c) / 0.05, 0, 1) * np.clip((fbm(N, 4, rng, 3) - 0.56) * 6, 0, 1)
    grain = value_noise(N, 256, rng)
    soil = mix(color(0.36, 0.27, 0.19), color(0.5, 0.4, 0.29), base[..., None])
    soil *= (0.85 + 0.25 * clods)[..., None]
    soil *= (0.93 + 0.12 * grain)[..., None]
    stones = mix(color(0.36, 0.33, 0.29), color(0.58, 0.54, 0.48), ((pebble_tone - 0.8) * 5)[..., None])
    rgb = mix(soil, stones, np.clip(pebble * 1.5, 0, 0.85)[..., None])
    rgb *= (1.0 - crack * 0.3)[..., None]
    save_rgb("dirt_albedo", rgb)
    height = clods * 0.6 + pebble * 0.8 + grain * 0.2 - crack * 0.7
    save_normal("dirt_normal", blur(height, 1), 5.0)


def concrete() -> None:
    """Concreto (3 m): cinza claro, agregado fino, manchas e poucas trincas finas."""
    rng = np.random.default_rng(41)
    blotch = fbm(N, 5, rng, 6)
    stain = np.clip((fbm(N, 3, rng, 5) - 0.55) * 4, 0, 1)
    f1, _, ident = worley(N, 150, rng)
    tone = rng.random(150 * 150)[ident]
    speck = np.clip(1 - f1 / 0.35, 0, 1) * (tone > 0.7)
    grain = value_noise(N, 256, rng)
    f1c, f2c, _ = worley(N, 3, rng)
    crack = np.clip(1.0 - (f2c - f1c) / 0.012, 0, 1) * (fbm(N, 3, rng, 3) > 0.58)
    crack *= 0.0
    lum = 0.62 + 0.05 * (blotch - 0.5) + 0.05 * (grain - 0.5) + speck * (tone - 0.7) * 0.5 - stain * 0.05
    rgb = np.dstack([lum * 1.01, lum, lum * 0.97])
    save_rgb("concrete_albedo", rgb)
    height = grain * 0.4 + speck * 0.5 + blotch * 0.2 - crack * 0.6
    save_normal("concrete_normal", height, 2.5)


def _pieces(width_px: int, height_px: int, rng: np.random.Generator, gap: float, offset_rows: bool, jitter: float = 0.0):
    """Peças retangulares em fileiras (juntas amarradas): id, borda (0 na junta, 1 no meio), tom."""
    ys, xs = np.mgrid[0:N, 0:N].astype(float)
    row = np.floor(ys / height_px).astype(int)
    shift = np.where(row % 2 == 1, width_px / 2.0, 0.0) if offset_rows else 0.0
    if jitter > 0:
        row_shift = rng.random(int(round(N / height_px)) + 1)[row % int(round(N / height_px))] * width_px * jitter
        shift = shift + row_shift
    col = np.floor((xs + shift) / width_px).astype(int)
    fx = (xs + shift) / width_px - col
    fy = ys / height_px - row
    ncols = int(round(N / width_px))
    nrows = int(round(N / height_px))
    ident = (row % nrows) * (ncols + 2) + (col % ncols)
    edge = np.minimum(np.minimum(fx, 1 - fx) * width_px, np.minimum(fy, 1 - fy) * height_px)
    bevel = np.clip((edge - gap) / 3.0, 0, 1)
    tone = rng.random(ident.max() + 1)[ident]
    return ident, bevel, tone, edge


def pavers() -> None:
    """Bloquete retangular 20x10 cm em fileiras amarradas (tile de 1,6 m, 320 px/m)."""
    rng = np.random.default_rng(53)
    ident, bevel, tone, edge = _pieces(64, 32, rng, 1.2, True)
    grain = value_noise(N, 200, rng) * 0.5 + fbm(N, 16, rng, 4) * 0.5
    lum = 0.55 + (tone - 0.5) * 0.1 + (grain - 0.5) * 0.12
    lum = lum * (0.55 + 0.45 * bevel)
    save_rgb("pavers_albedo", np.dstack([lum, lum, lum]))
    height = bevel * 0.9 + grain * 0.15
    save_normal("pavers_normal", height, 4.0)


def setts() -> None:
    """Paralelepípedo de granito (tile de 2 m): pedras de ~16x11 cm, fileiras desalinhadas."""
    rng = np.random.default_rng(61)
    ident, bevel, tone, edge = _pieces(N / 12.0, N / 18.0, rng, 2.0, True, jitter=0.6)
    speck = value_noise(N, 256, rng)
    dome = np.clip(edge / 12.0, 0, 1) ** 0.5
    warm = tone[..., None]
    stone = mix(color(0.46, 0.44, 0.42), color(0.62, 0.58, 0.53), warm)
    stone *= (0.88 + 0.2 * speck)[..., None]
    stone *= (0.3 + 0.7 * bevel)[..., None]
    joint = color(0.25, 0.22, 0.18)
    rgb = mix(joint, stone, (bevel > 0.05)[..., None] * 1.0)
    save_rgb("setts_albedo", rgb)
    height = dome * 0.9 * (bevel > 0.05) + speck * 0.1
    save_normal("setts_normal", blur(height, 1), 5.0)


def mosaic() -> None:
    """Pedra portuguesa (tile de 1,2 m): pedrinhas irregulares de ~5 cm.
    R = tom da pedra, G = pedra (1) ou rejunte (0). A cor preta/branca vem do shader."""
    rng = np.random.default_rng(71)
    f1, f2, ident = worley(N, 24, rng, 0.95)
    tone = rng.random(24 * 24)[ident]
    stone = np.clip((f2 - f1) / 0.12, 0, 1)
    grain = value_noise(N, 160, rng)
    data = np.dstack([np.clip(tone * 0.8 + grain * 0.2, 0, 1), stone, grain])
    save_rgb("mosaic_data", data)
    height = np.clip((f2 - f1) / 0.25, 0, 1) ** 0.7 + grain * 0.1
    save_normal("mosaic_normal", blur(height, 1), 5.0)


def macro() -> None:
    """Ruído de baixa frequência para variar o chão sem repetir: R, G, B = três escalas; A = manchas."""
    global N
    keep = N
    N = 256
    rng = np.random.default_rng(83)
    r = normalize(fbm(N, 3, rng, 5))
    g = normalize(fbm(N, 6, rng, 5))
    b = normalize(fbm(N, 12, rng, 4))
    f1, f2, _ = worley(N, 5, rng)
    a = normalize(1.0 - f1)
    save_rgba("macro_noise", np.dstack([r, g, b, a]))
    N = keep


def clouds() -> None:
    """Ruído das nuvens do céu (sem compressão, para não ficar "quadriculado" no céu):
    R = formato grande e fofo (cúmulos), G = detalhe médio, B = fiapos finos,
    A = "erosão" (bolinhas) que recorta as bordas."""
    rng = np.random.default_rng(97)
    f1, _, _ = worley(N, 6, rng)
    billows = normalize(fbm(N, 4, rng, 5, 0.55) * 0.65 + (1.0 - normalize(f1)) * 0.35)
    mid = normalize(fbm(N, 8, rng, 5, 0.5))
    wisps = normalize(fbm(N, 16, rng, 4, 0.55))
    e1, _, _ = worley(N, 24, rng)
    erosion = normalize(1.0 - e1)
    save_rgba("cloud_noise", np.dstack([billows, mid, wisps, erosion]), lossless=True)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for build in (asphalt, grass, dirt, concrete, pavers, setts, mosaic, macro, clouds):
        build()
        print("ok", build.__name__)
