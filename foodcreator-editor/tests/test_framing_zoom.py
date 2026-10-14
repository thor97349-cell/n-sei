"""Formatos de saída (16:9 e 9:16 sem deformar) e zooms."""

from foodcreator.media.framing import build_framing_filter, choose_target_size
from foodcreator.media.probe import MediaInfo
from foodcreator.media.zoom import build_zoom_filter, compute_zoom_windows


def _info(w, h, sar=1.0):
    return MediaInfo("x.mp4", 10, w, h, 30, "h264", True, "aac", 48000, 2, sar, 1)


def test_target_size_follows_source_resolution():
    assert choose_target_size(_info(1920, 1080), "horizontal") == (1920, 1080)
    assert choose_target_size(_info(3840, 2160), "horizontal") == (1920, 1080)
    assert choose_target_size(_info(1920, 1080), "vertical") == (1080, 1920)
    assert choose_target_size(_info(1280, 720), "horizontal") == (1280, 720)
    assert choose_target_size(_info(640, 360), "horizontal") == (854, 480)
    assert choose_target_size(_info(1080, 1920), "vertical") == (1080, 1920)


def test_same_aspect_only_scales():
    chain, warning = build_framing_filter(_info(1280, 720), (1920, 1080), "horizontal")
    assert chain.startswith("scale=1920:1080")
    assert "crop" not in chain and warning is None


def test_vertical_crop_is_central_and_warns():
    chain, warning = build_framing_filter(_info(1920, 1080), (1080, 1920), "vertical", "crop", 0.5)
    # 1080 * 9/16 = 607.5 -> 608, centralizado: (1920-608)/2 = 656
    assert "crop=608:1080:656:0" in chain
    assert warning and "central" in warning


def test_vertical_crop_offset_is_configurable():
    chain, warning = build_framing_filter(_info(1920, 1080), (1080, 1920), "vertical", "crop", 0.0)
    assert "crop=608:1080:0:0" in chain
    assert "esquerda" in warning


def test_vertical_blur_mode_never_crops_the_subject():
    chain, warning = build_framing_filter(_info(1920, 1080), (1080, 1920), "vertical", "blur")
    assert "force_original_aspect_ratio=decrease" in chain
    assert "boxblur" in chain and warning is None


def test_vertical_source_to_horizontal_is_fitted_not_cropped():
    chain, _ = build_framing_filter(_info(1080, 1920), (1920, 1080), "horizontal", "crop")
    assert "force_original_aspect_ratio=decrease" in chain


def test_non_square_pixels_are_corrected_first():
    chain, _ = build_framing_filter(_info(1440, 1080, sar=4 / 3), (1920, 1080), "horizontal")
    assert chain.startswith("scale=1920:1080,setsar=1,")


def test_auto_zoom_uses_alternate_cuts_with_min_interval():
    windows = compute_zoom_windows([2, 4, 11, 13, 25, 30], 40, zoom_duration=3, min_interval=8)
    starts = [s for s, _ in windows]
    # 2 entra; 4 está perto demais; 11 é pulado (alternância); 13 entra; 25 pulado; 30 entra.
    assert starts == [2, 13, 30]
    assert all(b - a >= 8 for a, b in zip(starts, starts[1:]))
    assert windows[0] == (2, 4)  # termina no próximo corte para disfarçar a volta do zoom
    assert all(b - a <= 3 for a, b in windows)


def test_auto_zoom_without_cuts_uses_regular_intervals():
    windows = compute_zoom_windows([], 30, zoom_duration=2, min_interval=10)
    assert [s for s, _ in windows] == [5, 15, 25]


def test_manual_zoom_times():
    windows = compute_zoom_windows([1, 2, 3], 20, zoom_duration=2, min_interval=5, manual_times=[3, 12, 50])
    assert windows == [(3, 5), (12, 14)]


def test_zoom_filter():
    assert build_zoom_filter([], (1920, 1080), 1.08) is None
    assert build_zoom_filter([(1, 2)], (1920, 1080), 1.0) is None
    chain = build_zoom_filter([(1, 2), (5, 7.5)], (1920, 1080), 1.08)
    assert "crop=1778:1000" in chain
    assert "between(t,1.000,2.000)+between(t,5.000,7.500)" in chain
