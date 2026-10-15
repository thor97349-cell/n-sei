"""Zooms discretos ("punch-in") que também disfarçam os cortes secos.

Modo automático: aplica o zoom em cortes alternados (o padrão usado por youtubers para
esconder a emenda), respeitando um intervalo mínimo. Sem cortes, usa intervalos regulares.
Modo manual: o usuário informa os segundos do vídeo final.
"""

from __future__ import annotations

Window = tuple[float, float]


def compute_zoom_windows(
    cut_points: list[float],
    duration: float,
    zoom_duration: float,
    min_interval: float,
    manual_times: list[float] | None = None,
) -> list[Window]:
    zoom_duration = max(0.5, zoom_duration)
    min_interval = max(zoom_duration + 0.5, min_interval)

    if manual_times:
        starts = sorted(t for t in manual_times if 0 <= t < duration)
    else:
        starts = []
        last = -min_interval
        use_this_cut = True
        for t in cut_points:
            if t - last < min_interval:
                continue
            if use_this_cut:
                starts.append(t)
                last = t
            use_this_cut = not use_this_cut
        if not starts:
            t = min_interval / 2
            while t < duration - 1.0:
                starts.append(t)
                t += min_interval

    windows: list[Window] = []
    for s in starts:
        end = min(duration, s + zoom_duration)
        # Termina no próximo corte para a volta do zoom também cair numa emenda.
        later_cuts = [c for c in cut_points if s + 1.0 <= c < end]
        if later_cuts and not manual_times:
            end = later_cuts[0]
        if windows and s < windows[-1][1]:
            continue
        if end - s >= 0.5:
            windows.append((round(s, 3), round(end, 3)))
    return windows


def build_zoom_filter(windows: list[Window], size: tuple[int, int], factor: float) -> str | None:
    """Cadeia que aplica o zoom central nos intervalos. None se não houver zoom."""
    if not windows or factor <= 1.001:
        return None
    w, h = size
    cw = max(2, int(round(w / factor / 2)) * 2)
    ch = max(2, int(round(h / factor / 2)) * 2)
    enable = "+".join(f"between(t,{s:.3f},{e:.3f})" for s, e in windows)
    return (
        "split=2[zm_base][zm_src];"
        f"[zm_src]crop={cw}:{ch}:(iw-{cw})/2:(ih-{ch})/2,scale={w}:{h}:flags=lanczos,setsar=1[zm_big];"
        f"[zm_base][zm_big]overlay=0:0:enable='{enable}'"
    )
