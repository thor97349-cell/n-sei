"""Escolha da resolução de saída e reenquadramento sem deformar a imagem."""

from __future__ import annotations

from foodcreator.media.probe import MediaInfo

# Níveis de resolução (lado menor -> tamanho horizontal 16:9). O vertical é o mesmo, invertido.
_LEVELS = [(1080, (1920, 1080)), (720, (1280, 720)), (480, (854, 480))]
_ASPECT_TOLERANCE = 0.01

NO_SUBJECT_DETECTION_WARNING = (
    "Reenquadramento vertical sem detecção automática de rosto/comida: foi usado um recorte "
    "{pos}. Confira se nada importante ficou de fora; se ficou, ajuste a posição do "
    "enquadramento ou use o modo 'Encaixar sem cortar'."
)


def choose_target_size(info: MediaInfo, output_format: str) -> tuple[int, int]:
    """1920×1080 / 1080×1920 quando o original tem resolução para isso; senão, um nível abaixo.

    Nunca sobe a resolução além do nível do material original (exceto o mínimo de 480p).
    """
    short_side = min(info.display_width, info.height)
    size = _LEVELS[-1][1]
    for level, level_size in _LEVELS:
        if short_side >= level * 0.95:
            size = level_size
            break
    w, h = size
    return (h, w) if output_format == "vertical" else (w, h)


def _even(value: float) -> int:
    return max(2, int(round(value / 2)) * 2)


def describe_offset(offset: float) -> str:
    if offset < 0.4:
        return "deslocado para a esquerda"
    if offset > 0.6:
        return "deslocado para a direita"
    return "central"


def build_framing_filter(
    info: MediaInfo,
    target: tuple[int, int],
    output_format: str,
    vertical_mode: str = "crop",
    offset: float = 0.5,
) -> tuple[str, str | None]:
    """Cadeia de filtros (sem rótulos) que leva o vídeo ao tamanho `target`.

    Devolve (filtro, aviso). Proporção sempre preservada: ou recorta (só no vertical,
    modo 'crop'), ou encaixa com fundo desfocado.
    """
    tw, th = target
    prefix = ""
    src_w, src_h = info.width, info.height
    if abs(info.sample_aspect - 1.0) > 0.01:
        # Pixels não quadrados: converte para quadrados antes de qualquer cálculo.
        src_w = _even(info.width * info.sample_aspect)
        prefix = f"scale={src_w}:{src_h},setsar=1,"

    src_aspect = src_w / src_h
    dst_aspect = tw / th

    if abs(src_aspect - dst_aspect) / dst_aspect <= _ASPECT_TOLERANCE:
        return f"{prefix}scale={tw}:{th}:flags=lanczos,setsar=1", None

    if output_format == "vertical" and vertical_mode == "crop":
        offset = min(1.0, max(0.0, offset))
        if src_aspect > dst_aspect:
            crop_w = min(src_w, _even(src_h * dst_aspect))
            x = int((src_w - crop_w) * offset)
            crop = f"crop={crop_w}:{src_h}:{x}:0"
            warning = NO_SUBJECT_DETECTION_WARNING.format(pos=describe_offset(offset))
        else:
            crop_h = min(src_h, _even(src_w / dst_aspect))
            y = (src_h - crop_h) // 2
            crop = f"crop={src_w}:{crop_h}:0:{y}"
            warning = None  # corta só um pouco em cima/embaixo, centralizado
        return f"{prefix}{crop},scale={tw}:{th}:flags=lanczos,setsar=1", warning

    # Encaixa a imagem inteira e preenche o resto com uma versão desfocada dela mesma.
    bw, bh = _even(tw / 4), _even(th / 4)
    chain = (
        f"{prefix}split=2[fc_bg][fc_fg];"
        f"[fc_bg]scale={bw}:{bh}:force_original_aspect_ratio=increase,crop={bw}:{bh},"
        f"boxblur=10:2,scale={tw}:{th},setsar=1[fc_bgs];"
        f"[fc_fg]scale={tw}:{th}:force_original_aspect_ratio=decrease:force_divisible_by=2:flags=lanczos,"
        f"setsar=1[fc_fgs];"
        f"[fc_bgs][fc_fgs]overlay=(W-w)/2:(H-h)/2,setsar=1"
    )
    return chain, None
